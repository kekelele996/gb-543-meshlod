"""业务异常 AppError：只携带错误码与上下文，由 error_handler 统一包装。"""
from app.constants.error_codes import get_spec


class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str | None = None,
        entity: str | None = None,
        field: str | None = None,
        status_code: int | None = None,
    ) -> None:
        spec = get_spec(code)
        self.code = code
        self.message = message or spec.message
        self.entity = entity
        self.field = field
        self.status_code = status_code or spec.status_code
        super().__init__(self.message)

    def to_payload(self, request_id: str | None = None) -> dict:
        return {
            "code": self.code,
            "message": self.message,
            "entity": self.entity,
            "field": self.field,
            "request_id": request_id,
        }
