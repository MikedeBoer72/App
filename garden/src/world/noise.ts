// Small deterministic helpers shared by world generation.

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth value noise in [0,1]. */
export function vnoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number, oct = 4): number {
  let amp = 0.5;
  let f = 1;
  let sum = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(x * f, y * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

/**
 * Terrain height. Gentle meadow undulation, flattened near the origin so the
 * house plot and first flowers sit on level ground. Mirrored in GLSL (grass).
 */
export function groundY(x: number, z: number): number {
  const r = Math.sqrt(x * x + z * z);
  const flat = Math.min(1, Math.max(0, (r - 10) / 30));
  const h = 0.9 * Math.sin(x * 0.045) * Math.cos(z * 0.038) + 0.35 * Math.sin(x * 0.11 + z * 0.083) + 0.6 * Math.sin(z * 0.021 - 1.3);
  return h * flat * flat * (3 - 2 * flat);
}

export const GROUND_GLSL = /* glsl */ `
float groundY(vec2 p) {
  float r = length(p);
  float fl = clamp((r - 10.0) / 30.0, 0.0, 1.0);
  float h = 0.9 * sin(p.x * 0.045) * cos(p.y * 0.038) + 0.35 * sin(p.x * 0.11 + p.y * 0.083) + 0.6 * sin(p.y * 0.021 - 1.3);
  return h * fl * fl * (3.0 - 2.0 * fl);
}
`;
