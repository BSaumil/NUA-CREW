import pytest
from pydantic import ValidationError

from app.schemas import EmployerRegister


def body(**extra):
    return {
        "email": "owner@example.com",
        "password": "long-testing-value-123",
        "full_name": "Example Owner",
        "organisation_name": "Example Cafe",
        "accept_terms": True,
        **extra,
    }


def test_web_registration_remains_the_default():
    assert EmployerRegister.model_validate(body()).client == "web"


def test_mobile_registration_preserves_device_context():
    value = EmployerRegister.model_validate(body(client="mobile", device_label="Test phone"))
    assert value.client == "mobile" and value.device_label == "Test phone"


def test_unknown_client_and_oversized_device_labels_are_rejected():
    with pytest.raises(ValidationError):
        EmployerRegister.model_validate(body(client="untrusted-client"))
    with pytest.raises(ValidationError):
        EmployerRegister.model_validate(body(client="mobile", device_label="x" * 101))
