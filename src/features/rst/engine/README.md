# Engine scene graph

The target composition. Every body is the same recursive shape; the engine holds
no body-type knowledge — what a body has (orbit trail, Lagrange points, moons) is
declared in its config, not coded in the engine.

```
Scene
└─ SolarSystemGroup                    ← the Sun's frame; origin = Sun
   ├─ Sun                              ← bare visual (the one non-recursive node)
   ├─ <Planet>SystemGroup             ← one per planet, sibling of Sun
   │  ├─ OrbitTrail                    ← heliocentric path, sampled in the Sun frame
   │  ├─ LagrangeGroup                 ← only if config.lagrange is set
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

Frames, from the two nested groups per body:

- **`<Body>SystemGroup`** sits at the **parent's** origin. Children expressed in
  the parent's frame attach here: the body's own `OrbitTrail` (a planet's path is
  heliocentric; a moon's ring is geocentric — same code, different parent) and its
  `LagrangeGroup`.
- **`BodyPlacement`** is translation-only, moved each frame to the body's position
  in that parent frame. Everything that must ride the body's *position but not its
  rotation* attaches here: the spinning/tilting `BodyVisual`, the `Label`, and any
  child `<Moon>SystemGroup`.
