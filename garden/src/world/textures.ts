// Procedural canvas textures, generated once at startup. No image downloads.

import * as THREE from 'three';
import { mulberry32 } from './noise';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function tex(c: HTMLCanvasElement, repeat = false, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const cache = new Map<string, THREE.Texture>();
function cached(key: string, make: () => THREE.Texture) {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

/** A cluster of leaves on transparent background, white-ish so vertex/instance colour tints it. */
export function leafTexture(kind: 'broad' | 'small' | 'blossom' = 'broad') {
  return cached('leaf-' + kind, () => {
    const [c, g] = canvas(256, 256);
    const rnd = mulberry32(kind.length * 99);
    const n = kind === 'small' ? 46 : kind === 'blossom' ? 60 : 26;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 88;
      const x = 128 + Math.cos(a) * r;
      const y = 128 + Math.sin(a) * r;
      const len = kind === 'small' ? 16 + rnd() * 10 : kind === 'blossom' ? 9 + rnd() * 6 : 26 + rnd() * 16;
      const wid = kind === 'blossom' ? len : len * 0.48;
      const shade = 170 + rnd() * 85;
      g.save();
      g.translate(x, y);
      g.rotate(rnd() * Math.PI * 2);
      if (kind === 'blossom') {
        g.fillStyle = `rgb(${shade},${shade},${shade})`;
        for (let p = 0; p < 5; p++) {
          g.rotate((Math.PI * 2) / 5);
          g.beginPath();
          g.ellipse(0, wid * 0.55, wid * 0.42, wid * 0.6, 0, 0, Math.PI * 2);
          g.fill();
        }
      } else {
        g.fillStyle = `rgb(${shade},${shade},${shade})`;
        g.beginPath();
        g.ellipse(0, 0, wid, len, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = `rgba(0,0,0,0.25)`;
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(0, -len);
        g.lineTo(0, len);
        g.stroke();
      }
      g.restore();
    }
    const t = tex(c);
    t.generateMipmaps = true;
    return t;
  });
}

/** Pine needle cluster. */
export function needleTexture() {
  return cached('needles', () => {
    const [c, g] = canvas(256, 256);
    const rnd = mulberry32(7);
    g.lineCap = 'round';
    for (let i = 0; i < 140; i++) {
      const x = 128 + (rnd() - 0.5) * 190;
      const y = 128 + (rnd() - 0.5) * 120;
      const a = rnd() * Math.PI;
      const l = 18 + rnd() * 22;
      const s = 160 + rnd() * 95;
      g.strokeStyle = `rgb(${s},${s},${s})`;
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(x - Math.cos(a) * l, y - Math.sin(a) * l);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    return tex(c);
  });
}

export function stoneWallTexture() {
  return cached('stonewall', () => {
    const [c, g] = canvas(512, 512);
    const rnd = mulberry32(42);
    g.fillStyle = '#6e675d';
    g.fillRect(0, 0, 512, 512);
    let y = 0;
    while (y < 512) {
      const h = 34 + rnd() * 26;
      let x = -rnd() * 40;
      while (x < 512) {
        const w = 50 + rnd() * 60;
        const base = 140 + rnd() * 60;
        const warm = rnd() * 18;
        g.fillStyle = `rgb(${base + warm},${base + warm * 0.6},${base - warm * 0.3})`;
        g.beginPath();
        g.roundRect(x + 3, y + 3, w - 6, h - 6, 9);
        g.fill();
        // speckle
        for (let i = 0; i < 20; i++) {
          g.fillStyle = `rgba(0,0,0,${rnd() * 0.12})`;
          g.fillRect(x + rnd() * w, y + rnd() * h, 2, 2);
        }
        x += w;
      }
      y += h;
    }
    return tex(c, true);
  });
}

export function roofTexture() {
  return cached('roof', () => {
    const [c, g] = canvas(512, 512);
    const rnd = mulberry32(5);
    g.fillStyle = '#2e3236';
    g.fillRect(0, 0, 512, 512);
    const rows = 12;
    const rh = 512 / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * 20;
      for (let x = -off; x < 512; x += 40) {
        const b = 62 + rnd() * 30;
        g.fillStyle = `rgb(${b},${b + 4},${b + 10})`;
        g.fillRect(x + 1, r * rh + 1, 38, rh - 3);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x + 1, r * rh + rh - 6, 38, 4);
      }
    }
    return tex(c, true);
  });
}

export function woodTexture() {
  return cached('wood', () => {
    const [c, g] = canvas(256, 256);
    const rnd = mulberry32(11);
    for (let x = 0; x < 256; x += 32) {
      const b = 110 + rnd() * 30;
      g.fillStyle = `rgb(${b},${b * 0.72},${b * 0.48})`;
      g.fillRect(x, 0, 32, 256);
      for (let i = 0; i < 18; i++) {
        g.strokeStyle = `rgba(40,25,10,${0.12 + rnd() * 0.12})`;
        g.lineWidth = 1;
        g.beginPath();
        const xx = x + rnd() * 32;
        g.moveTo(xx, 0);
        g.bezierCurveTo(xx + rnd() * 6 - 3, 80, xx + rnd() * 6 - 3, 170, xx, 256);
        g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x, 0, 2, 256);
    }
    return tex(c, true);
  });
}

export function birchBarkTexture() {
  return cached('birch', () => {
    const [c, g] = canvas(128, 512);
    const rnd = mulberry32(3);
    g.fillStyle = '#e9e6dc';
    g.fillRect(0, 0, 128, 512);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(30,28,25,${0.5 + rnd() * 0.4})`;
      const y = rnd() * 512;
      g.beginPath();
      g.ellipse(rnd() * 128, y, 6 + rnd() * 22, 1.5 + rnd() * 3, 0, 0, Math.PI * 2);
      g.fill();
    }
    return tex(c, true);
  });
}

export function barkTexture() {
  return cached('bark', () => {
    const [c, g] = canvas(128, 512);
    const rnd = mulberry32(9);
    g.fillStyle = '#5a4634';
    g.fillRect(0, 0, 128, 512);
    for (let i = 0; i < 60; i++) {
      g.strokeStyle = `rgba(${20 + rnd() * 30},${15 + rnd() * 20},10,0.7)`;
      g.lineWidth = 2 + rnd() * 4;
      const x = rnd() * 128;
      g.beginPath();
      g.moveTo(x, 0);
      for (let y = 0; y <= 512; y += 32) g.lineTo(x + (rnd() - 0.5) * 10, y);
      g.stroke();
    }
    return tex(c, true);
  });
}

/** Text carved on a wooden sign. */
export function signTexture(lines: string[]) {
  const [c, g] = canvas(1024, 512);
  const wood = woodTexture().image as HTMLCanvasElement;
  g.save();
  g.rotate(Math.PI / 2);
  g.translate(0, -1024);
  for (let x = 0; x < 512; x += 256) for (let y = 0; y < 1024; y += 256) g.drawImage(wood, x, y);
  g.restore();
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, 0, 1024, 512);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((l, i) => {
    const size = i === 0 ? 96 : 54;
    g.font = `${i === 0 ? '600' : '400'} ${size}px ui-serif, Georgia, serif`;
    const y = 512 / 2 + (i - (lines.length - 1) / 2) * 110;
    g.fillStyle = 'rgba(255,240,210,0.35)';
    g.fillText(l, 512, y + 3);
    g.fillStyle = 'rgba(45,26,10,0.92)';
    g.fillText(l, 512, y);
  });
  return tex(c);
}

/** Soft round glow sprite. */
export function glowTexture() {
  return cached('glow', () => {
    const [c, g] = canvas(128, 128);
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.5)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return tex(c);
  });
}

export function butterflyTexture() {
  return cached('butterfly', () => {
    const [c, g] = canvas(128, 128);
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(64, 46, 54, 40, -0.2, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(64, 98, 34, 26, 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.beginPath();
    g.ellipse(80, 40, 10, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(0, 0, 6, 128);
    return tex(c);
  });
}
