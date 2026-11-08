import * as THREE from 'three';
import { mulberry32, vnoise } from './noise';

let rockMat: THREE.MeshStandardMaterial | null = null;
export function rockMaterial() {
  return (rockMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: false }));
}

/** A weathered rock with moss on the upward-facing parts. */
export function rockGeometry(seed: number, size: number, flatten = 0.65, moss = 0.7): THREE.BufferGeometry {
  const rnd = mulberry32(seed);
  const g = new THREE.IcosahedronGeometry(1, 4);
  const p = g.attributes.position as THREE.BufferAttribute;
  const ox = rnd() * 100;
  const oz = rnd() * 100;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = vnoise(v.x * 1.6 + ox, v.y * 1.6 + v.z * 1.3 + oz) * 0.5 + vnoise(v.x * 4 + oz, v.z * 4 + v.y * 3) * 0.15;
    v.multiplyScalar(0.75 + n);
    // facets: snap slightly toward planes for a chipped look
    v.y *= flatten;
    if (v.y < -0.15) v.y = -0.15 - (v.y + 0.15) * 0.2;
    p.setXYZ(i, v.x * size, v.y * size, v.z * size);
  }
  g.computeVertexNormals();
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(p.count * 3);
  const stone = new THREE.Color('#8b877e');
  const dark = new THREE.Color('#5d5a54');
  const mossC = new THREE.Color('#4e6229');
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const ny = nrm.getY(i);
    const n = vnoise(p.getX(i) * 3 + ox, p.getZ(i) * 3 + p.getY(i) * 2);
    c.copy(stone).lerp(dark, n * 0.7);
    const m = THREE.MathUtils.smoothstep(ny + n * 0.4, 0.55, 0.95) * moss;
    c.lerp(mossC, m);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  return g;
}

export function rockMesh(seed: number, size: number, flatten?: number, moss?: number) {
  const m = new THREE.Mesh(rockGeometry(seed, size, flatten, moss), rockMaterial());
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildBoulders(seed: number): THREE.Group {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const big = rockMesh(seed, 0.9 + rnd() * 0.3);
  g.add(big);
  for (let i = 0; i < 3; i++) {
    const r = rockMesh(seed + i + 1, 0.3 + rnd() * 0.25);
    const a = rnd() * Math.PI * 2;
    r.position.set(Math.cos(a) * (1.1 + rnd() * 0.4), 0, Math.sin(a) * (1.1 + rnd() * 0.4));
    r.rotation.y = rnd() * 6;
    g.add(r);
  }
  return g;
}
