"""运行路由：发起/取消/重试要求 artist+，viewer 只读。"""
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers import run_controller
from app.middlewares.auth import get_current_user
from app.models.user import User
from app.schemas.run import RunCreate

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("")
def list_runs(
    status: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return run_controller.list_runs(db, status, limit)


@router.post("")
def create(payload: RunCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return run_controller.create(db, user, payload)


@router.get("/{run_id}")
def detail(run_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return run_controller.detail(db, run_id)


@router.post("/{run_id}/cancel")
def cancel(run_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return run_controller.cancel(db, user, run_id)


@router.post("/{run_id}/retry")
def retry(run_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return run_controller.retry(db, user, run_id)


@router.get("/{run_id}/logs")
def logs(
    run_id: uuid.UUID,
    after_id: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return run_controller.logs(db, run_id, after_id, limit)


@router.get("/{run_id}/stats.json")
def stats(run_id: uuid.UUID, user: User = Depends(get_current_user)):
    return run_controller.stats(run_id)


@router.get("/{run_id}/events")
def events(run_id: uuid.UUID, user: User = Depends(get_current_user)):
    return StreamingResponse(
        run_controller.event_stream(run_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )
