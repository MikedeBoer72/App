import * as THREE from 'three';
import { glowTexture, signTexture, woodTexture } from './textures';
import { rockMesh } from './rocks';

export const glowMaterials: THREE.SpriteMaterial[] = [];
export const warmMaterials: THREE.MeshStandardMaterial[] = [];

function stoneBox(w: number, h: number, d: number) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: '#8f8a80', roughness: 0.95 }),
  );
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function buildLantern(): THREE.Group {
  const g = new THREE.Group();
  const base = stoneBox(0.55, 0.15, 0.55);
  base.position.y = 0.075;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.75, 8), base.material);
  post.position.y = 0.52;
  post.castShadow = true;
  const shelf = stoneBox(0.48, 0.08, 0.48);
  shelf.position.y = 0.93;
  const light = new THREE.MeshStandardMaterial({ color: '#f6d9a0', emissive: '#ffb45a', emissiveIntensity: 0.4, roughness: 0.6 });
  warmMaterials.push(light);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.3), light);
  box.position.y = 1.11;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.28, 4), base.material);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 1.39;
  roof.castShadow = true;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), base.material);
  knob.position.y = 1.56;
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffb766', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  glowMaterials.push(glowMat);
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(1.6);
  glow.position.y = 1.11;
  g.add(base, post, shelf, box, roof, knob, glow);
  return g;
}

export function buildBench(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.85 });
  const slat = (y: number, z: number, rx = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.12), wood);
    m.position.set(0, y, z);
    m.rotation.x = rx;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  };
  for (let i = 0; i < 3; i++) slat(0.45, -0.15 + i * 0.15);
  for (let i = 0; i < 2; i++) slat(0.65 + i * 0.17, -0.27, -0.2);
  const iron = new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.5, metalness: 0.6 });
  for (const x of [-0.7, 0.7]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.42), iron);
    leg.position.set(x, 0.225, -0.02);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.05), iron);
    back.position.set(x, 0.65, -0.29);
    back.rotation.x = -0.2;
    leg.castShadow = back.castShadow = true;
    g.add(leg, back);
  }
  return g;
}

/** The wooden sign at the spot where it all started. */
export function buildStartSign(lines: string[]): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.9 });
  for (const x of [-0.55, 0.55]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.3, 0.09), wood);
    post.position.set(x, 0.65, 0);
    post.castShadow = true;
    g.add(post);
  }
  const face = new THREE.MeshStandardMaterial({ map: signTexture(lines), roughness: 0.85 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.05), [wood, wood, wood, wood, face, wood]);
  board.position.y = 1.0;
  board.castShadow = true;
  g.add(board);
  const stone = rockMesh(77, 0.22);
  stone.position.set(0.85, 0.02, 0.25);
  g.add(stone);
  return g;
}
