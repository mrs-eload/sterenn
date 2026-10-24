import * as THREE from 'three';

/**
 * A self-contained, animated Sun: a boiling fBm-noise surface under an additive
 * fresnel corona shell. Framework-free like the rest of the engine (see
 * earth.ts) — it returns a plain Three.js group plus a per-frame `update` and a
 * `dispose`.
 *
 * The surface is a ShaderMaterial rather than a texture: a domain-warped
 * fractal-Brownian-motion field (6 octaves of 3D value noise) sampled directly
 * on the sphere's object-space position, so there is no UV seam and the pattern
 * is genuinely three-dimensional. It's mixed orange → white in the hot cells and
 * darkened toward red in the cooler lanes, then evolved over time so it churns.
 * Technique adapted from https://sangillee.com/2024-06-29-create-realistic-sun-with-shaders/
 *
 * The Sun is the scene's light source, so — like the old MeshBasicMaterial it
 * replaces — it is deliberately unlit: a ShaderMaterial ignores scene lights, so
 * the disc stays uniformly bright regardless of where the point light sits.
 */

export interface SunHandle {
  /** Add this to the scene; the engine positions it at the origin. */
  group: THREE.Group;
  /** The lit disc itself, exposed so the engine can register it as pickable. */
  core: THREE.Mesh;
  /**
   * Advance the surface churn. Driven by real elapsed time, not sim time: the
   * boiling is ambient decoration, not a physical quantity tied to the date, and
   * sim time (epoch ms, ~1.7e12) overflows float32 precision anyway. So the disc
   * keeps simmering at a steady rate even while the clock is paused or scrubbed.
   * @param dtSeconds real seconds since the previous frame.
   */
  update(dtSeconds: number): void;
  /** Release every geometry and material this created. */
  dispose(): void;
}

interface SunOptions {
  /** Corona shell radius as a multiple of the core radius. Defaults to 1.6. */
  glowScale?: number;
  /** How fast the surface churns (higher = more turbulent). Defaults to 0.12. */
  churnSpeed?: number;
}

// Shared GLSL: 3D value noise + a 6-octave fBm. Sampling on the object-space
// position (a point on the sphere) makes the field seamless across the surface.
const NOISE_GLSL = /* glsl */ `
  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 23.112))) * 12943.145);
  }

  // Trilinear value noise with a smoothstep-faded lattice.
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), u.x),
          mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
      mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), u.x),
          mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), u.x), u.y),
      u.z);
  }

  #define NUM_OCTAVES 6
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < NUM_OCTAVES; i++) {
      v += a * noise(p);
      p = p * 2.0 + vec3(100.0);
      a *= 0.5;
    }
    return v;
  }
`;

const SURFACE_VERT = /* glsl */ `
  varying vec3 vLocalPos;
  void main() {
    // Object-space position: the raw noise domain, spin-invariant and seamless.
    vLocalPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SURFACE_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vLocalPos;

  ${NOISE_GLSL}

  void main() {
    // Sample on the unit sphere, scaled up so several noise cells wrap the disc.
    vec3 p = normalize(vLocalPos) * 3.0;

    // Domain warp: displace the sample point by its own fBm before the final
    // lookup. This is what turns bland noise into swirling granulation. Each
    // warp channel drifts along its own time offset so the cells churn.
    vec3 q = vec3(
      fbm(p + vec3(0.0, 0.0, uTime)),
      fbm(p + vec3(5.2, 1.3, uTime)),
      fbm(p + vec3(1.7, 9.2, uTime))
    );
    float n = fbm(p + 4.0 * q + vec3(uTime));

    // Hot cells run orange → white; the cool lanes (low warp magnitude) sink
    // toward deep red, giving the sunspot-ish mottling.
    vec3 color = mix(vec3(1.0, 0.4, 0.0), vec3(1.0, 0.95, 0.7), n * n);
    color = mix(vec3(0.85, 0.12, 0.0), color, clamp(length(q), 0.0, 1.0));

    // Push overall brightness up a touch so it reads as an emitter, not a lit ball.
    gl_FragColor = vec4(color * 1.25, 1.0);
  }
`;

const GLOW_VERT = /* glsl */ `
  varying vec3 vNormalView;
  void main() {
    vNormalView = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Rim/corona glow. On a back-side shell, the fragments we see face away from the
// camera, so their view-space normal's z runs from ~-1 (limb) to less negative
// (centre). `-vNormalView.z` therefore peaks at the limb: a halo that fades in
// from the disc edge outward. Additive blending lays it over the sky as light.
const GLOW_FRAG = /* glsl */ `
  uniform vec3 uGlowColor;
  varying vec3 vNormalView;
  void main() {
    // Falloff exponent must be a float literal: GLSL's pow(float, float) has no
    // int overload, so pow(x, 1) fails to compile. 1.0 = linear rim; raise it to
    // tighten the halo toward the limb.
    float intensity = pow(clamp(-vNormalView.z, 0.0, 2.0), 5.0);
    gl_FragColor = vec4(uGlowColor, intensity);
  }
`;

/**
 * Build the Sun. The surface uniform `uTime` is advanced by `update`; the corona
 * is a static additive shell that needs no per-frame work.
 */
export function createSun(radius: number, options: SunOptions = {}): SunHandle {
  const glowScale = options.glowScale ?? 1.6;
  const churnSpeed = options.churnSpeed ?? 0.12;

  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };

  const uTime = { value: 0 };

  // --- The lit surface -----------------------------------------------------
  const coreGeometry = track(new THREE.SphereGeometry(radius, 64, 64));
  const coreMaterial = track(
    new THREE.ShaderMaterial({
      uniforms: { uTime },
      vertexShader: SURFACE_VERT,
      fragmentShader: SURFACE_FRAG,
    }),
  );
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  core.name = 'Sun';

  // --- The corona shell ----------------------------------------------------
  // Back side so we shade the hemisphere behind the disc; additive + no depth
  // write so it glows over the sky and never occludes the surface or planets.
  const glowGeometry = track(new THREE.SphereGeometry(radius * glowScale, 48, 48));
  const glowMaterial = track(
    new THREE.ShaderMaterial({
      uniforms: { uGlowColor: { value: new THREE.Color(0xff7a1a) } },
      vertexShader: GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
  );
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  glow.name = 'Sun-corona';

  const group = new THREE.Group();
  group.name = 'Sun';
  group.add(core);
  group.add(glow);
  group.scale.set(10,10,10)

  const update = (dtSeconds: number): void => {
    uTime.value += dtSeconds * churnSpeed;
  };

  const dispose = (): void => {
    for (const r of disposables) r.dispose();
  };

  return { group, core, update, dispose };
}
