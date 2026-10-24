import * as THREE from 'three';
import { TIFFLoader } from 'three/examples/jsm/loaders/TIFFLoader.js';
import { earthOrientationBasis } from './earthOrientation.ts';
import { BLOOM_LAYER } from '../render/BloomPipeline';

/**
 * A realistic Earth rendered by a single custom shader on one sphere. Day map,
 * city-lights night map, normal map, ocean specular, AND clouds are all blended
 * in the same fragment shader — no separate translucent cloud shell (an earlier
 * attempt used one, and a second near-coincident transparent sphere sorted into
 * banded rings against the globe at this scene's brutal depth range).
 *
 * The day/night terminator is the whole point: the day fraction is a steep
 * logistic of `dot(surfaceNormal, sunDir)`, so the lit hemisphere always tracks
 * the real Sun. Because the shader works in world space and the mesh carries the
 * axial tilt + spin, scrubbing the clock rotates the globe and the terminator
 * follows correctly.
 *
 * Approach adapted from Sangil Lee's "Create a Realistic Earth with Shaders"
 * (sangillee.com), trimmed to this scene (no moon eclipse term) and fixed for
 * our units: the atmosphere glow normalises by radius since our Earth is ~0.03
 * world units, not 1.
 */

const DEFAULT_TEXTURE_BASE = '/sterenn/textures/earth/';

export interface EarthHandle {
  /** Add this to the scene; the engine positions it at Earth each frame. */
  group: THREE.Group;
  /**
   * Advance the spin and refresh the day/night terminator.
   * @param earthWorldPos Earth's position in world space (the Sun is the origin).
   * @param simTimeMs      Current simulation instant; drives the deterministic spin.
   */
  update(earthWorldPos: THREE.Vector3, simTimeMs: number): void;
  /** Release every geometry, material, and texture this created. */
  dispose(): void;
}

interface EarthOptions {
  /** Base URL the five texture files sit under. Defaults to the public folder. */
  textureBase?: string;
  /** Add the blue atmosphere rim. Defaults to true. */
  atmosphere?: boolean;
}

const EARTH_VERTEX = /* glsl */ `
  attribute vec4 tangent;

  varying vec2 vUv;
  varying vec3 vNormal;    // world-space surface normal
  varying vec3 vPosition;  // world-space position offset from the sphere centre
  varying mat3 vTbn;       // tangent → world, for the normal map

  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vPosition = mat3(modelMatrix) * position;

    vec3 t = normalize(mat3(modelMatrix) * tangent.xyz);
    vec3 n = vNormal;
    vec3 b = normalize(cross(n, t) * tangent.w);
    vTbn = mat3(t, b, n);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const EARTH_FRAGMENT = /* glsl */ `
  uniform sampler2D u_dayTexture;
  uniform sampler2D u_nightTexture;
  uniform sampler2D u_normalTexture;
  uniform sampler2D u_specTexture;
  uniform sampler2D u_cloudTexture;
  uniform vec3 u_sunDirection;  // world-space, normalized, Earth → Sun
  uniform vec3 u_position;      // Earth's world-space position

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying mat3 vTbn;

  // The colour maps are authored in sRGB; decode to linear before we light them,
  // since the renderer re-encodes the final frame to sRGB on output.
  vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }

  void main() {
    vec3 sunDir = normalize(u_sunDirection);
    // The TIFF data maps are top-origin; the JPG colour maps are bottom-origin
    // (flipped on load). Flip V for the data maps so relief and ocean line up.
    vec2 dataUv = vec2(vUv.x, 1.0 - vUv.y);

    vec3 dayColor = toLinear(texture2D(u_dayTexture, vUv).rgb);
    vec3 nightColor = toLinear(texture2D(u_nightTexture, vUv).rgb);

    // Steep logistic terminator from the SMOOTH sphere normal only. Driving the
    // day/night blend off the normal map (as many tutorials do) lets mipmap-
    // averaged normals dip the day fraction in bands, bleeding the night lights
    // through the day side. So the terminator is smooth; the normal map is used
    // only for the ocean glint below.
    float cosSun = dot(vNormal, sunDir);
    float dayAmount = 1.0 / (1.0 + exp(-20.0 * cosSun));

    // Perturbed surface normal — for the specular highlight, not the terminator.
    vec3 tNormal = texture2D(u_normalTexture, dataUv).xyz * 2.0 - 1.0;
    vec3 normal = normalize(vTbn * tNormal);

    // Clouds cast a soft shadow: darken the daylit SURFACE (never uncover the
    // night lights). The shadow is offset from the cloud along the Sun direction
    // in UV space so it falls BESIDE the cloud rather than hiding under it —
    // (vNormal - sunDir) vanishes at the sub-solar point and grows toward the
    // terminator, so shadows are short at noon and rake long at dusk/dawn.
    vec3 shadowShift = 0.006 * inverse(vTbn) * (vNormal - sunDir);
    float cloudShadow = texture2D(u_cloudTexture, vUv - shadowShift.xy).r;
    dayColor *= 1.0 - 0.5 * cloudShadow;

    vec3 color = mix(nightColor, dayColor, dayAmount);

    // Ocean glint: the specular map's red channel is the water mask. Reflect the
    // Sun about the surface normal and glint where it lines up with the camera.
    float reflectRatio = texture2D(u_specTexture, dataUv).r;
    reflectRatio = 0.3 * reflectRatio + 0.05;
    vec3 surfacePos = u_position + vPosition;
    vec3 viewDir = normalize(cameraPosition - surfacePos);
    vec3 reflectVec = reflect(-sunDir, normal);
    float specPower = clamp(dot(reflectVec, viewDir), 0.0, 1.0);
    color += dayAmount * pow(specPower, 12.0) * reflectRatio;

    // Cloud layer on top. The clouds JPG is grey-on-black, so its luminance is
    // both coverage (alpha) and brightness; dim it on the night side and tint
    // the channels slightly (blue lingers longest) for a dusk cast.
    float coverage = texture2D(u_cloudTexture, vUv).r;
    vec3 cloudRGB = vec3(
      clamp(dayAmount, 0.05, 1.0),
      clamp(pow(dayAmount, 1.5), 0.05, 1.0),
      clamp(pow(dayAmount, 2.0), 0.05, 1.0)
    );
    float cloudA = coverage * clamp(dayAmount, 0.08, 1.0);
    color = color * (1.0 - cloudA) + cloudRGB * cloudA;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormalWorld;    // world space, for the day/night fade
  varying vec3 vNormalView;     // view space, for the fresnel rim
  varying vec3 vViewDir;        // view space, fragment → camera
  varying vec3 vViewCenterDir;  // world space, camera → planet centre

  void main() {
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    vNormalView = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    // The planet centre in world space (the shell is centred on the globe). Its
    // direction from the camera tells the fragment whether the Sun sits BEHIND the
    // disc — that's when the atmosphere is backlit.
    vec3 worldCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vViewCenterDir = normalize(worldCenter - cameraPosition);
    gl_Position = projectionMatrix * mv;
  }
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 u_sunDirection;
  uniform vec3 u_color;            // day-limb halo (cool blue)
  uniform vec3 u_backlightColor;   // backlit crescent (warm, scattered sunlight)
  uniform float u_backlightStrength;

  varying vec3 vNormalWorld;
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  varying vec3 vViewCenterDir;

  void main() {
    vec3 sunDir = normalize(u_sunDirection);
    float cosSun = dot(vNormalWorld, sunDir);

    // Limb glow, following the reference (sangillee.com): brightest where the
    // shell's far-side normal points away from the camera — right at the planet's
    // edge — and fading outward to the shell's rim. The reference uses vPosition,
    // the view-space fragment direction (camera -> fragment); our vViewDir is its
    // negation (fragment -> camera), hence the minus sign.
    float rim = max(-dot(vViewDir, vNormalView), 0.0);

    // Day-limb halo: the soft blue glow, faded around the terminator so only the
    // daylit limb lights up.
    float dayFade = 1.0 / (1.0 + exp(-7.0 * (cosSun + 0.1)));
    float dayGlow = pow(3.0 * rim, 3.0) * dayFade;

    // Warm sunward-limb glow — the Sun "hitting the atmosphere". It lives on the
    // limb toward the Sun (sunwardLimb) and is lifted a lot when the Sun is behind
    // the disc from the camera (backlit), where the crescent wraps into a full
    // bright ring. Kept present (never fully off) and broad — a lower rim power
    // than the day halo — so it reads and blooms as a flare, not a hairline, from
    // a wide range of viewing angles rather than only at a perfect eclipse.
    float sunwardLimb = smoothstep(-0.25, 0.45, cosSun);
    float backlit = smoothstep(-0.20, 0.85, dot(vViewCenterDir, sunDir));
    float backGlow = pow(3.0 * rim, 2.0) * sunwardLimb * (0.35 + 1.65 * backlit) * u_backlightStrength;

    // Additive (a = 1): the blend adds this colour onto the scene, so the two
    // contributions simply sum. The warm scattered light reads distinct from the
    // cool day halo and, on the bloom layer, blooms into a soft flare.
    vec3 add = u_color * dayGlow + u_backlightColor * backGlow;
    gl_FragColor = vec4(add, 1.0);
  }
`;

/** A 1×1 placeholder so samplers are defined before textures finish loading. */
function placeholder(r: number, g: number, b: number, a = 255): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array([r, g, b, a]), 1, 1);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Build the Earth. Textures load asynchronously and slot into the shader's
 * uniforms as they arrive; placeholders keep the sphere valid until then.
 */
export function createEarth(radius: number, options: EarthOptions = {}): EarthHandle {
  const base = options.textureBase ?? DEFAULT_TEXTURE_BASE;
  const withAtmosphere = options.atmosphere ?? true;

  const imageLoader = new THREE.TextureLoader();
  const tiffLoader = new TIFFLoader();
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };

  // Placeholders: flat normal (128,128,255 → +Z), no spec, no cloud, dim day.
  const dayTex = track(placeholder(40, 60, 90));
  const nightTex = track(placeholder(0, 0, 0));
  // const normalTex = track(placeholder(128, 128, 255));
  const specTex = track(placeholder(0, 0, 0));
  const cloudTex = track(placeholder(0, 0, 0));

  const sunDir = new THREE.Vector3(0, 0, 1);

  const uniforms = {
    u_dayTexture: { value: dayTex as THREE.Texture },
    u_nightTexture: { value: nightTex as THREE.Texture },
    // u_normalTexture: { value: normalTex as THREE.Texture },
    u_specTexture: { value: specTex as THREE.Texture },
    u_cloudTexture: { value: cloudTex as THREE.Texture },
    u_sunDirection: { value: sunDir },
    u_position: { value: new THREE.Vector3() },
  };

  const globeGeometry = track(new THREE.SphereGeometry(radius, 96, 96));
  // The shader's normal map needs a tangent frame.
  globeGeometry.computeTangents();

  const globeMaterial = track(
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: EARTH_VERTEX,
      fragmentShader: EARTH_FRAGMENT,
    }),
  );
  const globe = new THREE.Mesh(globeGeometry, globeMaterial);
  globe.name = 'Earth-globe';

  const group = new THREE.Group();
  group.name = 'Earth';
  // The globe's orientation (axial tilt AND rotational phase) is set every frame
  // from the real Earth orientation in update(); the group only carries position.
  group.add(globe);

  // Atmosphere: a back-side shell 2.5% larger, glowing on the daylit limb. It
  // shares the same sunDir Vector3 instance, so per-frame updates reach it too.
  if (withAtmosphere) {
    const atmoGeometry = track(new THREE.SphereGeometry(radius * 1.04, 64, 64));
    const atmoMaterial = track(
      new THREE.ShaderMaterial({
        uniforms: {
          u_sunDirection: { value: sunDir },
          u_color: { value: new THREE.Color(0x3a7bd5) },
          // Warm, faintly orange scattered sunlight for the backlit limb.
          u_backlightColor: { value: new THREE.Color(0xffd9a8) },
          u_backlightStrength: { value: 0.7 },
        },
        vertexShader: ATMOSPHERE_VERTEX,
        fragmentShader: ATMOSPHERE_FRAGMENT,
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const atmosphere = new THREE.Mesh(atmoGeometry, atmoMaterial);
    atmosphere.name = 'Earth-atmosphere';
    // On the bloom layer (keeping layer 0) so the backlit ring blooms into a soft
    // flare, like the Sun and the orbit dots — the same glow pass lights it.
    atmosphere.layers.enable(BLOOM_LAYER);
    group.add(atmosphere);
  }

  // --- Texture wiring ------------------------------------------------------
  // Grazing-angle sharpness for every map; the JPGs already mipmap themselves.
  const ANISOTROPY = 8;
  imageLoader.load(base + '8k_earth_daymap.jpg', (tex) => {
    tex.anisotropy = ANISOTROPY;
    uniforms.u_dayTexture.value = track(tex);
    dayTex.dispose();
  });
  imageLoader.load(base + '8k_earth_nightmap.jpg', (tex) => {
    tex.anisotropy = ANISOTROPY;
    uniforms.u_nightTexture.value = track(tex);
    nightTex.dispose();
  });
  imageLoader.load(base + '8k_earth_clouds.jpg', (tex) => {
    tex.anisotropy = ANISOTROPY;
    uniforms.u_cloudTexture.value = track(tex);
    cloudTex.dispose();
  });

  // TIFFLoader hands back a DataTexture with NO mipmaps and a plain-linear
  // minFilter. Without mipmaps the high-frequency normal/spec maps alias into
  // torn stripes at grazing angles — and u_normalPower amplifies that noise.
  // Both maps are 2048×1024 (power-of-two), so trilinear mipmapping is valid.
  const mipmapData = (tex: THREE.Texture): void => {
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = ANISOTROPY;
    tex.needsUpdate = true;
  };
  // tiffLoader.load(base + '2k_earth_normal_map.tif', (tex) => {
  //   mipmapData(tex);
  //   uniforms.u_normalTexture.value = track(tex);
  //   normalTex.dispose();
  // });
  tiffLoader.load(base + '2k_earth_specular_map.tif', (tex) => {
    mipmapData(tex);
    uniforms.u_specTexture.value = track(tex);
    specTex.dispose();
  });

  // --- Per-frame update ----------------------------------------------------
  const basisMatrix = new THREE.Matrix4();
  const cx = new THREE.Vector3();
  const cy = new THREE.Vector3();
  const cz = new THREE.Vector3();

  const update = (earthWorldPos: THREE.Vector3, simTimeMs: number): void => {
    // Orient the globe to the true Earth rotation at this instant, so the right
    // geographic longitude faces the Sun (Europe dark when it's night there).
    const b = earthOrientationBasis(new Date(simTimeMs));
    basisMatrix.makeBasis(cx.fromArray(b.x), cy.fromArray(b.y), cz.fromArray(b.z));
    globe.quaternion.setFromRotationMatrix(basisMatrix);

    // Sun sits at the world origin, so Earth → Sun is just -position.
    sunDir.copy(earthWorldPos).multiplyScalar(-1);
    if (sunDir.lengthSq() < 1e-12) sunDir.set(0, 0, 1);
    sunDir.normalize();

    uniforms.u_position.value.copy(earthWorldPos);
  };

  const dispose = (): void => {
    for (const r of disposables) r.dispose();
  };

  return { group, update, dispose };
}
