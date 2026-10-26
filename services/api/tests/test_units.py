import uuid
from decimal import Decimal

import pytest

from app.abn import is_valid_abn_checksum, normalise_abn
from app.errors import ApiError
from app.security import create_access_token, decode_access_token, hash_password, verify_password
from app.services.matching import CandidateCtx, JobCtx, compute_match
from app.services.url_guard import assert_safe_url


def job(**o):
    base = dict(
        skills={"barista", "latte art"},
        employment_type="casual",
        suburb="Fitzroy",
        state="VIC",
        postcode="3065",
        pay_max=Decimal("32"),
        pay_period="hour",
        pay_basis="disclosed",
    )
    return JobCtx(**{**base, **o})


def cand(**o):
    base = dict(
        skills={"barista"},
        preferred_types=["casual"],
        suburb="Fitzroy",
        state="VIC",
        postcode="3065",
        min_hourly_pay=Decimal("30"),
    )
    return CandidateCtx(**{**base, **o})


def test_match_is_renormalised_over_evaluated_components_only():
    r = compute_match(job(), cand())
    evaluated = {c.key for c in r.components if c.evaluated}
    assert evaluated == {"skills", "commute", "salary", "preference"}
    # skills 0.5*25 + commute 1*10 + salary 1*10 + preference 1*5 = 37.5 / 50
    assert r.estimate == 75.0
    assert r.missing_skills == ["latte art"]
    assert all(c.basis == "not_evaluated" for c in r.components if not c.evaluated)


def test_match_never_invents_scores_when_data_missing():
    r = compute_match(
        job(skills=set(), suburb=None, pay_max=None, pay_period=None),
        cand(preferred_types=[], min_hourly_pay=None),
    )
    assert r.estimate is None and not any(c.evaluated for c in r.components)


def test_salary_normalises_period_and_flags_estimates():
    r = compute_match(
        job(pay_max=Decimal("78000"), pay_period="year", pay_basis="estimated"), cand()
    )
    sal = next(c for c in r.components if c.key == "salary")
    assert sal.score == 1.0 and "estimated" in sal.evidence


def test_abn_checksum():
    assert is_valid_abn_checksum("51 824 753 556")
    assert not is_valid_abn_checksum("12345678901")
    assert not is_valid_abn_checksum("123")
    assert normalise_abn("51 824 753 556") == "51824753556"


@pytest.mark.parametrize(
    "url",
    [
        "http://careers.example.com/x",  # not https
        "https://evil.example.org/x",  # not allow-listed
        "https://127.0.0.1/x",  # loopback (also not allow-listed)
        "https://user:pw@careers.example.com/x",  # credentials in URL
        "file:///etc/passwd",
    ],
)
def test_url_guard_rejects(url):
    with pytest.raises(ApiError):
        assert_safe_url(url, {"careers.example.com"}, resolve=False)


@pytest.mark.parametrize(
    "ip", ["127.0.0.1", "10.0.0.5", "169.254.169.254", "192.168.1.1", "::1", "0.0.0.0"]
)
def test_url_guard_rejects_private_literals_even_if_allow_listed(ip):
    host = f"[{ip}]" if ":" in ip else ip
    with pytest.raises(ApiError):
        assert_safe_url(f"https://{host}/x", {ip}, resolve=False)


def test_url_guard_accepts_allow_listed_host_without_dns():
    assert_safe_url("https://careers.example.com/jobs/1", {"careers.example.com"}, resolve=False)


def test_tokens():
    uid = uuid.uuid4()
    claims = decode_access_token(create_access_token(uid, "candidate"))
    assert claims["sub"] == str(uid) and claims["role"] == "candidate"
    with pytest.raises(ApiError):
        decode_access_token(create_access_token(uid, "candidate")[:-3] + "abc")


def test_password_hashing():
    h = hash_password("a-long-enough-password")
    assert verify_password("a-long-enough-password", h)
    assert not verify_password("another-password-1", h)
    assert not verify_password("anything", None)
