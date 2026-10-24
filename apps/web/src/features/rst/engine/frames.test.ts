import { describe, it, expect } from 'vitest';
import { KM_PER_AU, kmToAu, eclipticToWorld } from './frames';

describe('kmToAu', () => {
  it('converts one AU of kilometres to 1 AU on each axis', () => {
    expect(kmToAu({ x: KM_PER_AU, y: -KM_PER_AU, z: 0 })).toEqual({ x: 1, y: -1, z: 0 });
  });
});

describe('eclipticToWorld', () => {
  it('lays the ecliptic on the XZ plane and sends ecliptic north to +Y', () => {
    // (x, y, z)_ecl -> (x, z, -y)_world
    expect(eclipticToWorld({ x: 1, y: 2, z: 3 })).toEqual([1, 3, -2]);
  });

  it('keeps a point in the ecliptic plane (z=0) on the ground plane (y=0)', () => {
    const [, y] = eclipticToWorld({ x: 0.7, y: -0.7, z: 0 });
    expect(y).toBe(0);
  });

  it('is a proper rotation — it preserves length', () => {
    const v = { x: 3, y: -4, z: 12 };
    const [x, y, z] = eclipticToWorld(v);
    const before = Math.hypot(v.x, v.y, v.z);
    const after = Math.hypot(x, y, z);
    expect(after).toBeCloseTo(before, 10);
  });
});
