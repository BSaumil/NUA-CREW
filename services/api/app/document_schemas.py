import uuid
from datetime import date, datetime
from pathlib import PurePath
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

DocumentKind = Literal["resume", "rsa", "food_safety", "first_aid", "qualification", "other"]
DocumentType = Literal["application/pdf", "image/jpeg", "image/png"]


class DocumentIn(BaseModel):
    kind: DocumentKind
    title: str = Field(min_length=1, max_length=160)
    filename: str = Field(min_length=1, max_length=160)
    content_type: DocumentType
    size_bytes: int = Field(gt=0, le=4 * 1024 * 1024)
    client_key: str = Field(min_length=8, max_length=80)
    issuer: str | None = Field(None, max_length=160)
    jurisdiction: Literal["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"] | None = None
    completed_on: date | None = None
    review_due_on: date | None = None

    @model_validator(mode="after")
    def validate_file(self) -> "DocumentIn":
        suffix = PurePath(self.filename).suffix.lower()
        valid = {
            "application/pdf": {".pdf"},
            "image/jpeg": {".jpg", ".jpeg"},
            "image/png": {".png"},
        }
        if suffix not in valid[self.content_type] or "/" in self.filename or "\\" in self.filename:
            raise ValueError("Choose a PDF, JPG or PNG with a matching filename")
        if any(ord(c) < 32 for c in self.filename) or not self.title.strip():
            raise ValueError("A title and safe filename are required")
        if self.kind == "resume" and self.content_type != "application/pdf":
            raise ValueError("Resume files must be PDF; paste text for other formats")
        if self.completed_on and self.review_due_on and self.review_due_on < self.completed_on:
            raise ValueError("Review date cannot precede completion")
        return self


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    kind: str
    title: str
    filename: str
    content_type: str
    size_bytes: int
    status: str
    issuer: str | None
    jurisdiction: str | None
    completed_on: date | None
    review_due_on: date | None
    scanned_at: datetime | None
    created_at: datetime
    verification: Literal["not_verified"] = "not_verified"
