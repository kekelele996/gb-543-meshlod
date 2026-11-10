export const INSPECT_MODES = ['solid', 'wireframe', 'normals', 'uv', 'material'] as const;
export type InspectMode = (typeof INSPECT_MODES)[number];

export const INSPECT_MODE_LABELS: Record<InspectMode, string> = {
  solid: '实体',
  wireframe: '线框',
  normals: '法线',
  uv: 'UV',
  material: '材质',
};

export const INSPECT_MODE_KEYS: Record<InspectMode, string> = {
  solid: '1',
  wireframe: '2',
  normals: '3',
  uv: '4',
  material: '5',
};
