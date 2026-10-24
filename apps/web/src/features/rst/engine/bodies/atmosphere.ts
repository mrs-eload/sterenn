import * as THREE from 'three';
import { BLOOM_LAYER } from '../render/BloomPipeline';

/**
 * A reusable atmosphere shell for the textured planets — a back-side sphere a few
 * percent larger than the globe that glows on its sunlit limb (a fresnel rim faded
 * around the terminator) and lights up warm on the sunward limb when back-lit.
 *
 * It's fully self-contained: the Sun sits at the world origin, so the shader reads
 * the planet's world centre from its own model matrix and takes `sunDir` as the
 * direction back to the origin. That means the shell needs NO per-frame update — a
 * planet just adds it to its group and forgets about it. (Earth keeps its own,
 * bespoke atmosphere shader; this is the shared one for everyone else.)
 */

const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormalWorld;    // world space, for the day/night fade
  varying vec3 vNormalView;     // view space, for the fresnel rim
  varying vec3 vViewDir;        // view space, fragment → camera
  varying vec3 vViewCenterDir;  // world space, camera → planet centre
  varying vec3 vSunDir;         // world space, planet → Sun

  void main() {
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    vNormalView = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    vec3 worldCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vViewCenterDir = normalize(worldCenter - cameraPosition);
    // The Sun is at the world origin, so planet → Sun is just -worldCenter.
    vSunDir = normalize(-worldCenter);
    gl_Position = projectionMatrix * mv;
  }
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 u_color;            // day-limb halo (the planet's air colour)
  uniform vec3 u_backlightColor;   // warm scattered sunlight on the backlit limb
  uniform float u_strength;        // overall intensity

  varying vec3 vNormalWorld;
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  varying vec3 vViewCenterDir;
  varying vec3 vSunDir;

  void main() {
    vec3 sunDir = normalize(vSunDir);
    float cosSun = dot(vNormalWorld, sunDir);

    // Limb fresnel: brightest where the back-side normal points away from the
    // camera (the planet's edge), fading to the shell's rim.
    float rim = max(-dot(vViewDir, vNormalView), 0.0);

    // Day-limb halo, faded around the terminator so only the daylit limb lights up.
    float dayFade = 1.0 / (1.0 + exp(-7.0 * (cosSun + 0.1)));
    float dayGlow = pow(3.0 * rim, 3.0) * dayFade;

    // Warm sunward-limb glow, lifted strongly when the Sun is behind the disc.
    float sunwardLimb = smoothstep(-0.25, 0.45, cosSun);
    float backlit = smoothstep(-0.20, 0.85, dot(vViewCenterDir, sunDir));
    float backGlow = pow(3.0 * rim, 2.0) * sunwardLimb * (0.35 + 1.65 * backlit) * 0.7;

    vec3 add = (u_color * dayGlow + u_backlightColor * backGlow) * u_strength;
    gl_FragColor = vec4(add, 1.0);
  }
`;

export interface AtmosphereOptions {
  /** Day-limb / air colour (0xRRGGBB). */
  color: number;
  /** Shell radius as a multiple of the planet radius. Defaults to 1.03. */
  scale?: number;
  /** Overall intensity multiplier. Defaults to 1. */
  strength?: number;
  /** Warm backlit-limb colour. Defaults to a warm off-white. */
  backlightColor?: number;
}

export interface AtmosphereHandle {
  /** Add this to the planet's group. */
  mesh: THREE.Mesh;
  dispose(): void;
}

/** Build an atmosphere shell for a planet of the given drawn radius. */
export function createAtmosphere(planetRadius: number, opts: AtmosphereOptions): AtmosphereHandle {
  const geometry = new THREE.SphereGeometry(planetRadius * (opts.scale ?? 1.03), 64, 64);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      u_color: { value: new THREE.Color(opts.color) },
      u_backlightColor: { value: new THREE.Color(opts.backlightColor ?? 0xffe9c8) },
      u_strength: { value: opts.strength ?? 1 },
    },
    vertexShader: ATMOSPHERE_VERTEX,
    fragmentShader: ATMOSPHERE_FRAGMENT,
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'atmosphere';
  // On the bloom layer (keeping layer 0) so the rim glows softly like Earth's.
  mesh.layers.enable(BLOOM_LAYER);

  return {
    mesh,
    dispose: (): void => {
      geometry.dispose();
      material.dispose();
    },
  };
}
