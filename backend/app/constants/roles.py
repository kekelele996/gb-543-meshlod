"""角色枚举与权限矩阵。"""
from enum import Enum


class Role(str, Enum):
    ADMIN = "admin"
    ARTIST = "artist"
    VIEWER = "viewer"


ROLES = [r.value for r in Role]
ROLE_LABELS = {Role.ADMIN: "TA · 管线负责人", Role.ARTIST: "模型师", Role.VIEWER: "引擎组"}
# 写权限门槛：发起运行 / 新建管线
WRITE_ROLES = {Role.ADMIN.value, Role.ARTIST.value}
