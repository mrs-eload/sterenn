import * as THREE from 'three';
import { loadColorMap, spinAngle, TEXTURE_BASE } from './planetBody.ts';
import type { PlanetHandle } from './planetBody.ts';
import { createAtmosphere } from './atmosphere.ts';

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

  // --- Atmosphere shell ----------------------------------------------------
  // Built first because its cloud texture is shared with the surface below: the
  // visible deck AND the shadow it casts onto the surface read the same acid-haze
  // map, just at their own longitude. loadColorMap hands back the Texture
  // synchronously and fills it in on load, so the surface shader can reference it
  // from the first frame.
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
  const cloudTex = track(
    loadColorMap(`${TEXTURE_BASE}venus/2k_venus_atmosphere.jpg`, loader, () => (cloudMat.needsUpdate = true)),
  );
  cloudMat.map = cloudTex;
  const clouds = new THREE.Mesh(track(new THREE.SphereGeometry(radius * CLOUD_SCALE, 48, 48)), cloudMat);
  clouds.name = 'Venus-atmosphere';

  // --- Surface -------------------------------------------------------------
  const surfaceMat = track(new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }));
  surfaceMat.map = track(
    loadColorMap(`${TEXTURE_BASE}venus/2k_venus_surface.jpg`, loader, () => (surfaceMat.needsUpdate = true)),
  );

  // Cloud shadow: the opaque deck overhead darkens the surface beneath its denser
  // bands. Patched into the standard lit shader so the scene's Sun light still
  // owns the terminator — the shadow only bites on the daylit side, where the
  // surface is lit at all. `u_cloudUvOffset` re-aligns the cloud sample to the
  // surface longitude each frame, since the deck super-rotates over the surface,
  // so the shadow pattern shears across the ground exactly as the two layers slip.
  const shadowUniforms = {
    u_cloudShadowMap: { value: cloudTex as THREE.Texture },
    u_cloudUvOffset: { value: 0 },
    u_cloudShadowStrength: { value: 0.55 },
  };
  surfaceMat.onBeforeCompile = (shader): void => {
    shader.uniforms.u_cloudShadowMap = shadowUniforms.u_cloudShadowMap;
    shader.uniforms.u_cloudUvOffset = shadowUniforms.u_cloudUvOffset;
    shader.uniforms.u_cloudShadowStrength = shadowUniforms.u_cloudShadowStrength;
    shader.fragmentShader =
      'uniform sampler2D u_cloudShadowMap;\n' +
      'uniform float u_cloudUvOffset;\n' +
      'uniform float u_cloudShadowStrength;\n' +
      shader.fragmentShader.replace(
        '#include <map_fragment>',
        /* glsl */ `#include <map_fragment>
        {
          // Same UV as the surface, shifted in longitude to the cloud deck's phase.
          vec2 cloudUv = vec2(vMapUv.x + u_cloudUvOffset, vMapUv.y);
          float cloudDensity = texture2D(u_cloudShadowMap, cloudUv).r;
          diffuseColor.rgb *= 1.0 - u_cloudShadowStrength * cloudDensity;
        }`,
      );
  };
  const surface = new THREE.Mesh(track(new THREE.SphereGeometry(radius, 48, 48)), surfaceMat);
  surface.name = 'Venus';

  // Glow shell over the cloud deck — Venus's thick haze reads as a bright,
  // pale-yellow limb. A touch larger than the cloud layer and a bit stronger than
  // the giants', since the atmosphere is what you mostly see of Venus.
  const atmosphere = track(createAtmosphere(radius, { color: 0xf3e6b0, scale: 1.05, strength: 1.2 }));

  const group = new THREE.Group();
  group.name = 'Venus';
  group.rotation.z = THREE.MathUtils.degToRad(AXIAL_TILT_DEG);
  group.add(surface);
  group.add(clouds);
  group.add(atmosphere.mesh);

  return {
    object: group,
    pickTarget: surface,
    update: (simTimeMs: number): void => {
      const surfaceAngle = spinAngle(simTimeMs, SURFACE_PERIOD_HOURS);
      const cloudAngle = spinAngle(simTimeMs, CLOUD_PERIOD_HOURS);
      surface.rotation.y = surfaceAngle;
      clouds.rotation.y = cloudAngle;
      // Sample the cloud map at the surface point's longitude, corrected for how
      // far the deck has slipped ahead: a longitude of Δθ maps to Δθ/2π in U.
      shadowUniforms.u_cloudUvOffset.value = (surfaceAngle - cloudAngle) / (Math.PI * 2);
    },
    dispose: (): void => {
      for (const r of disposables) r.dispose();
    },
  };
}
