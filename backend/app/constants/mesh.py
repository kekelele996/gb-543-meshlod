"""MeshFormat：网格格式枚举（与前端 constants/meshFormat.ts 一一对应）。"""
from enum import Enum


class MeshFormat(str, Enum):
    OBJ = "obj"
    GLB = "glb"
    GLTF = "gltf"


MESH_FORMATS = [m.value for m in MeshFormat]
MESH_EXTENSIONS = {".obj", ".glb", ".gltf"}
