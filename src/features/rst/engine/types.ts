import type { Body } from 'astronomy-engine';
import { Object3D } from "three";
import type { PlanetHandle } from './bodies/planetBody.ts';

/** A plain 3-vector. Units depend on context (AU for positions here). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * One point on an object's trajectory: a heliocentric ecliptic-of-J2000
 * position (AU) tagged with the epoch (ms) it is valid for. This is exactly the
 * shape JPL Horizons vector tables give us once km is converted to AU.
 */
export interface TrajectoryPoint {
  timeMs: number;
  position: Vec3;
}

/** A custom object (spacecraft, comet, …) placed by an explicit ephemeris. */
export interface TrajectoryObjectConfig {
  id: string;
  /**
   * Name of the body this object orbits (e.g. 'Earth'). Its trajectory points are
   * offsets FROM that body — the JPL Horizons vector table is generated with that
   * body as the center — so the engine parents the object under it and the path
   * rides along, like a moon. This is what makes the placement general: RST orbits
   * Earth's L2, but another probe can name any body it circles.
   */
  parentBody: string;
  /** Marker + default path colour (0xRRGGBB). */
  color: number;
  /** Marker display radius in AU (exaggerated; not physical). */
  radius?: number;
  /** Optional distinct colour for the drawn path line. */
  pathColor?: number;
  /** Points ordered ascending by time. */
  points: TrajectoryPoint[];

  /**
   * Already formed Three 3D object
   */
  object?: Object3D

  /** Optional text label pinned to the object (billboarded, always faces you). */
  label?: string

  /**
   * Rotate the object each frame so its nose follows the direction of travel
   * along the trajectory. The convention is that the object's forward/nose axis
   * points to +Z in its own space; set the object's base `rotation` to bring the
   * nose onto +Z, and the engine composes the tangent orientation on top of it.
   * Meaningless for the default sphere marker. Defaults to false.
   */
  orientToTrajectory?: boolean

}

/** A planet: astronomy-engine body + how to draw it. */
export interface PlanetConfig {
  body: Body;
  label: string;
  color: number;
  /** True mean radius in AU. The engine compresses it into a drawn size. */
  radiusAu: number;
  /** Sidereal orbital period in days, used to compute a full orbit path. */
  orbitalPeriodDays: number;
  /**
   * Build this planet's textured body (its own file, e.g. mars.ts). Given the
   * drawn radius, returns a handle the engine adds, positions, spins and
   * disposes. Omit to fall back to a flat-shaded coloured sphere. Earth is the
   * one exception — it has its own bespoke path (see earth.ts).
   */
  create?: (drawnRadius: number) => PlanetHandle;
}

export interface EngineOptions {
  /** Simulation start instant. Defaults to now. */
  startDate?: Date;
  /**
   * URL of an equirectangular (2:1) panorama to use as the sky background — e.g.
   * a starfield. Loaded async; the dark fallback colour shows until it arrives.
   */
  skyboxUrl?: string;
  /**
   * Simulated seconds advanced per real wall-clock second. 1 = real-time,
   * 3600 = one hour per second, and so on. Defaults to 1 (real-time).
   */
  timeScale?: number;
  /**
   * Point the camera orbits and zooms around, in heliocentric ecliptic AU.
   * Defaults to the Sun (origin). Set this to your subject (e.g. a spacecraft)
   * so rotation and zoom-to-cursor feel centred on what matters.
   */
  focus?: Vec3;
  /** Initial camera distance from the focus, in AU. Defaults to 3. */
  viewDistance?: number;
  /** Closest the camera may zoom to the focus, in AU. Defaults to 1e-5 — small
   *  enough to reach a true-scale terrestrial planet's surface. */
  minDistance?: number;
  /** Farthest the camera may zoom out, in AU. Defaults to 60 (past Neptune). */
  maxDistance?: number;
  /**
   * Body sizes are drawn as `sizeScale × radiusAu^sizeCompression`, one
   * monotonic rule for the Sun and every planet. The exponent < 1 compresses
   * the enormous true range (Sun is ~285× Mercury) so the smallest bodies are
   * still visible while the Sun stays the largest and the giants stay largest
   * among the planets. It is NOT true linear scale — that's geometrically
   * impossible to show without the Sun engulfing the inner orbits — but the
   * ordering is honest. `sizeCompression: 1` gives true (sub-pixel) scale.
   * Defaults: sizeScale 4.0, sizeCompression 0.5 (square-root).
   *
   * Ignored when `trueScale` is on — the two are different answers to the same
   * problem, and `trueScale` + `minPixelRadius` is the better one (see below).
   */
  sizeScale?: number;
  sizeCompression?: number;
  /**
   * Build every body at its TRUE radius (radiusAu, unmodified) instead of the
   * compressed power-law size. On its own this is the "shrinks below a pixel"
   * problem — a planet is ~1/10,000th of its orbit, so at any zoom that frames
   * orbits it's sub-pixel. Pair it with `minPixelRadius`: then bodies read at
   * honest scale once you fly close (the Sun genuinely dwarfing Earth), while
   * the pixel floor keeps them visible when you're zoomed out. Defaults false.
   */
  trueScale?: boolean;
  /**
   * Screen-space visibility floor, in pixels. Every frame, a body whose drawn
   * radius would fall below this many pixels on screen is scaled up just enough
   * to hold this apparent size, so it never vanishes however far you zoom out.
   * Above the floor the body keeps its real world size, so zooming in reveals
   * honest proportions (essential with `trueScale`). 0 disables the floor.
   * Applies to the Sun and planets only — not annotation markers (Lagrange,
   * custom trajectory objects), whose sizes the caller controls. Defaults 0.
   */
  minPixelRadius?: number;
}
