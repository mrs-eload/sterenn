import * as THREE from 'three';
import { loadColorMap, spinAngle, TEXTURE_BASE } from './planetBody.ts';
import type { PlanetHandle } from './planetBody.ts';

// The Moon is tidally locked, so one sidereal rotation takes exactly one sidereal
// orbit (~27.3217 d). Its spin axis is tilted ~6.7° from its orbital plane.
const ROTATION_PERIOD_HOURS = 27.321661 * 24;
const AXIAL_TILT_DEG = 6.68;

const MOON_TEXTURE_URL = `${TEXTURE_BASE}moon/8k_moon.jpg`;

/**
 * The Moon. No surface texture ships for it, so — unlike the planets — it isn't
 * built on createTexturedPlanet: it's a plain lit grey sphere. That still reads
 * correctly, because the Sun light gives it a terminator and phases just like the
 * textured bodies. Otherwise it keeps their exact structure (a tilted group with a
 * spinning globe) and handle shape, so the engine treats it like any other body
 * and swapping in createTexturedPlanet later — once a `2k_moon.jpg` exists — is a
 * one-line change.
 *
 * The engine positions the Moon (heliocentric) and draws its geocentric orbit
 * ring; this file only builds the body and its deterministic spin.
 */
export function createMoon(radius: number): PlanetHandle {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };
  const loader = new THREE.TextureLoader();
  const geometry = new THREE.SphereGeometry(radius, 48, 48);
  // A neutral regolith grey; roughness 1 / metalness 0 like the textured planets.
  const material = new THREE.MeshStandardMaterial({ color: 0xb5b3ad, roughness: 1, metalness: 0 });
  material.map = track(loadColorMap(MOON_TEXTURE_URL, loader, () => (material.needsUpdate = true)));

  const globe = new THREE.Mesh(geometry, material);
  globe.name = 'Moon';

  // Tilt lives on the group; the globe spins on its own Y so the axis stays put.
  const group = new THREE.Group();
  group.name = 'Moon';
  group.rotation.z = THREE.MathUtils.degToRad(AXIAL_TILT_DEG);
  group.add(globe);

  return {
    object: group,
    pickTarget: globe,
    update: (simTimeMs: number): void => {
      globe.rotation.y = spinAngle(simTimeMs, ROTATION_PERIOD_HOURS);
    },
    dispose: (): void => {
      geometry.dispose();
      material.dispose();
    },
  };
}
