"""InspectMode：查看模式枚举（与前端 constants/inspectMode.ts 一一对应）。"""
from enum import Enum


class InspectMode(str, Enum):
    SOLID = "solid"
    WIREFRAME = "wireframe"
    NORMALS = "normals"
    UV = "uv"
    MATERIAL = "material"


INSPECT_MODES = [m.value for m in InspectMode]
MODE_LABELS = {
    InspectMode.SOLID: "实体",
    InspectMode.WIREFRAME: "线框",
    InspectMode.NORMALS: "法线",
    InspectMode.UV: "UV 检查",
    InspectMode.MATERIAL: "材质",
}
