"""等待数据库可连接（backend/worker 启动与 seed 前置）。"""
import logging
import time

from sqlalchemy import create_engine, text

from app.config.settings import settings

log = logging.getLogger("meshlod.wait_for_db")


def wait_for_db(timeout: int = 60) -> None:
    started = time.time()
    last_error = None
    while time.time() - started < timeout:
        try:
            engine = create_engine(settings.database_url, pool_pre_ping=True)
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            engine.dispose()
            return
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            time.sleep(2)
    raise RuntimeError(f"database not ready in {timeout}s: {last_error}")


def main() -> None:
    wait_for_db()
    print("database is ready")


if __name__ == "__main__":
    main()
