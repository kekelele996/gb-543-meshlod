/** 共享 Three.js 视口：/assets/:id 与 /runs/:id 共用；卸载时 dispose 几何与材质。 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useMeshLoader } from '../../hooks/useMeshLoader';
import { computeStats, type GeometryStats } from '../../utils/meshStats';
import { cssVar, tokenRgb } from '../../utils/colors';
import type { InspectMode } from '../../constants/inspectMode';
import type { MeshFormat } from '../../constants/meshFormat';

export type CameraPreset = 'iso' | 'front' | 'top';

interface MeshViewportProps {
  meshUrl: string | null;
  format?: MeshFormat;
  inspectMode: InspectMode;
  wireframeOverlay?: boolean;
  cameraPreset?: CameraPreset;
  onStats?: (stats: GeometryStats) => void;
  caption?: string;
  emptyHint?: string;
}

function checkerTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const paper = cssVar('--paper') || 'oklch(0.96 0.01 240)';
  const rule = cssVar('--rule') || 'oklch(0.62 0.03 245)';
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = rule;
  const cell = size / 8;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      if ((x + y) % 2 === 0) ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

function buildMaterial(mode: InspectMode, hasUv: boolean): THREE.Material {
  const inkRgb = tokenRgb('--ink');
  const blueRgb = tokenRgb('--blue');
  const base = new THREE.Color(blueRgb[0] * 0.55 + inkRgb[0] * 0.45, blueRgb[1] * 0.55 + inkRgb[1] * 0.45, blueRgb[2] * 0.55 + inkRgb[2] * 0.45);
  switch (mode) {
    case 'wireframe':
      return new THREE.MeshBasicMaterial({ color: new THREE.Color(...inkRgb), wireframe: true });
    case 'normals':
      return new THREE.MeshNormalMaterial({ flatShading: false });
    case 'uv':
      return new THREE.MeshBasicMaterial({ map: hasUv ? checkerTexture() : null, color: new THREE.Color(...inkRgb) });
    case 'material':
      return new THREE.MeshStandardMaterial({ color: base, metalness: 0.08, roughness: 0.72, flatShading: false });
    case 'solid':
    default:
      return new THREE.MeshStandardMaterial({ color: base, metalness: 0.05, roughness: 0.68 });
  }
}

function rotateFor(preset: CameraPreset): { yaw: number; pitch: number } {
  if (preset === 'front') return { yaw: 0, pitch: 0 };
  if (preset === 'top') return { yaw: 0, pitch: Math.PI / 2 };
  return { yaw: Math.PI / 6, pitch: Math.PI / 8 };
}

function drawSoftwarePreview(
  canvas: HTMLCanvasElement,
  geometry: THREE.BufferGeometry,
  mode: InspectMode,
  preset: CameraPreset,
  width: number,
  height: number,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = Math.max(Math.floor(width), 1);
  canvas.height = Math.max(Math.floor(height), 1);
  const paper = tokenRgb('--paper');
  const ink = tokenRgb('--rule');
  const blue = tokenRgb('--blue');
  const bg = `rgb(${Math.round(paper[0] * 255)}, ${Math.round(paper[1] * 255)}, ${Math.round(paper[2] * 255)})`;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const positions = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const uvAttr = geometry.getAttribute('uv');
  const normals = geometry.getAttribute('normal');
  if (!positions) return;
  const faceCount = index ? index.count / 3 : positions.count / 3;
  const stride = Math.max(1, Math.ceil(faceCount / 200000));
  const { yaw, pitch } = rotateFor(preset);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const pts: [number, number, number][] = [];
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    pts.push([x1, y2, z2]);
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const scale = Math.min(canvas.width / spanX, canvas.height / spanY) * 0.82;
  const offsetX = canvas.width / 2 - ((minX + maxX) / 2) * scale;
  const offsetY = canvas.height / 2 + ((minY + maxY) / 2) * scale;

  interface DrawFace { depth: number; path: [number, number][]; shade: number; u: number }
  const faces: DrawFace[] = [];
  for (let f = 0; f < faceCount; f += stride) {
    const ia = index ? index.getX(f * 3) : f * 3;
    const ib = index ? index.getX(f * 3 + 1) : f * 3 + 1;
    const ic = index ? index.getX(f * 3 + 2) : f * 3 + 2;
    const a = pts[ia];
    const b = pts[ib];
    const c = pts[ic];
    if (!a || !b || !c) continue;
    const depth = (a[2] + b[2] + c[2]) / 3;
    let nx = 0.35;
    let ny = 0.45;
    let nz = 0.82;
    if (normals) {
      nx = (normals.getX(ia) + normals.getX(ib) + normals.getX(ic)) / 3;
      ny = (normals.getY(ia) + normals.getY(ib) + normals.getY(ic)) / 3;
      nz = (normals.getZ(ia) + normals.getZ(ib) + normals.getZ(ic)) / 3;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
    }
    // 法线随相机旋转，再与固定光照方向点乘，得到可见的立体明暗
    const rnx = nx * cy + nz * sy;
    const rnz1 = -nx * sy + nz * cy;
    const rny2 = ny * cp - rnz1 * sp;
    const rnz2 = ny * sp + rnz1 * cp;
    const light = rnx * 0.34 + rny2 * 0.48 + rnz2 * 0.81;
    const shade = Math.max(0.12, Math.min(1, 0.5 + 0.62 * light));
    const u = uvAttr ? (uvAttr.getX(ia) + uvAttr.getX(ib) + uvAttr.getX(ic)) / 3 : f * 0.017;
    faces.push({
      depth,
      shade,
      u,
      path: [
        [a[0] * scale + offsetX, -a[1] * scale + offsetY],
        [b[0] * scale + offsetX, -b[1] * scale + offsetY],
        [c[0] * scale + offsetX, -c[1] * scale + offsetY],
      ],
    });
  }
  faces.sort((left, right) => left.depth - right.depth);
  for (const face of faces) {
    ctx.beginPath();
    ctx.moveTo(face.path[0][0], face.path[0][1]);
    ctx.lineTo(face.path[1][0], face.path[1][1]);
    ctx.lineTo(face.path[2][0], face.path[2][1]);
    ctx.closePath();
    if (mode === 'wireframe') {
      ctx.strokeStyle = `rgba(${Math.round(ink[0] * 255)}, ${Math.round(ink[1] * 255)}, ${Math.round(ink[2] * 255)}, 0.85)`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
      continue;
    }
    if (mode === 'normals') {
      const r = Math.round(120 + 120 * ((face.shade * 0.7) % 1));
      const g = Math.round(90 + 140 * ((face.depth * 7.3) % 1));
      ctx.fillStyle = `rgb(${r}, ${g}, 200)`;
    } else if (mode === 'uv') {
      const checker = Math.floor(face.u * 8) % 2 === 0;
      ctx.fillStyle = checker
        ? `rgba(${Math.round(ink[0] * 255)}, ${Math.round(ink[1] * 255)}, ${Math.round(ink[2] * 255)}, 0.55)`
        : `rgba(${Math.round(blue[0] * 255)}, ${Math.round(blue[1] * 255)}, ${Math.round(blue[2] * 255)}, 0.35)`;
    } else {
      // 纸蓝底上的墨蓝灰，明暗随法线变化（制图室风格，而不是 3D 渲染塑料感）
      const baseR = 0.1 * blue[0] + 0.9 * 0.52;
      const baseG = 0.1 * blue[1] + 0.9 * 0.55;
      const baseB = 0.1 * blue[2] + 0.9 * 0.6;
      const value = 0.42 + 0.58 * face.shade;
      ctx.fillStyle = `rgb(${Math.round(255 * Math.min(1, baseR * value))}, ${Math.round(
        255 * Math.min(1, baseG * value),
      )}, ${Math.round(255 * Math.min(1, baseB * value))})`;
    }
    ctx.fill();
  }
}

export default function MeshViewport({
  meshUrl,
  format,
  inspectMode,
  wireframeOverlay = false,
  cameraPreset = 'iso',
  onStats,
  caption,
  emptyHint,
}: MeshViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const overlayRef = useRef<THREE.LineSegments | null>(null);
  const radiusRef = useRef(1);
  const fallbackRef = useRef<HTMLCanvasElement>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const { geometry, error, loading, hasUv } = useMeshLoader(meshUrl, format);

  const stats = useMemo(() => (geometry ? computeStats(geometry) : null), [geometry]);

  // 初始化 renderer / scene / camera
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch (webglError) {
      setWebglFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const paperRgb = tokenRgb('--paper');
    renderer.setClearColor(new THREE.Color(...paperRgb), 1);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 5000);
    camera.position.set(2.2, 1.6, 2.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.5;

    const ambient = new THREE.AmbientLight(new THREE.Color(...tokenRgb('--paper')), 1.1);
    const key = new THREE.DirectionalLight(new THREE.Color(1, 1, 1), 2.1);
    key.position.set(3, 6, 4);
    const fill = new THREE.DirectionalLight(new THREE.Color(...tokenRgb('--rule')), 0.9);
    fill.position.set(-4, -2, -3);
    scene.add(ambient, key, fill);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    controlsRef.current = controls;

    const resize = () => {
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let frame = 0;
    const animate = () => {
      frame = window.requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      if (meshRef.current) {
        meshRef.current.geometry.dispose();
        const material = meshRef.current.material as THREE.Material;
        material.dispose();
        if ((material as THREE.MeshBasicMaterial).map) {
          (material as THREE.MeshBasicMaterial).map?.dispose();
        }
      }
      if (overlayRef.current) {
        overlayRef.current.geometry.dispose();
        (overlayRef.current.material as THREE.Material).dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      meshRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  // 几何体切换
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!scene || !camera || !controls) return;

    if (meshRef.current) {
      scene.remove(meshRef.current);
      meshRef.current.geometry.dispose();
      (meshRef.current.material as THREE.Material).dispose();
      meshRef.current = null;
    }
    if (overlayRef.current) {
      scene.remove(overlayRef.current);
      overlayRef.current.geometry.dispose();
      (overlayRef.current.material as THREE.Material).dispose();
      overlayRef.current = null;
    }
    if (!geometry || !stats) return;

    const mesh = new THREE.Mesh(geometry, buildMaterial(inspectMode, hasUv));
    scene.add(mesh);
    meshRef.current = mesh;

    if (wireframeOverlay) {
      const wire = new THREE.WireframeGeometry(geometry);
      const overlay = new THREE.LineSegments(
        wire,
        new THREE.LineBasicMaterial({ color: new THREE.Color(...tokenRgb('--rule')), transparent: true, opacity: 0.35 }),
      );
      scene.add(overlay);
      overlayRef.current = overlay;
    }

    radiusRef.current = stats.radius;
    const distance = stats.radius * 3.1;
    camera.position.set(distance * 0.6, distance * 0.5, distance * 0.6);
    camera.near = Math.max(stats.radius / 1000, 0.001);
    camera.far = stats.radius * 100;
    camera.updateProjectionMatrix();
    const center = new THREE.Vector3(
      (stats.bbox.min[0] + stats.bbox.max[0]) / 2,
      (stats.bbox.min[1] + stats.bbox.max[1]) / 2,
      (stats.bbox.min[2] + stats.bbox.max[2]) / 2,
    );
    controls.target.copy(center);
    controls.update();
    onStats?.({ ...stats });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry, stats?.triangles, hasUv]);

  // 检查模式切换
  useEffect(() => {
    if (!meshRef.current) return;
    const material = meshRef.current.material as THREE.Material;
    material.dispose();
    meshRef.current.material = buildMaterial(inspectMode, hasUv);
  }, [inspectMode, hasUv]);

  // 相机预设
  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const distance = radiusRef.current * 3.1;
    if (cameraPreset === 'front') camera.position.set(0, 0, distance);
    else if (cameraPreset === 'top') camera.position.set(0, distance, 0.001);
    else camera.position.set(distance * 0.6, distance * 0.5, distance * 0.6);
    controls.update();
  }, [cameraPreset]);

  // WebGL 不可用时的软件渲染回退（无 GPU 的 headless 环境 / 老显卡）
  useEffect(() => {
    const canvas = fallbackRef.current;
    if (!webglFailed || !canvas || !geometry) return;
    const container = containerRef.current;
    const draw = () => {
      const width = container?.clientWidth ?? 640;
      const height = container?.clientHeight ?? 480;
      drawSoftwarePreview(canvas, geometry, inspectMode, cameraPreset, width, height);
    };
    draw();
    const observer = new ResizeObserver(draw);
    if (container) observer.observe(container);
    if (stats) onStats?.({ ...stats });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webglFailed, geometry, inspectMode, cameraPreset]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      {webglFailed ? <canvas ref={fallbackRef} className="absolute inset-0 h-full w-full" /> : null}
      {webglFailed ? (
        <div className="pointer-events-none absolute bottom-2 right-3 num text-[9px] uppercase tracking-[0.12em] text-ink/35">
          software preview · webgl unavailable
        </div>
      ) : null}
      {caption ? (
        <div className="pointer-events-none absolute left-4 top-3 num text-[10px] uppercase tracking-[0.14em] text-ink/55">
          {caption}
        </div>
      ) : null}
      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="num text-[11px] text-ink/60">LOADING GEOMETRY…</span>
        </div>
      ) : null}
      {!loading && !geometry && emptyHint ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 text-center">
          <span className="max-w-xs text-[12px] leading-5 text-ink/55">{emptyHint}</span>
        </div>
      ) : null}
      {error ? (
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 border border-engineering/60 bg-[var(--red-wash)] px-3 py-2">
          <span className="num text-[10px] text-engineering">{error}</span>
        </div>
      ) : null}
    </div>
  );
}
