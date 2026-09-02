# The solar-system engine

A framework-free, imperative Three.js renderer for a heliocentric solar system.
Construct it with a DOM container, feed it objects, call `start()`; a React
component (`SolarSystemMap.tsx`) only owns its lifecycle. No React, MUI or `fetch`
lives in here.

**Coordinate frame throughout:** heliocentric, ecliptic of J2000, in AU. The Sun
is at the origin. In Three world space the ecliptic lies on the XZ plane and
ecliptic north is +Y (`frames.ts` maps `(x,y,z)_ecliptic → (x, z, -y)_world`).
Times are epoch milliseconds.

## The one rule: bodies handle themselves

The engine is a thin orchestrator. It owns the renderer, the camera, the clock
and a flat list of **entities**, and each frame it does exactly this:

```ts
for (const entity of this.entities) entity.update(ctx);  // the whole scene
this.cameraController.update(dt);
this.pipeline.render();
```

It holds **no body-type knowledge** — no `if (isEarth)`, no per-body update
methods, no orbit-trail / Lagrange / trajectory machinery. What a body *is*, and
what it *has* (an orbit trail, moons, Lagrange points), is the body's own
business, declared in config. Adding a planet, a moon or an annotation is a new
module plus one config entry; **the engine file is never edited.**

## The scene graph

This is the contract. Every body is the same recursive shape.

```
Scene
└─ SolarSystemGroup                    ← the Sun's frame; origin = Sun
   ├─ Sun                              ← bare visual (the one non-recursive node)
   ├─ <Planet>SystemGroup             ← one per planet, sibling of Sun
   │  ├─ OrbitTrail                    ← heliocentric path, sampled in the Sun frame
   │  ├─ LagrangeGroup                 ← attached on request (addLagrangePoints)
   │  └─ BodyPlacement                 ← translate-only → planet's heliocentric position
   │     ├─ BodyVisual                 ← tilt + spin (the globe); gets the pixel-floor scale
   │     ├─ Label                      ← rides the body's position; no tilt/spin/floor scale
   │     └─ <Moon>SystemGroup          ← rides the planet's POSITION, not its spin
   │        ├─ OrbitTrail              ← geocentric ring, sampled in the planet frame
   │        ├─ LagrangeGroup           ← if ever configured
   │        └─ BodyPlacement           ← translate-only → moon's geocentric offset
   │           ├─ BodyVisual
   │           ├─ Label
   │           └─ …sub-moons (recurses identically)
   └─ <Spacecraft>SystemGroup         ← sibling of planets, heliocentric
      ├─ TrajectoryPath                ← open start→end polyline (not a periodic OrbitTrail)
      └─ BodyPlacement                 ← translate → interpolated table position
         ├─ BodyVisual                 ← model + orient-nose-along-tangent
         └─ Label
```

## Why two nodes per body (the frames)

Each body is **two nested groups**, and the split is load-bearing:

- **`<Body>SystemGroup`** sits at its **parent's** origin (identity transform for
  a heliocentric body, so it lands at the world origin). Children expressed in the
  *parent's frame* attach here: the body's own `OrbitTrail` and its
  `LagrangeGroup`. This is why a planet's heliocentric orbit path and a moon's
  geocentric ring use the **same code** — the parenting supplies the frame, so
  there's no per-frame "anchor" to add back.
- **`BodyPlacement`** is **translation-only**, moved each frame to the body's
  position in that parent frame. Everything that must ride the body's *position
  but not its rotation* attaches here: the tilting/spinning `BodyVisual`, the
  `Label`, and any child `<Moon>SystemGroup`.

The split exists because `BodyVisual` carries axial tilt and daily spin. If a moon
(or a label) were a child of the visual, it would inherit that spin and whip
around the planet once a day. So moons hang off `BodyPlacement` — Earth's
position, not Earth's rotation — and are themselves whole `Body` subtrees, which
is what makes moons-of-moons fall out for free.

The Sun is the one deliberate exception: it never orbits, has no trail and no
parent, so it's a bare visual at the origin rather than a full `Body`.

## Everything is a `SceneEntity`

```ts
interface SceneEntity {
  readonly object3D: THREE.Object3D;   // parented into the scene
  update(ctx: FrameContext): void;     // advance to this frame
  dispose(): void;                     // release GPU resources
}
```

`Body`, `OrbitTrail`, `SunEntity`, `LagrangeGroup` and `SpacecraftEntity` all
implement it. `Body` is recursive: its `update` positions its `BodyPlacement`,
updates and pixel-floors its visual, refills its trail, then recurses into its
attachments (Lagrange) and children (moons) — parent before child, so a moon's
world transform is current when it reads it.

`FrameContext` is the per-frame input bundle — `simTimeMs`, `dt`, `camera`,
`viewportHeight` — so the entity contract stays stable as needs grow. `simTimeMs`
drives deterministic position/spin (scrubbing the clock is exact); `dt` drives
ambient animation (the Sun's surface churn) independent of the sim clock.

## The two seams

- **`PickRegistry`** is the seam between bodies and the camera. Bodies register
  what can be clicked and how big it is (`addBody(root, pickTarget, radiusAu)` /
  `addPickable`); the `CameraController` raycasts against it to choose a rotation
  pivot and a zoom target, and resolves a raw hit up to the body it belongs to
  (`resolvePivotRoot`). The camera never reaches into a body; a body never knows
  how picking works.
- **`FrameContext`** is the seam between the engine's clock/viewport and the
  entities.

## Module map

```
SolarSystemEngine.ts   orchestrator: renderer, clock, entity list, RAF loop, dispose
SceneEntity.ts         the SceneEntity contract + FrameContext
frames.ts  ephemeris.ts            pure astronomy (positions, unit maps) — tested
sizing.ts (+ .test)    drawnRadius + the pixel-floor maths — pure, tested
labels.ts              billboarded CSS2D labels
render/BloomPipeline.ts   selective-bloom post-processing (only Sun + orbit dots glow)
render/skybox.ts       equirectangular panorama loader
camera/PickRegistry.ts        the pick seam (pickables + radii + pivot resolution)
camera/CameraController.ts    OrbitControls, wheel-dolly, click-to-focus, adaptive clipping
bodies/Body.ts         the generic recursive body (+ BodyVisual)
bodies/orbitTrail.ts   the dotted comet-tail entity
bodies/SunEntity.ts    the Sun (bare visual at the origin)
bodies/LagrangeGroup.ts       Sun–Earth Lagrange markers, attached to the Earth body
bodies/SpacecraftEntity.ts    a table-driven spacecraft/comet, riding the body it orbits
bodies/solarSystem.ts  assembler: PLANETS → Body[] (Earth carries the Moon)
bodies/planets.ts      the eight PlanetConfig entries (true radii, periods, colours)
bodies/planetBody.ts + <planet>.ts   per-planet textured visuals
bodies/earth.ts        the Earth shader (day/night/clouds/atmosphere)
bodies/moon.ts         the Moon visual
bodies/lagrange.ts     the pure Lagrange-point maths — tested
```

The dependency direction is one way: `frames`/`ephemeris`/`lagrange`/`sizing`
(pure) → the `bodies/*` visuals and entities → `SolarSystemEngine` (wires them and
runs the loop). The camera depends on bodies only through `PickRegistry`.

## Adding to the scene

- **A new planet:** add a `PlanetConfig` to `bodies/planets.ts` (true radius,
  sidereal period, colour, and a `create` visual factory). `solarSystem.ts` turns
  it into a `Body` automatically. Nothing else changes.
- **A moon (for any planet):** build a `Body` whose `positionInParentFrame` is the
  moon's **geocentric** offset from its planet, and pass it in that planet's
  `children`. Its ring becomes geocentric for free. See `createMoonBody`.
- **An annotation on a body** (like Lagrange): implement `SceneEntity`, then
  `someBody.attach(entity)` — it lives under that body's `SystemGroup`, in the
  parent frame, and is advanced and disposed with the body.
- **A spacecraft / table-driven object:** `engine.setSpacecraft(config)`. Its
  `config.parentBody` names the body it orbits (e.g. `'Earth'`); the points are
  offsets from that body, so it's parented under it and its path rides along like a
  moon (RST's L2 halo travels with Earth). Call it again to replace the spacecraft;
  only that entity is rebuilt.

Whichever it is, `SolarSystemEngine.ts` is not touched.

## Invariants & gotchas

- **The Sun is at the origin.** Every `SystemGroup` sits at its parent's origin,
  so the whole heliocentric chain is at the world origin; only `BodyPlacement`
  nodes (and a moon's `SystemGroup`, which hangs off Earth's placement) are
  translated. Heliocentric coordinates therefore render as-is.
- **`BodyPlacement` never rotates.** Orientation (the spacecraft's nose, the
  Earth's spin) is set on the visual, and because placement is translation-only, a
  world-space orientation applied to the visual's local quaternion is correct.
- **The Moon is Earth's child**, positioned by `geoMoonPosition` (geocentric), not
  by a heliocentric Moon ephemeris. `earthPos + geoMoon == helioMoon`, so it lands
  in the right place while its ring reads as a loop around Earth.
- **The pixel floor scales the visual, not the pivot.** A body registers its
  *true* radius, so zoom stops at the real surface even while the visual is scaled
  up to stay visible when far. The Sun is deliberately never floored.
- **Bloom is a layer opt-in.** Only the Sun and the orbit dots enable
  `BLOOM_LAYER`; everything else is masked to black in the bloom pass. New glowing
  things must opt in; the orbit-dot texture is a shared, never-disposed singleton.
- **A `PlanetConfig` with no `create`** falls back to a flat coloured sphere, so a
  planet can be added before its dedicated visual exists.
