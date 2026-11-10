"""Quota schema。"""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class QuotaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    max_upload_mb: int
    max_concurrent_runs: int
    used_runs: int
    window_start: datetime
    remaining_runs: int = 0
