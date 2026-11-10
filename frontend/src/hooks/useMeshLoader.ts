/** 封装 GLTFLoader / OBJLoader 的加载、缓存（同 url 不重复加载）、进度、错误。 */
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import type { MeshFormat } from '../constants/meshFormat';
import { readToken } from '../utils/request';

export interface MeshLoadState {
  geometry: THREE.BufferGeometry | null;
  error: string | null;
  loading: boolean;
  hasUv: boolean;
  cacheHit: boolean;
}

const geometryCache = new Map<string, { geometry: THREE.BufferGeometry; hasUv: boolean }>();

function extractGeometry(object: THREE.Object3D): { geometry: THREE.BufferGeometry; hasUv: boolean } {
  let found: THREE.BufferGeometry | null = null;
  let hasUv = false;
  object.traverse((child) => {
    if (!found && (child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      found = mesh.geometry as THREE.BufferGeometry;
      hasUv = Boolean((mesh.geometry as THREE.BufferGeometry).getAttribute('uv'));
    }
  });
  if (!found) throw new Error('网格里没有可渲染的 Mesh');
  return { geometry: found, hasUv };
}

function parseBuffer(buffer: ArrayBuffer, format: MeshFormat | undefined): Promise<{ geometry: THREE.BufferGeometry; hasUv: boolean }> {
  if (format === 'obj') {
    const text = new TextDecoder().decode(buffer);
    const object = new OBJLoader().parse(text);
    return Promise.resolve(extractGeometry(object));
  }
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(
      buffer,
      '',
      (gltf) => {
        try {
          resolve(extractGeometry(gltf.scene));
        } catch (error) {
          reject(error);
        }
      },
      (error) => reject(new Error(`GLB 解析失败：${String(error)}`)),
    );
  });
}

export function useMeshLoader(url: string | null, format?: MeshFormat): MeshLoadState {
  const [state, setState] = useState<MeshLoadState>({
    geometry: null,
    error: null,
    loading: Boolean(url),
    hasUv: false,
    cacheHit: false,
  });

  useEffect(() => {
    if (!url) {
      setState({ geometry: null, error: null, loading: false, hasUv: false, cacheHit: false });
      return;
    }
    const cached = geometryCache.get(url);
    if (cached) {
      setState({ geometry: cached.geometry, error: null, loading: false, hasUv: cached.hasUv, cacheHit: true });
      return;
    }
    let cancelled = false;
    setState({ geometry: null, error: null, loading: true, hasUv: false, cacheHit: false });
    const token = readToken();
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (response) => {
        if (!response.ok) throw new Error(`加载失败 (${response.status})`);
        return response.arrayBuffer();
      })
      .then((buffer) => parseBuffer(buffer, format))
      .then((result) => {
        geometryCache.set(url, result);
        if (!cancelled) {
          setState({ geometry: result.geometry, error: null, loading: false, hasUv: result.hasUv, cacheHit: false });
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setState({ geometry: null, error: error.message, loading: false, hasUv: false, cacheHit: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url, format]);

  return state;
}
