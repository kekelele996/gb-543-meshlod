"""命名卷内的产物布局：assets/ 与 runs/。"""
from pathlib import Path

from app.config.settings import settings


def artifact_root() -> Path:
    root = Path(settings.ARTIFACT_DIR)
    root.mkdir(parents=True, exist_ok=True)
    return root


def asset_path(relative: str) -> Path:
    return artifact_root() / relative


def ensure_dirs() -> None:
    root = artifact_root()
    (root / "assets").mkdir(parents=True, exist_ok=True)
    (root / "thumbs").mkdir(parents=True, exist_ok=True)
    (root / "runs").mkdir(parents=True, exist_ok=True)


def rel(path: Path) -> str:
    return str(path.relative_to(artifact_root()))
