"""The acceptance runner must refuse unsafe targets before sending anything."""

import sys
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import staging_acceptance as sa  # noqa: E402

ENV = {
    "NUA_ACCEPT_ALLOWED_HOSTS": "nua-crew-api-stg.vercel.app",
    "NUA_ACCEPT_CONFIRM_HOST": "nua-crew-api-stg.vercel.app",
}


def cfg(**kw):
    base = {
        "base_url": "https://nua-crew-api-stg.vercel.app",
        "email_domain": "accept.nua-crew.example",
    }
    return sa.Config(**{**base, **kw})


def test_valid_hosted_config_passes():
    assert sa.validate_config(cfg(), ENV) == "nua-crew-api-stg.vercel.app"


@pytest.mark.parametrize(
    "kw,env",
    [
        ({"base_url": "http://nua-crew-api-stg.vercel.app"}, ENV),  # not https
        ({"base_url": "https://api.nua-crew.com.au"}, ENV),  # host not allowlisted
        ({}, {**ENV, "NUA_ACCEPT_CONFIRM_HOST": "other.vercel.app"}),  # confirm mismatch
        ({}, {"NUA_ACCEPT_ALLOWED_HOSTS": ""}),  # empty allowlist
        ({"email_domain": "gmail.com"}, ENV),  # real mailbox provider
        ({"email_domain": ""}, ENV),
    ],
)
def test_unsafe_config_is_refused(kw, env):
    with pytest.raises(sa.GuardError):
        sa.validate_config(cfg(**kw), env)


def test_synthetic_abn_is_well_formed_and_deterministic():
    abn = sa.synthetic_abn("run-1")
    assert (
        sa.valid_abn(abn) and abn == sa.synthetic_abn("run-1") and abn != sa.synthetic_abn("run-2")
    )
    assert not sa.valid_abn("12345678901")


def test_classify_names_what_failed():
    crash = httpx.Response(500, headers={"x-vercel-error": "FUNCTION_INVOCATION_FAILED"}, text="x")
    assert "crashed at startup" in sa.classify(crash)
    sso = httpx.Response(401, text="Authentication Required")
    assert "deployment-protection" in sa.classify(sso)
    assert "404" in sa.classify(httpx.Response(404))
    assert "network error" in sa.classify(None, httpx.ConnectError("x"))


def test_report_is_never_accepted_with_blocked_or_failed_steps():
    r = sa.Report("hosted", "h", "t")
    assert not r.accepted  # empty
    r.add("a", "a", "passed")
    assert r.accepted
    r.add("b", "b", "blocked", "no mailbox")
    assert not r.accepted


def test_main_refuses_without_confirmation(monkeypatch, tmp_path):
    for k in ("NUA_ACCEPT_ALLOWED_HOSTS", "NUA_ACCEPT_CONFIRM_HOST"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("NUA_ACCEPT_EMAIL_DOMAIN", "accept.nua-crew.example")
    out = tmp_path / "r.json"
    assert sa.main(["--base-url", "https://nua-crew-api.vercel.app", "--out", str(out)]) == 3
    assert not out.exists()


async def test_unhealthy_api_blocks_everything_and_reports_cause():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            500, headers={"x-vercel-error": "FUNCTION_INVOCATION_FAILED"}, text="e"
        )

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://x.example"
    ) as c:
        report = await sa.Runner(cfg(), c).run()
    assert [s.status for s in report.steps] == ["failed", "blocked"]
    assert "crashed at startup" in report.steps[0].detail
    assert not report.accepted
