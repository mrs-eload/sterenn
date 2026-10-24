import { describe, expect, it } from 'vitest';
import { sensorSize } from './sensorSize';

describe('sensorSize', () => {
  it('matches the ASI585MC datasheet (11.2 × 6.3 mm)', () => {
    const size = sensorSize(2.9, 3840, 2160);
    expect(size.width_mm).toBeCloseTo(11.136, 3);
    expect(size.height_mm).toBeCloseTo(6.264, 3);
    expect(size.diagonal_mm).toBeCloseTo(12.777, 3);
  });

  it('works in mm, not µm', () => {
    // 1 µm pixels × 1000 px = exactly 1 mm.
    expect(sensorSize(1, 1000, 1000).width_mm).toBe(1);
  });
});
