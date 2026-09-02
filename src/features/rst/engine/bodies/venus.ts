import * as THREE from 'three';
import { loadColorMap, spinAngle, TEXTURE_BASE } from './planetBody.ts';
import type { PlanetHandle } from './planetBody.ts';

/**
 * Venus: the rocky surface is all but hidden beneath an opaque sulphuric-acid
 * haze, so we render both — the surface globe under a slightly larger, faintly
 * translucent atmosphere shell. Venus turns retrograde and glacially (243-day
 * sidereal, hence the negative period), while its upper clouds *super-rotate*,
 * lapping the planet roughly every four days; spinning the shell far faster than
 * the surface reproduces that shear.
 */

const SURFACE_PERIOD_HOURS = -5832.5; // sidereal day, retrograde
const CLOUD_PERIOD_HOURS = -96; // ~4-day super-rotation, retrograde
const AXIAL_TILT_DEG = 2.64; // direction handled by the negative periods above
const CLOUD_SCALE = 1.02;

export function createVenus(radius: number): PlanetHandle {
  const loader = new THREE.TextureLoader();
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };

  // --- Surface -------------------------------------------------------------
  const surfaceMat = track(new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }));
  surfaceMat.map = track(
    loadColorMap(`${TEXTURE_BASE}venus/2k_venus_surface.jpg`, loader, () => (surfaceMat.needsUpdate = true)),
  );
  const surface = new THREE.Mesh(track(new THREE.SphereGeometry(radius, 48, 48)), surfaceMat);
  surface.name = 'Venus';

  // --- Atmosphere shell ----------------------------------------------------
  const cloudMat = track(
    new THREE.MeshStandardMaterial({
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0.85,
      // Don't write depth: the shell must not z-fight the surface beneath it.
      depthWrite: false,
    }),
  );
  cloudMat.map = track(
    loadColorMap(`${TEXTURE_BASE}venus/2k_venus_atmosphere.jpg`, loader, () => (cloudMat.needsUpdate = true)),
  );
  const clouds = new THREE.Mesh(track(new THREE.SphereGeometry(radius * CLOUD_SCALE, 48, 48)), cloudMat);
  clouds.name = 'Venus-atmosphere';

  const group = new THREE.Group();
  group.name = 'Venus';
  group.rotation.z = THREE.MathUtils.degToRad(AXIAL_TILT_DEG);
  group.add(surface);
  group.add(clouds);

  return {
    object: group,
    pickTarget: surface,
    update: (simTimeMs: number): void => {
      surface.rotation.y = spinAngle(simTimeMs, SURFACE_PERIOD_HOURS);
      clouds.rotation.y = spinAngle(simTimeMs, CLOUD_PERIOD_HOURS);
    },
    dispose: (): void => {
      for (const r of disposables) r.dispose();
    },
  };
}
