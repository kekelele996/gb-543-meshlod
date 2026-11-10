"""认证路由。"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers import auth_controller
from app.middlewares.auth import get_current_user
from app.schemas.auth import LoginRequest, RefreshRequest
from app.schemas.user import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    result = auth_controller.login(db, payload)
    return {
        "access_token": result["access_token"],
        "refresh_token": result["refresh_token"],
        "token_type": "bearer",
        "expires_in": result["expires_in"],
        "user": UserOut.model_validate(result["user"]),
    }


@router.post("/refresh")
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    result = auth_controller.refresh(db, payload)
    return {"access_token": result["access_token"], "refresh_token": result["refresh_token"], "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def me(user=Depends(get_current_user)):
    return UserOut.model_validate(user)
