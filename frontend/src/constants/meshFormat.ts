export const MESH_FORMATS = ['obj', 'glb', 'gltf'] as const;
export type MeshFormat = (typeof MESH_FORMATS)[number];

export const MESH_FORMAT_LABELS: Record<MeshFormat, string> = {
  obj: 'Wavefront OBJ',
  glb: 'glTF Binary',
  gltf: 'glTF JSON',
};

export const MESH_ACCEPT = '.obj,.glb,.gltf';
