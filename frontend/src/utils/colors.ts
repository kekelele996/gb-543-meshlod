/** 把 tokens.css 里的 oklch 变量转成 WebGL 可用的 RGB（组件内不出现 hex）。 */
const cache = new Map<string, [number, number, number]>();

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function cssColorToRgb(value: string): [number, number, number] {
  const cached = cache.get(value);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  let rgb: [number, number, number] = [0.5, 0.5, 0.5];
  if (ctx) {
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    rgb = [data[0] / 255, data[1] / 255, data[2] / 255];
  }
  cache.set(value, rgb);
  return rgb;
}

export function tokenRgb(name: string, fallback = 'oklch(0.5 0.02 250)'): [number, number, number] {
  const value = cssVar(name) || fallback;
  return cssColorToRgb(value);
}
