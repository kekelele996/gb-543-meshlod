/** 由 BufferGeometry 计算展示用统计：仅用于前端即时展示，权威值来自 LodLevel 表。 */
import * as THREE from 'three';

export interface GeometryStats {
  vertices: number;
  triangles: number;
  bbox: { min: [number, number, number]; max: [number, number, number] };
  radius: number;
}

export function computeStats(geometry: THREE.BufferGeometry): GeometryStats {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new THREE.Box3();
  const vertices = geometry.getAttribute('position')?.count ?? 0;
  const index = geometry.getIndex();
  const triangles = index ? index.count / 3 : vertices / 3;
  const size = new THREE.Vector3();
  box.getSize(size);
  const radius = Math.max(size.length() / 2, 1e-6);
  return {
    vertices,
    triangles: Math.round(triangles),
    bbox: {
      min: [box.min.x, box.min.y, box.min.z],
      max: [box.max.x, box.max.y, box.max.z],
    },
    radius,
  };
}

export function decimationRate(baseFaces: number, currentFaces: number): number {
  if (!baseFaces) return 0;
  return Math.max(0, 1 - currentFaces / baseFaces);
}

export function geometryVertexCount(geometry: THREE.BufferGeometry): number {
  return geometry.getAttribute('position')?.count ?? 0;
}
