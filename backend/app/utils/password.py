"""密码哈希（bcrypt），演示密码见 README。"""
from passlib.context import CryptContext

_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
DEMO_PASSWORD = "Demo@2026"


def hash_password(raw: str) -> str:
    return _ctx.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return _ctx.verify(raw, hashed)
    except Exception:
        return False
