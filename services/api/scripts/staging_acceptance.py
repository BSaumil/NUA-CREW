"""Staging acceptance runner for the invitation-only AU hiring journey.

Drives the real HTTP API with isolated synthetic accounts. It never invents evidence:

* every step ends `passed`, `failed` or `blocked` (a prerequisite the operator has not supplied);
* a report is labelled `target_kind` = `hosted` or `local-selftest`; only `hosted` counts as
  hosted acceptance, and the report is never `accepted` if any step failed or is blocked;
* no secret, token, password, raw synthetic email or DB URL is ever written to the report.

Safety guards (all fail closed, before any request is sent):
* HTTPS only; host must be listed in NUA_ACCEPT_ALLOWED_HOSTS and be re-typed in
  NUA_ACCEPT_CONFIRM_HOST (so a typo or a copied production URL cannot be hit by accident);
* synthetic emails use NUA_ACCEPT_EMAIL_DOMAIN, which must not be a public mailbox provider, so
  no live message reaches a real person;
* publishing a job needs --allow-publish, and the job is closed again at the end.

Prerequisites it cannot create (reported as `blocked`, never faked): reading verification tokens
(NUA_ACCEPT_TOKEN_FILE), an approved admin identity (NUA_ACCEPT_ADMIN_EMAIL/PASSWORD).
Usage: see docs/pilot/STAGING_ACCEPTANCE_RUNNER.md.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
import secrets
import sys
import time
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import httpx

PUBLIC_MAILBOX_DOMAINS = frozenset(
    {
        "gmail.com",
        "googlemail.com",
        "outlook.com",
        "hotmail.com",
        "live.com",
        "yahoo.com",
        "yahoo.com.au",
        "icloud.com",
        "me.com",
        "proton.me",
        "protonmail.com",
        "bigpond.com",
        "optusnet.com.au",
        "aol.com",
        "msn.com",
    }  # fmt: skip
)
STATUS = ("passed", "failed", "blocked")


class GuardError(Exception):
    """Configuration refused before any request is sent."""


@dataclass
class Config:
    base_url: str
    allow_publish: bool = False
    email_domain: str = ""
    token_file: str | None = None
    admin_email: str | None = None
    admin_password: str | None = None
    bypass_secret: str | None = None  # operator-supplied protection-bypass; never logged
    target_kind: str = "hosted"
    timeout_s: float = 20.0


@dataclass
class Step:
    id: str
    title: str
    status: str
    detail: str = ""


@dataclass
class Report:
    target_kind: str
    host: str
    started_at: str
    steps: list[Step] = field(default_factory=list)

    def add(self, id_: str, title: str, status: str, detail: str = "") -> bool:
        assert status in STATUS
        self.steps.append(Step(id_, title, status, detail))
        return status == "passed"

    @property
    def accepted(self) -> bool:
        return bool(self.steps) and all(s.status == "passed" for s in self.steps)

    def to_json(self) -> str:
        return json.dumps(
            {
                "target_kind": self.target_kind,
                "host": self.host,
                "started_at": self.started_at,
                "accepted": self.accepted,
                "counts": {k: sum(s.status == k for s in self.steps) for k in STATUS},
                "steps": [asdict(s) for s in self.steps],
            },
            indent=2,
        )


# ---- guards -------------------------------------------------------------------------------


def validate_config(cfg: Config, env: dict[str, str]) -> str:
    """Return the validated host or raise GuardError. Local self-test skips the host allowlist."""
    parts = urlsplit(cfg.base_url)
    host = parts.hostname or ""
    if cfg.target_kind == "hosted":
        if parts.scheme != "https":
            raise GuardError("Hosted acceptance requires an https base URL")
        allowed = {
            h.strip().lower()
            for h in env.get("NUA_ACCEPT_ALLOWED_HOSTS", "").split(",")
            if h.strip()
        }
        if host.lower() not in allowed:
            raise GuardError("Host is not in NUA_ACCEPT_ALLOWED_HOSTS")
        if env.get("NUA_ACCEPT_CONFIRM_HOST", "").strip().lower() != host.lower():
            raise GuardError("NUA_ACCEPT_CONFIRM_HOST must repeat the target host exactly")
    domain = cfg.email_domain.strip().lower()
    if not domain or "." not in domain:
        raise GuardError(
            "NUA_ACCEPT_EMAIL_DOMAIN is required (a domain you control, or a reserved one)"
        )
    if domain in PUBLIC_MAILBOX_DOMAINS:
        raise GuardError("Synthetic emails must not use a public mailbox provider")
    return host


def synthetic_email(label: str, domain: str, run_id: str) -> str:
    return f"accept-{run_id}-{label}@{domain}"


def valid_abn(abn: str) -> bool:
    if not re.fullmatch(r"\d{11}", abn):
        return False
    digits = [int(c) for c in abn]
    digits[0] -= 1
    weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
    return sum(d * w for d, w in zip(digits, weights, strict=True)) % 89 == 0


def synthetic_abn(seed: str) -> str:
    """A well-formed (checksum-valid) ABN derived from the run id. Well-formed != owned by anyone."""
    n = int(hashlib.sha256(seed.encode()).hexdigest(), 16) % 1_000_000_000
    body = f"{n:09d}"
    for prefix in range(10, 100):
        if valid_abn(f"{prefix}{body}"):
            return f"{prefix}{body}"
    raise RuntimeError("no check digits found")  # pragma: no cover


def classify(resp: httpx.Response | None, exc: Exception | None = None) -> str:
    """Name what a non-healthy response actually is, so a Vercel failure is not called an app bug."""
    if exc is not None:
        return f"network error ({type(exc).__name__})"
    assert resp is not None
    h = {k.lower(): v for k, v in resp.headers.items()}
    if h.get("x-vercel-error") == "FUNCTION_INVOCATION_FAILED":
        return "function crashed at startup (FUNCTION_INVOCATION_FAILED)"
    if resp.status_code in (401, 403) and (
        "_vercel_sso" in resp.text or "Authentication Required" in resp.text
    ):
        return "Vercel deployment-protection challenge (no authorised identity)"
    if resp.status_code == 404:
        return "404 not found"
    if resp.status_code == 503:
        return "503 service unavailable (dependency down or fail-closed guard)"
    if resp.status_code >= 500:
        return f"{resp.status_code} server error"
    return f"HTTP {resp.status_code}"


# ---- runner -------------------------------------------------------------------------------


class Runner:
    def __init__(
        self,
        cfg: Config,
        client: httpx.AsyncClient,
        run_id: str | None = None,
        token_provider: Callable[[str], str | None] | None = None,
    ) -> None:
        # token_provider(email) -> verification token. Default reads NUA_ACCEPT_TOKEN_FILE.
        self.token_provider = token_provider
        self.cfg = cfg
        self.http = client
        self.run_id = run_id or secrets.token_hex(3)
        self.password = secrets.token_urlsafe(18) + "Aa1!"  # per-run, in memory only
        self.report = Report(
            cfg.target_kind,
            urlsplit(cfg.base_url).hostname or "",
            time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        )
        self.tokens: dict[str, str] = {}
        self.emails: dict[str, str] = {}
        self.cleanup_jobs: list[tuple[str, str, str]] = []  # (employer_id, job_id, label)

    # -- plumbing
    def _h(self, who: str | None = None, **extra: str) -> dict[str, str]:
        h = dict(extra)
        if self.cfg.bypass_secret:
            h["x-vercel-protection-bypass"] = self.cfg.bypass_secret
        if who and who in self.tokens:
            h["Authorization"] = f"Bearer {self.tokens[who]}"
        return h

    async def call(
        self, method: str, path: str, who: str | None = None, **kw: Any
    ) -> httpx.Response:
        headers = self._h(who, **kw.pop("headers", {}))
        return await self.http.request(
            method, path, headers=headers, timeout=self.cfg.timeout_s, **kw
        )

    def step(self, id_: str, title: str, ok: bool, detail_fail: str = "") -> bool:
        return self.report.add(id_, title, "passed" if ok else "failed", "" if ok else detail_fail)

    def blocked(self, id_: str, title: str, why: str) -> None:
        self.report.add(id_, title, "blocked", why)

    # -- phases
    async def preflight(self) -> bool:
        for path, sid in (("/healthz", "pre.health"), ("/readyz", "pre.ready")):
            try:
                r = await self.call("GET", path)
                ok = r.status_code == 200
                if not self.step(sid, f"GET {path} is 200", ok, classify(r)):
                    return False
            except httpx.HTTPError as exc:
                self.step(sid, f"GET {path} is 200", False, classify(None, exc))
                return False
        return True

    async def markets(self) -> None:
        r = await self.call("GET", "/v1/markets")
        if r.status_code != 200:
            self.step("mkt.list", "Market catalogue readable", False, classify(r))
            return
        by = {m["country_code"]: m for m in r.json()}
        au = by.get("AU", {}).get("capabilities", {})
        nz = by.get("NZ", {}).get("capabilities", {})
        self.step("mkt.au", "AU market present", "AU" in by, "AU missing")
        self.step(
            "mkt.nz_disabled",
            "NZ has no transactional capability (onboarding/publishing/billing off)",
            not (nz.get("onboarding") or nz.get("job_publishing") or nz.get("billing")),
            "NZ exposes a transactional capability",
        )
        # The reported AU stage/capabilities are informational (publishing is owner-gated); not asserted.
        self.report.add(
            "mkt.au_state",
            "AU market stage reported",
            "passed",
            f"stage={by.get('AU', {}).get('stage')} publishing={bool(au.get('job_publishing'))}",
        )

    async def unauthenticated_denied(self) -> None:
        for sid, method, path in (
            ("neg.noauth.me", "GET", "/v1/auth/me"),
            ("neg.noauth.employer", "GET", "/v1/employers"),
            (
                "neg.noauth.apply",
                "POST",
                "/v1/jobs/00000000-0000-0000-0000-000000000000/applications",
            ),
            ("neg.noauth.admin", "GET", "/v1/admin/employers"),
        ):
            r = await self.call(method, path, json={} if method == "POST" else None)
            self.step(
                sid,
                f"{method} {path} without identity is refused",
                r.status_code in (401, 403),
                f"got {r.status_code}",
            )

    async def register(
        self, label: str, role: str, org: str | None = None
    ) -> tuple[bool, dict[str, Any]]:
        email = synthetic_email(label, self.cfg.email_domain, self.run_id)
        self.emails[label] = email
        body: dict[str, Any] = {
            "email": email,
            "password": self.password,
            "full_name": f"Acceptance {label}",
            "accept_terms": True,
        }
        if role == "employer":
            body |= {
                "abn": synthetic_abn(f"{self.run_id}-{label}"),
                "organisation_name": org or f"Acceptance {label}",
                "location": {
                    "name": "Main",
                    "suburb": "Fitzroy",
                    "state": "VIC",
                    "postcode": "3065",
                },
            }
        r = await self.call("POST", f"/v1/auth/register/{role}", json=body)
        if r.status_code == 201:
            self.tokens[label] = r.json()["access_token"]
            return True, body
        return False, {"status": r.status_code, "code": _code(r), "body": body}

    async def registration(self) -> bool:
        ok, info = await self.register("cand-a", "candidate")
        if not ok:
            code = info.get("code")
            if code == "registration_closed":
                self.blocked(
                    "reg.candidate",
                    "Candidate registration",
                    f"registration is closed; allowlist {self.emails['cand-a'].split('@')[1]!r} for the run (NUA_REGISTRATION_ALLOWLIST)",
                )
            else:
                self.step(
                    "reg.candidate",
                    "Candidate registers",
                    False,
                    f"status {info.get('status')} code {code}",
                )
            return False
        self.step("reg.candidate", "Candidate registers", True)
        ok, info = await self.register("emp-a", "employer")
        if not ok:
            if info.get("code") == "registration_closed":
                self.blocked(
                    "reg.employer",
                    "Employer registration",
                    "registration is closed for this identity",
                )
            else:
                self.step(
                    "reg.employer",
                    "Employer registers (valid ABN)",
                    False,
                    f"status {info.get('status')} code {info.get('code')}",
                )
            return False
        self.step("reg.employer", "Employer registers (valid ABN)", True)
        body = info
        # duplicates / invalid input
        dup_email = await self.call(
            "POST",
            "/v1/auth/register/candidate",
            json={
                "email": self.emails["cand-a"],
                "password": self.password,
                "full_name": "Dup",
                "accept_terms": True,
            },
        )
        self.step(
            "neg.dup_email",
            "Duplicate account email is rejected",
            dup_email.status_code in (409, 422),
            f"got {dup_email.status_code}",
        )
        dup_abn = await self.call(
            "POST",
            "/v1/auth/register/employer",
            json={**body, "email": synthetic_email("emp-dup", self.cfg.email_domain, self.run_id)},
        )
        self.step(
            "neg.dup_abn",
            "Duplicate ABN is rejected",
            dup_abn.status_code == 409,
            f"got {dup_abn.status_code}",
        )
        bad_abn = await self.call(
            "POST",
            "/v1/auth/register/employer",
            json={
                **body,
                "abn": "12345678901",
                "email": synthetic_email("emp-bad", self.cfg.email_domain, self.run_id),
            },
        )
        self.step(
            "neg.bad_abn",
            "Invalid ABN checksum is rejected",
            bad_abn.status_code == 422,
            f"got {bad_abn.status_code}",
        )
        no_terms = await self.call(
            "POST",
            "/v1/auth/register/candidate",
            json={
                "email": synthetic_email("noterms", self.cfg.email_domain, self.run_id),
                "password": self.password,
                "full_name": "No Terms",
                "accept_terms": False,
            },
        )
        self.step(
            "neg.no_terms",
            "Registration without accepting terms is rejected",
            no_terms.status_code == 422,
            f"got {no_terms.status_code}",
        )
        return True

    def _token_for(self, label: str) -> str | None:
        if self.token_provider is not None:
            return self.token_provider(self.emails[label])
        path = self.cfg.token_file
        if not path or not Path(path).is_file():
            return None
        try:
            return json.loads(Path(path).read_text()).get(self.emails[label])
        except (OSError, ValueError):
            return None

    async def email_verification(self) -> dict[str, bool]:
        verified: dict[str, bool] = {}
        for label in ("cand-a", "emp-a"):
            me = await self.call("GET", "/v1/auth/me", who=label)
            if me.status_code != 200 or me.json().get("email_verified"):
                verified[label] = me.status_code == 200 and bool(me.json().get("email_verified"))
                continue
            self.step(
                f"ver.{label}.initial_unverified", f"{label} starts with email unverified", True
            )
            token = self._token_for(label)
            if token is None:
                self.blocked(
                    f"ver.{label}.confirm",
                    f"{label} confirms email",
                    "no verification token available (NUA_ACCEPT_TOKEN_FILE) and no mailbox access; staging email provider/inbox not supplied",
                )
                verified[label] = False
                continue
            r = await self.call("POST", "/v1/auth/email/verify/confirm", json={"token": token})
            ok = r.status_code == 200
            self.step(f"ver.{label}.confirm", f"{label} confirms email", ok, f"got {r.status_code}")
            if ok:
                replay = await self.call(
                    "POST", "/v1/auth/email/verify/confirm", json={"token": token}
                )
                self.step(
                    f"ver.{label}.replay",
                    "Verification token cannot be replayed",
                    replay.status_code >= 400,
                    "token accepted twice",
                )
            verified[label] = ok
        return verified

    async def employer_ctx(self, label: str) -> tuple[str, str] | None:
        me = await self.call("GET", "/v1/auth/me", who=label)
        if me.status_code != 200 or not me.json().get("memberships"):
            return None
        eid = me.json()["memberships"][0]["employer_id"]
        locs = await self.call("GET", f"/v1/employers/{eid}/locations", who=label)
        return eid, locs.json()[0]["id"] if locs.status_code == 200 and locs.json() else ""

    async def employer_verification(self) -> bool:
        ctx = await self.employer_ctx("emp-a")
        if not ctx:
            self.step("emp.ctx", "Employer membership resolves", False, "no membership")
            return False
        eid, _ = ctx
        if not (self.cfg.admin_email and self.cfg.admin_password):
            self.blocked(
                "emp.verify",
                "Admin verifies the employer",
                "no approved admin identity (NUA_ACCEPT_ADMIN_EMAIL/PASSWORD); a verification operator has not been named",
            )
            return False
        r = await self.call(
            "POST",
            "/v1/auth/login",
            json={"email": self.cfg.admin_email, "password": self.cfg.admin_password},
        )
        if r.status_code != 200:
            self.step(
                "emp.verify.login",
                "Approved admin identity can log in",
                False,
                f"got {r.status_code}",
            )
            return False
        self.tokens["admin"] = r.json()["access_token"]
        v = await self.call(
            "POST",
            f"/v1/admin/employers/{eid}/verification",
            who="admin",
            json={
                "status": "verified",
                "evidence": "Synthetic acceptance run; no real business reviewed",
            },
        )
        return self.step(
            "emp.verify",
            "Admin verifies the synthetic employer",
            v.status_code == 200,
            f"got {v.status_code}",
        )

    async def job_journey(self, can_publish: bool, cand_verified: bool) -> None:
        ctx = await self.employer_ctx("emp-a")
        if not ctx:
            return
        eid, loc = ctx
        if not can_publish:
            # Job creation itself needs a verified email; assert the gate, then stop honestly.
            probe = await self.call(
                "POST",
                f"/v1/employers/{eid}/jobs",
                who="emp-a",
                json={
                    "title": "probe",
                    "description": "x",
                    "employment_type": "casual",
                    "location_id": loc,
                },
            )
            self.step(
                "neg.unverified_employer_job",
                "Unverified employer cannot create a job",
                probe.status_code in (403, 503),
                f"got {probe.status_code}",
            )
            self.blocked(
                "job.draft",
                "Employer creates a draft job",
                "employer email/business not verified (see blocked steps above)",
            )
            return
        job = {
            "title": f"[ACCEPTANCE {self.run_id}] Barista",
            "description": "Synthetic acceptance posting. Not a real job.",
            "employment_type": "casual",
            "category": "Hospitality",
            "pay_min": "28.00",
            "pay_max": "32.00",
            "pay_period": "hour",
            "super_included": False,
            "location_id": loc,
        }
        r = await self.call("POST", f"/v1/employers/{eid}/jobs", who="emp-a", json=job)
        if not self.step(
            "job.draft",
            "Employer creates a draft job",
            r.status_code == 201,
            f"got {r.status_code} {_code(r)}",
        ):
            return
        jid = r.json()["id"]
        self.cleanup_jobs.append((eid, jid, "emp-a"))
        pub_before = await self.call("GET", f"/v1/jobs/{jid}")
        self.step(
            "job.draft_not_public",
            "A draft job is not publicly readable",
            pub_before.status_code == 404,
            f"got {pub_before.status_code}",
        )
        # cross-tenant: a second employer must not see the first employer's job
        ok2, _ = await self.register("emp-b", "employer")
        if ok2:
            ctxb = await self.employer_ctx("emp-b")
            if ctxb:
                x = await self.call("GET", f"/v1/employers/{eid}/jobs/{jid}", who="emp-b")
                self.step(
                    "idor.job",
                    "Other employer cannot read this employer's job",
                    x.status_code in (403, 404),
                    f"got {x.status_code}",
                )
                y = await self.call("POST", f"/v1/employers/{eid}/jobs/{jid}/publish", who="emp-b")
                self.step(
                    "idor.job_publish",
                    "Other employer cannot publish this employer's job",
                    y.status_code in (403, 404),
                    f"got {y.status_code}",
                )
        if not (self.cfg.allow_publish and can_publish):
            self.blocked(
                "job.publish",
                "Employer publishes the job",
                "needs --allow-publish and a verified employer with verified email"
                if not self.cfg.allow_publish
                else "employer/email not verified (see blocked steps above)",
            )
            return
        p = await self.call("POST", f"/v1/employers/{eid}/jobs/{jid}/publish", who="emp-a")
        if not self.step(
            "job.publish",
            "Employer publishes the job (invitation flags)",
            p.status_code == 200,
            f"got {p.status_code} {_code(p)}",
        ):
            return
        if not cand_verified:
            na = await self.call("POST", f"/v1/jobs/{jid}/applications", who="cand-a", json={})
            self.step(
                "neg.unverified_apply",
                "Unverified-email candidate cannot apply",
                na.status_code in (403, 409),
                f"got {na.status_code}",
            )
            self.blocked("app.apply", "Candidate applies", "candidate email not verified")
            return
        key = f"accept-{self.run_id}"
        a = await self.call(
            "POST",
            f"/v1/jobs/{jid}/applications",
            who="cand-a",
            json={"cover_note": "Synthetic"},
            headers={"Idempotency-Key": key},
        )
        if not self.step(
            "app.apply",
            "Candidate applies",
            a.status_code == 201,
            f"got {a.status_code} {_code(a)}",
        ):
            return
        aid = a.json()["id"]
        rep = await self.call(
            "POST",
            f"/v1/jobs/{jid}/applications",
            who="cand-a",
            json={"cover_note": "Synthetic"},
            headers={"Idempotency-Key": key},
        )
        self.step(
            "app.replay",
            "Replay with the same Idempotency-Key returns the same application",
            rep.status_code in (200, 201) and rep.json().get("id") == aid,
            f"got {rep.status_code}",
        )
        dup = await self.call("POST", f"/v1/jobs/{jid}/applications", who="cand-a", json={})
        self.step(
            "app.duplicate",
            "Second active application for the same job is rejected",
            dup.status_code == 409,
            f"got {dup.status_code}",
        )
        lst = await self.call("GET", f"/v1/employers/{eid}/jobs/{jid}/applications", who="emp-a")
        self.step(
            "emp.review.list",
            "Employer sees the application",
            lst.status_code == 200
            and any(x.get("id") == aid or x.get("application_id") == aid for x in lst.json()),
            f"got {lst.status_code}",
        )
        st = await self.call(
            "POST",
            f"/v1/employers/{eid}/applications/{aid}/status",
            who="emp-a",
            json={"to_status": "under_review"},
        )
        self.step(
            "emp.status",
            "Employer moves the application to under_review",
            st.status_code == 200,
            f"got {st.status_code}",
        )
        rej = await self.call(
            "POST",
            f"/v1/employers/{eid}/applications/{aid}/status",
            who="emp-a",
            json={"to_status": "rejected"},
        )
        self.step(
            "neg.reject_needs_reason",
            "Rejecting without a reason is refused (human decision)",
            rej.status_code == 422,
            f"got {rej.status_code}",
        )
        # persistence after commit: fresh login, re-read
        lg = await self.call(
            "POST",
            "/v1/auth/login",
            json={"email": self.emails["cand-a"], "password": self.password},
        )
        if lg.status_code == 200:
            self.tokens["cand-a2"] = lg.json()["access_token"]
            mine = await self.call("GET", f"/v1/candidate/applications/{aid}", who="cand-a2")
            self.step(
                "persist.candidate",
                "Candidate sees the persisted application/status on a fresh session",
                mine.status_code == 200 and mine.json().get("status") == "under_review",
                f"got {mine.status_code}",
            )
        # cross-candidate and cross-employer IDOR
        ok3, _ = await self.register("cand-b", "candidate")
        if ok3:
            x = await self.call("GET", f"/v1/candidate/applications/{aid}", who="cand-b")
            self.step(
                "idor.application_candidate",
                "Other candidate cannot read this application",
                x.status_code in (403, 404),
                f"got {x.status_code}",
            )
        if "emp-b" in self.tokens:
            x = await self.call("GET", f"/v1/employers/{eid}/applications/{aid}", who="emp-b")
            self.step(
                "idor.application_employer",
                "Other employer cannot read this application",
                x.status_code in (403, 404),
                f"got {x.status_code}",
            )
        # role escalation
        e = await self.call("GET", f"/v1/employers/{eid}/jobs", who="cand-a")
        self.step(
            "neg.role.candidate_on_employer",
            "Candidate token cannot use employer routes",
            e.status_code in (403, 404),
            f"got {e.status_code}",
        )
        e = await self.call("GET", "/v1/admin/employers", who="emp-a")
        self.step(
            "neg.role.employer_on_admin",
            "Employer token cannot use admin routes",
            e.status_code in (401, 403),
            f"got {e.status_code}",
        )

    async def concurrency(self, can_publish: bool, cand_verified: bool) -> None:
        """Parallel applications by one candidate to one job: exactly one may succeed."""
        if not (self.cfg.allow_publish and can_publish and cand_verified) or not self.cleanup_jobs:
            self.blocked(
                "conc.apply",
                "Concurrent applications yield exactly one",
                "needs a published job and verified candidate",
            )
            return
        eid, jid, _ = self.cleanup_jobs[0]
        ok, _ = await self.register("cand-c", "candidate")
        tok = self._token_for("cand-c")
        if not ok or tok is None:
            self.blocked(
                "conc.apply",
                "Concurrent applications yield exactly one",
                "second verified candidate unavailable (no verification token)",
            )
            return
        if (
            await self.call("POST", "/v1/auth/email/verify/confirm", json={"token": tok})
        ).status_code != 200:
            self.blocked(
                "conc.apply",
                "Concurrent applications yield exactly one",
                "second candidate could not be verified",
            )
            return
        rs = await asyncio.gather(
            *[
                self.call("POST", f"/v1/jobs/{jid}/applications", who="cand-c", json={})
                for _ in range(6)
            ]
        )
        created = sum(r.status_code == 201 for r in rs)
        self.step(
            "conc.apply",
            "Concurrent applications yield exactly one application",
            created == 1 and all(r.status_code in (201, 200, 409, 429) for r in rs),
            f"created={created} statuses={sorted(r.status_code for r in rs)}",
        )

    async def cleanup(self) -> None:
        for eid, jid, who in self.cleanup_jobs:
            r = await self.call("POST", f"/v1/employers/{eid}/jobs/{jid}/close", who=who)
            self.step(
                "cleanup.close_job",
                "Synthetic job is closed again",
                r.status_code in (200, 409),
                f"got {r.status_code}",
            )
        for label in ("cand-a", "cand-b", "cand-c"):
            if label in self.tokens:
                r = await self.call(
                    "DELETE", "/v1/account", who=label, json={"password": self.password}
                )
                self.step(
                    f"cleanup.delete.{label}",
                    f"Synthetic candidate {label} erased",
                    r.status_code == 204,
                    f"got {r.status_code}",
                )
        self.report.add(
            "cleanup.employers",
            "Synthetic employer accounts",
            "blocked",
            "business accounts close through support (API refuses self-delete); remove the tenant per the staging teardown runbook",
        )

    async def not_run(self) -> None:
        for sid, title, why in (
            (
                "not_run.rls_forced",
                "Forced RLS on every tenant table",
                "needs database access; run db/roles/neon_bootstrap.sql -v post_migration=1 (61 RLS tables)",
            ),
            (
                "not_run.redis_missing",
                "Missing Redis fails closed",
                "config-level; covered by API tests (test_ratelimit), cannot be toggled on a hosted stack without changing env",
            ),
            (
                "not_run.email_missing",
                "Missing email provider fails closed",
                "config-level; covered by API unit tests, not toggled on hosted",
            ),
            (
                "not_run.invalid_redirect",
                "Invalid redirect rejected",
                "web layer; covered by Playwright specs, not this API runner",
            ),
            (
                "not_run.upload_disallowed",
                "Unscanned upload disallowed",
                "document upload not exercised by this runner",
            ),
        ):
            self.report.add(sid, title, "blocked", why)

    async def run(self) -> Report:
        if not await self.preflight():
            self.blocked(
                "all.journey",
                "Hiring journey and negatives",
                "API is not healthy; every dependent step is blocked",
            )
            return self.report
        await self.markets()
        await self.unauthenticated_denied()
        try:
            if await self.registration():
                ver = await self.email_verification()
                emp_ok = await self.employer_verification()
                can_publish = emp_ok and ver.get("emp-a", False)
                await self.job_journey(can_publish, ver.get("cand-a", False))
                await self.concurrency(can_publish, ver.get("cand-a", False))
        finally:
            await self.cleanup()
        await self.not_run()
        return self.report


def _code(r: httpx.Response) -> str:
    try:
        j = r.json()
        return str(j.get("error", {}).get("code") or j.get("code") or j.get("detail") or "")[:60]
    except ValueError:
        return ""


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--base-url", required=True)
    ap.add_argument("--out", default="staging-acceptance-report.json")
    ap.add_argument("--allow-publish", action="store_true")
    args = ap.parse_args(argv)
    env = dict(os.environ)
    cfg = Config(
        base_url=args.base_url.rstrip("/"),
        allow_publish=args.allow_publish,
        email_domain=env.get("NUA_ACCEPT_EMAIL_DOMAIN", ""),
        token_file=env.get("NUA_ACCEPT_TOKEN_FILE"),
        admin_email=env.get("NUA_ACCEPT_ADMIN_EMAIL"),
        admin_password=env.get("NUA_ACCEPT_ADMIN_PASSWORD"),
        bypass_secret=env.get("NUA_ACCEPT_BYPASS_SECRET"),
    )
    try:
        validate_config(cfg, env)
    except GuardError as exc:
        print(f"REFUSED: {exc}", file=sys.stderr)
        return 3

    async def go() -> Report:
        async with httpx.AsyncClient(base_url=cfg.base_url) as client:
            return await Runner(cfg, client).run()

    report = asyncio.run(go())
    Path(args.out).write_text(report.to_json())
    c = {k: sum(s.status == k for s in report.steps) for k in STATUS}
    print(
        f"{report.target_kind} {report.host}: passed={c['passed']} failed={c['failed']} blocked={c['blocked']} -> {args.out}"
    )
    return 1 if c["failed"] else (2 if c["blocked"] else 0)


if __name__ == "__main__":
    raise SystemExit(main())
