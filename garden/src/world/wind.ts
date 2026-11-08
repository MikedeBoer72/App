import * as THREE from 'three';

/** Shared time uniform for everything that sways. */
export const windUniforms = {
  uTime: { value: 0 },
};

/**
 * Adds a gentle wind sway to any built-in material. Displacement grows with
 * the vertex's local height (so stems stay rooted) scaled by `strength`.
 * `heightRef` is the local height at which sway reaches full strength.
 */
export function windify<T extends THREE.Material>(mat: T, strength = 0.08, heightRef = 1): T {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;`,
      )
      .replace(
        '#include <project_vertex>',
        `vec4 wpos = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
wpos = instanceMatrix * wpos;
#endif
float localH = max(0.0, wpos.y);
wpos = modelMatrix * wpos;
float k = clamp(localH / ${heightRef.toFixed(3)}, 0.0, 1.6);
k = k * k * ${strength.toFixed(4)};
float ph = wpos.x * 0.35 + wpos.z * 0.22;
float gust = 0.6 + 0.4 * sin(uTime * 0.37 + wpos.x * 0.05);
wpos.x += (sin(uTime * 1.4 + ph) * 0.7 + sin(uTime * 2.3 + ph * 1.7) * 0.3) * k * gust;
wpos.z += (cos(uTime * 1.1 + ph * 0.8) * 0.5) * k * gust;
vec4 mvPosition = viewMatrix * wpos;
gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  mat.customProgramCacheKey = () => `wind-${strength}-${heightRef}`;
  return mat;
}
