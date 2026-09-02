import * as THREE from 'three';
import { createAtmosphere } from './atmosphere.ts';
import type { AtmosphereOptions } from './atmosphere.ts';

/**
 * Shared scaffolding for the image-textured planets. Each planet gets its own
 * file (mercury.ts, mars.ts, …) that declares *its* texture(s), tilt and spin;
 * this module holds only what all of them share, so the per-planet files stay
 * about the planet, not about Three.js boilerplate. Same handle shape and
 * conventions as earth.ts (framework-free, deterministic spin from sim time).
 */

// Every planet texture sits under <base>/textures/<planet>/. BASE_URL is the
// Vite base ('/sterenn/'), so this matches earth.ts's served path.
export const TEXTURE_BASE = `${import.meta.env.BASE_URL}textures/`;

export interface PlanetHandle {
  /** Add this to the scene; the engine positions it each frame. */
  object: THREE.Object3D;
  /** What click-to-pivot should raycast against. Defaults to `object`. */
  pickTarget?: THREE.Object3D;
  /**
   * Advance the planet's spin (and any super-rotating cloud layer). Driven by
   * sim time so it's exact under scrubbing/pausing, like the Earth and the
   * planets' orbital positions. Optional: a body with no visible rotation omits it.
   */
  update?(simTimeMs: number): void;
  /** Release every geometry, material and texture this created. */
  dispose(): void;
}

/** Load an sRGB colour map with sensible filtering. Track it for disposal. */
export function loadColorMap(
  url: string,
  loader: THREE.TextureLoader,
  onReady?: () => void,
): THREE.Texture {
  return loader.load(url, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    onReady?.();
  });
}

/** Rotation angle (radians) at a sim instant. Sign of `periodHours` sets the
 *  spin direction, so a negative period gives retrograde rotation. */
export function spinAngle(simTimeMs: number, periodHours: number): number {
  const periodMs = periodHours * 3_600_000;
  return ((simTimeMs / periodMs) % 1) * Math.PI * 2;
}

export interface TexturedPlanetOptions {
  /** Display name, set on the globe mesh for picking/debugging. */
  name: string;
  /** Colour-map URL (usually under TEXTURE_BASE). */
  textureUrl: string;
  /** Obliquity of the spin axis from the ecliptic normal, in degrees. */
  axialTiltDeg: number;
  /** Sidereal rotation period in hours; negative = retrograde. */
  rotationPeriodHours: number;
  /** Add a glowing atmosphere shell (gas/ice giants). Omit for an airless body. */
  atmosphere?: AtmosphereOptions;
};

/**
 * The common case: a lit, textured sphere with an axial tilt and a steady spin.
 * The globe is lit by the scene's Sun light (MeshStandardMaterial), so it shows
 * a day/night terminator and phases just like the flat spheres it replaces —
 * only now with a real surface map. Mercury, Mars, Jupiter, Uranus and Neptune
 * are exactly this; Venus and Saturn build on the same pieces with extra layers.
 */
export function createTexturedPlanet(
  radius: number,
  options: TexturedPlanetOptions,
): PlanetHandle {
  const loader = new THREE.TextureLoader();
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };

  const geometry = track(new THREE.SphereGeometry(radius, 48, 48));
  const material = track(new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }));
  material.map = track(loadColorMap(options.textureUrl, loader, () => (material.needsUpdate = true)));

  const globe = new THREE.Mesh(geometry, material);
  globe.name = options.name;

  // Tilt lives on the group; the globe spins on its own Y so the axis stays put.
  const group = new THREE.Group();
  group.name = options.name;
  group.rotation.z = THREE.MathUtils.degToRad(options.axialTiltDeg);
  group.add(globe);

  // Optional atmosphere shell — self-updating, so just add and track for disposal.
  if (options.atmosphere) {
    const atmosphere = track(createAtmosphere(radius, options.atmosphere));
    group.add(atmosphere.mesh);
  }

  return {
    object: group,
    pickTarget: globe,
    update: (simTimeMs: number): void => {
      globe.rotation.y = spinAngle(simTimeMs, options.rotationPeriodHours);
    },
    dispose: (): void => {
      for (const r of disposables) r.dispose();
    },
  };
}
