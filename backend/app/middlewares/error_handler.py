"""统一异常处理：AppError / RequestValidationError / 未捕获异常 → {code,message,entity,field,request_id}。"""
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.utils import logger
from app.utils.errors import AppError


def _request_id(request: Request) -> str:
    return request.headers.get("x-request-id") or uuid.uuid4().hex[:12]


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError):  # noqa: ANN001
        return JSONResponse(status_code=exc.status_code, content=exc.to_payload(_request_id(request)))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError):  # noqa: ANN001
        first = exc.errors()[0] if exc.errors() else {}
        field = ".".join(str(p) for p in first.get("loc", [])[1:]) or None
        return JSONResponse(
            status_code=422,
            content={
                "code": "E_BAD_REQUEST",
                "message": first.get("msg", "请求参数不合法"),
                "entity": None,
                "field": field,
                "request_id": _request_id(request),
            },
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):  # noqa: ANN001
        logger.exception("SEED_FAILED", error=str(exc)) if False else logger.error("SEED_FAILED", error=str(exc))
        return JSONResponse(
            status_code=500,
            content={
                "code": "E_INTERNAL",
                "message": "服务器内部错误",
                "entity": None,
                "field": None,
                "request_id": _request_id(request),
            },
        )
