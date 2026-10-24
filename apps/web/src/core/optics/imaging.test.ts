import { describe, expect, it } from 'vitest';
import { effectiveFocalLength, fieldOfView, imageScale } from './imaging';

describe('effectiveFocalLength', () => {
  it('is the native focal length with no corrector', () => {
    expect(effectiveFocalLength(264, [])).toBe(264);
  });

  it('applies a reducer (SQA55 264 mm × 0.8 = 211.2 mm)', () => {
    expect(effectiveFocalLength(264, [0.8])).toBeCloseTo(211.2, 6);
  });

  it('compounds several multipliers', () => {
    expect(effectiveFocalLength(1000, [0.8, 2])).toBeCloseTo(1600, 6);
  });
});

describe('imageScale', () => {
  it('matches the usual 206.265 × pixel / focal length (ASI585 on 264 mm ≈ 2.27″/px)', () => {
    expect(imageScale(2.9, 264)).toBeCloseTo(2.2658, 3);
  });
});

describe('fieldOfView', () => {
  it('gives the ASI585 on 264 mm as about 2.4° × 1.4°', () => {
    const fov = fieldOfView(2.9, 3840, 2160, 264);
    expect(fov.width_deg).toBeCloseTo(2.416, 2);
    expect(fov.height_deg).toBeCloseTo(1.359, 2);
  });

  it('works in mm, not µm: a 1 mm sensor at 1000 mm spans about 0.0573°', () => {
    expect(fieldOfView(1, 1000, 1000, 1000).width_deg).toBeCloseTo(0.0573, 4);
  });
});
