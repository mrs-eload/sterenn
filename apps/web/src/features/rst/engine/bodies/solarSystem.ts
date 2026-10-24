import * as THREE from 'three';
import { Body as AstroBody } from 'astronomy-engine';
import { Body } from './Body';
import type { BodyVisual } from './Body';
import { PLANETS } from './planets.ts';
import { createEarth } from './earth.ts';
import type { EarthHandle } from './earth.ts';
import { createMoon } from './moon.ts';
import type { PlanetHandle } from './planetBody.ts';
import { drawnRadius } from '../sizing';
import type { SizeModel } from '../sizing';
import { KM_PER_AU, eclipticToWorld } from '../frames';
import { planetPosition, geoMoonPosition } from '../ephemeris';
import type { FrameContext } from '../SceneEntity';
import type { PickRegistry } from '../camera/PickRegistry';

const DAY_MS = 86_400_000;

// The Moon's true mean radius (km) and sidereal orbital period about Earth (days).
const MOON_RADIUS_KM = 1737.4;
const MOON_SIDEREAL_DAYS = 27.321661;

export interface SolarSystemDeps {
  sizeModel: SizeModel;
  /** Screen-space visibility floor (px) applied to every planet and moon. */
  minPixelRadius: number;
  picks: PickRegistry;
}

/** Wrap a textured-planet / Moon handle (spins on sim time) as a BodyVisual. */
function planetVisual(handle: PlanetHandle, baseRadius: number): BodyVisual {
  return {
    object: handle.object,
    pickTarget: handle.pickTarget,
    baseRadius,
    update: (ctx: FrameContext): void => handle.update?.(ctx.simTimeMs),
    dispose: (): void => handle.dispose(),
  };
}

/** Wrap the Earth shader handle (needs its world position each frame) as a BodyVisual. */
function earthVisual(handle: EarthHandle, baseRadius: number): BodyVisual {
  // Pick against the globe child so click-to-pivot still lands on Earth.
  const globe = handle.group.getObjectByName('Earth-globe') ?? undefined;
  return {
    object: handle.group,
    pickTarget: globe,
    baseRadius,
    update: (ctx: FrameContext, worldPos: THREE.Vector3): void =>
      handle.update(worldPos, ctx.simTimeMs),
    dispose: (): void => handle.dispose(),
  };
}

/** A flat coloured sphere — the fallback for a planet with no dedicated body file. */
function sphereVisual(baseRadius: number, color: number): BodyVisual {
  const geometry = new THREE.SphereGeometry(baseRadius, 24, 24);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });
  const mesh = new THREE.Mesh(geometry, material);
  return {
    object: mesh,
    baseRadius,
    dispose: (): void => {
      geometry.dispose();
      material.dispose();
    },
  };
}

/**
 * The Moon as Earth's child body. Its position is GEOCENTRIC (an offset from
 * Earth), so nested under Earth it lands at the right heliocentric spot; its
 * orbit ring, also geocentric and parented under the Moon's SystemGroup (which
 * sits at Earth), reads as a loop centred on Earth with no per-frame anchoring.
 */
function createMoonBody(deps: SolarSystemDeps): Body {
  const baseRadius = drawnRadius(MOON_RADIUS_KM / KM_PER_AU, deps.sizeModel);
  const handle = createMoon(baseRadius);
  return new Body({
    name: 'Moon',
    label: 'Moon',
    labelColor: '#cfd3da',
    visual: planetVisual(handle, baseRadius),
    positionInParentFrame: (ms) => eclipticToWorld(geoMoonPosition(new Date(ms))),
    orbitTrail: {
      color: 0x9aa3b0,
      periodMs: MOON_SIDEREAL_DAYS * DAY_MS,
      sampleAt: (ms) => eclipticToWorld(geoMoonPosition(new Date(ms))),
    },
    minPixelRadius: deps.minPixelRadius,
    picks: deps.picks,
  });
}

export interface SolarSystemBodies {
  /** All eight planets, ready to add to the scene as entities. */
  bodies: Body[];
  /** The Earth body, exposed so callers can attach annotations (Lagrange) to it. */
  earth: Body;
}

/**
 * Build the eight planets as tree bodies — Earth carrying the Moon as a child.
 * Each planet is heliocentric with a dotted orbit trail; the per-body visual
 * (Earth's shader, a textured sphere, or the flat fallback) is chosen here, in
 * the bodies layer, so the engine never branches on body type.
 */
export function createPlanetBodies(deps: SolarSystemDeps): SolarSystemBodies {
  let earth: Body | undefined;
  const bodies = PLANETS.map((cfg) => {
    const baseRadius = drawnRadius(cfg.radiusAu, deps.sizeModel);
    let visual: BodyVisual;
    let children: Body[] | undefined;
    const isEarth = cfg.body === AstroBody.Earth;
    if (isEarth) {
      visual = earthVisual(createEarth(baseRadius), baseRadius);
      children = [createMoonBody(deps)];
    } else if (cfg.create) {
      visual = planetVisual(cfg.create(baseRadius), baseRadius);
    } else {
      visual = sphereVisual(baseRadius, cfg.color);
    }
    const body = new Body({
      name: cfg.label,
      label: cfg.label,
      labelColor: '#' + cfg.color.toString(16).padStart(6, '0'),
      visual,
      positionInParentFrame: (ms) => eclipticToWorld(planetPosition(cfg.body, new Date(ms))),
      orbitTrail: {
        color: cfg.color,
        periodMs: cfg.orbitalPeriodDays * DAY_MS,
        sampleAt: (ms) => eclipticToWorld(planetPosition(cfg.body, new Date(ms))),
      },
      minPixelRadius: deps.minPixelRadius,
      picks: deps.picks,
      children,
    });
    if (isEarth) earth = body;
    return body;
  });
  // Earth is always present in PLANETS, so this is defined.
  return { bodies, earth: earth! };
}
