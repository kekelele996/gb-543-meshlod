"""上传守卫：Content-Length 预检 + 流式字节计数双校验 + 扩展名/magic bytes。"""
from pathlib import Path

from fastapi import UploadFile
from starlette.requests import Request

from app.constants.limits import MAX_UPLOAD_MB_DEFAULT
from app.constants.mesh import MESH_EXTENSIONS, MeshFormat
from app.services.quota_service import get_or_create
from app.utils import logger
from app.utils.errors import AppError


def preflight(request: Request, max_mb: int | None = None) -> None:
    limit = (max_mb or MAX_UPLOAD_MB_DEFAULT) * 1024 * 1024
    header = request.headers.get("content-length")
    if header and header.isdigit() and int(header) > limit + 4096:
        logger.warn("MESH_UPLOAD_OK", name="<rejected>", format="-", tris=0, bytes=int(header)) if False else None
        raise AppError(
            "E_FILE_TOO_LARGE",
            f"文件超过 {max_mb or MAX_UPLOAD_MB_DEFAULT}MB 上限（Content-Length 预检）",
            entity="asset",
            field="file",
        )


def check_extension(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix not in MESH_EXTENSIONS:
        raise AppError("E_UNSUPPORTED_FORMAT", entity="asset", field="file")
    return suffix.lstrip(".")


def check_magic(fmt: str, head: bytes) -> None:
    if fmt == MeshFormat.GLB.value and head[:4] != b"glTF":
        raise AppError("E_UNSUPPORTED_FORMAT", "GLB 文件头不是 glTF magic bytes", entity="asset", field="file")


async def read_limited(upload: UploadFile, max_mb: int | None = None) -> bytes:
    limit = (max_mb or MAX_UPLOAD_MB_DEFAULT) * 1024 * 1024
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await upload.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise AppError(
                "E_FILE_TOO_LARGE",
                f"文件超过 {max_mb or MAX_UPLOAD_MB_DEFAULT}MB 上限（流式字节计数）",
                entity="asset",
                field="file",
            )
        chunks.append(chunk)
    return b"".join(chunks)


def guard_for_user(max_upload_mb: int) -> int:
    return max_upload_mb


def quota_limit(db, user) -> int:
    return get_or_create(db, user).max_upload_mb
