/** 屏幕空间误差公式的前端呈现（计算本身在后端完成）。 */
export const SSE_FORMULA = 'SSE(px) = geometric_error * viewport_height / (2 * distance * tan(fov_y / 2))';

export const SSE_DEFAULTS = {
  viewportHeight: 1080,
  fovYDeg: 60,
  distanceFactor: 3,
};

export function sseExplanation(radius: number): string {
  const distance = SSE_DEFAULTS.distanceFactor * radius;
  const tanHalf = Math.tan((SSE_DEFAULTS.fovYDeg * Math.PI) / 180 / 2);
  return `distance = 3R = ${distance.toFixed(3)}，tan(30°) = ${tanHalf.toFixed(4)}，H = ${
    SSE_DEFAULTS.viewportHeight
  } px`;
}
