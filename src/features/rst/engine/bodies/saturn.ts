import * as THREE from 'three';
import { loadColorMap, spinAngle, TEXTURE_BASE } from './planetBody.ts';
import type { PlanetHandle } from './planetBody.ts';
import { createAtmosphere } from './atmosphere.ts';

/**
 * Saturn: the banded globe plus its rings. A 26.7° tilt (so the rings open
 * toward us) and a fast ~10.7 h day. The rings sit in the planet's equatorial
 * plane and do NOT spin with the globe, so they're a child of the tilted group
 * rather than of the spinning sphere.
 */

const AXIAL_TILT_DEG = 26.73;
const ROTATION_PERIOD_HOURS = 10.66;
// Main ring system, in planet radii: the C ring starts near 1.2 R, the A ring
// ends near 2.27 R. The alpha map's gaps (Cassini division) fall out naturally.
const RING_INNER = 1.2;
const RING_OUTER = 2.3;

/**
 * A flat ring in the XY plane, UV-remapped so the texture's horizontal axis runs
 * radially (inner edge → outer edge). The Solar System Scope ring map is a thin
 * radial strip, so its per-radius colour and alpha only make sense sampled along
 * the ring's radius, not the default RingGeometry square UVs.
 */
function buildRingGeometry(inner: number, outer: number): THREE.RingGeometry {
  const geo = new THREE.RingGeometry(inner, outer, 128, 1);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // u = normalised radial position; v = 0.5 (the strip is 1-D in radius).
    uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
  }
  uv.needsUpdate = true;
  return geo;
}

export function createSaturn(radius: number): PlanetHandle {
  const loader = new THREE.TextureLoader();
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };

  // --- Globe ---------------------------------------------------------------
  const globeMat = track(new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }));
  globeMat.map = track(
    loadColorMap(`${TEXTURE_BASE}saturn/2k_saturn.jpg`, loader, () => (globeMat.needsUpdate = true)),
  );
  const globe = new THREE.Mesh(track(new THREE.SphereGeometry(radius, 48, 48)), globeMat);
  globe.name = 'Saturn';

  // --- Rings ---------------------------------------------------------------
  const ringGeo = track(buildRingGeometry(radius * RING_INNER, radius * RING_OUTER));
  // Unlit: the Sun grazes the ring plane edge-on, which would leave a lit ring
  // nearly black. Real rings are bright with scattered light, so read them
  // straight from the map. DoubleSide so they show from above and below.
  const ringMat = track(
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false }),
  );
  ringMat.map = track(
    loadColorMap(`${TEXTURE_BASE}saturn/2k_saturn_ring_alpha.png`, loader, () => (ringMat.needsUpdate = true)),
  );

  // The globe casts its shadow across the rings. Approximate the Sun as infinitely
  // far (parallel rays): a ring point lies in the umbra when it's on the planet's
  // anti-Sun side AND falls within the globe's silhouette — inside a cylinder of
  // the planet's radius aimed down the Sun direction. Everything is read from the
  // model matrix (the Sun sits at the world origin), so no per-frame uniform is
  // needed; the planet radius is scaled by the matrix so the shadow still fits
  // when the pixel floor has enlarged the whole body.
  ringMat.onBeforeCompile = (shader): void => {
    shader.uniforms.u_planetRadius = { value: radius };
    shader.vertexShader =
      'varying vec3 vRingWorld;\nvarying vec3 vRingCenter;\nvarying float vRingScale;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        vRingWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        vRingCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vRingScale = length(modelMatrix[0].xyz);`,
      );
    shader.fragmentShader =
      'uniform float u_planetRadius;\nvarying vec3 vRingWorld;\nvarying vec3 vRingCenter;\nvarying float vRingScale;\n' +
      shader.fragmentShader.replace(
        '#include <map_fragment>',
        /* glsl */ `#include <map_fragment>
        {
          vec3 toSun = normalize(-vRingCenter);        // Sun is at the world origin
          vec3 rel = vRingWorld - vRingCenter;         // ring point offset from the globe centre
          float along = dot(rel, toSun);               // <= 0 on the shadowed hemisphere
          float perp = length(rel - along * toSun);    // distance from the Sun-line through the centre
          float worldRadius = u_planetRadius * vRingScale;
          // 1 inside the umbra, with a soft penumbra across the silhouette edge.
          float shadow = step(along, 0.0) * (1.0 - smoothstep(worldRadius * 0.9, worldRadius * 1.1, perp));
          diffuseColor.rgb *= 1.0 - 0.8 * shadow;
        }`,
      );
  };
  const rings = new THREE.Mesh(ringGeo, ringMat);
  rings.name = 'Saturn-rings';
  // RingGeometry lies in XY; lay it into the equatorial (XZ) plane. The group's
  // tilt then opens it toward the viewer.
  rings.rotation.x = -Math.PI / 2;

  // Pale-gold haze on the globe's limb. Sits well inside the rings (1.2 R+), so
  // it doesn't interfere with them.
  const atmosphere = track(createAtmosphere(radius, { color: 0xf0e2b0, scale: 1.03 }));

  const group = new THREE.Group();
  group.name = 'Saturn';
  group.rotation.z = THREE.MathUtils.degToRad(AXIAL_TILT_DEG);
  group.add(globe);
  group.add(rings);
  group.add(atmosphere.mesh);

  return {
    object: group,
    pickTarget: globe,
    update: (simTimeMs: number): void => {
      globe.rotation.y = spinAngle(simTimeMs, ROTATION_PERIOD_HOURS);
    },
    dispose: (): void => {
      for (const r of disposables) r.dispose();
    },
  };
}
