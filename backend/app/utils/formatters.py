"""多职责格式化工具：字节、比例、SSE 像素、枚举中文名、缩略路径。"""
from app.constants.asset import STATUS_LABELS as ASSET_STATUS_LABELS
from app.constants.inspect import MODE_LABELS
from app.constants.lod import STRATEGY_LABELS
from app.constants.run import STATUS_LABELS as RUN_STATUS_LABELS


def format_bytes(num: int) -> str:
    if num < 1024:
        return f"{num} B"
    if num < 1024 * 1024:
        return f"{num / 1024:.1f} KB"
    return f"{num / (1024 * 1024):.2f} MB"


def format_ratio(ratio: float) -> str:
    return f"{ratio * 100:.0f}%"


def format_sse(px: float | None) -> str:
    return "—" if px is None else f"{float(px):.3f} px"


def format_number(value: int | float | None) -> str:
    if value is None:
        return "—"
    return f"{int(value):,}"


def format_ms(ms: int | float | None) -> str:
    if ms is None:
        return "—"
    return f"{int(ms) / 1000:.2f}s"


def run_status_label(status: str) -> str:
    return RUN_STATUS_LABELS.get(status, str(status))


def asset_status_label(status: str) -> str:
    return ASSET_STATUS_LABELS.get(status, str(status))


def strategy_label(strategy: str) -> str:
    return STRATEGY_LABELS.get(strategy, str(strategy))


def inspect_mode_label(mode: str) -> str:
    return MODE_LABELS.get(mode, str(mode))


def thumb_rel(asset_id: str) -> str:
    return f"thumbs/{asset_id}.png"


def lod_rel(run_id: str, level_index: int) -> str:
    return f"runs/{run_id}/lod_{level_index}.glb"


def short_checksum(checksum: str | None) -> str:
    return (checksum or "")[:8]
