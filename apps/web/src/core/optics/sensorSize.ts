export type SensorSize = {
  width_mm: number;
  height_mm: number;
  diagonal_mm: number;
};

/**
 * Imaging area of a sensor from its pixel pitch and resolution. Datasheet
 * resolutions count effective pixels, so this is the active area, which is
 * what framing cares about. ASI585MC: 2.9 µm × 3840×2160 → 11.1 × 6.3 mm.
 * Derived, never stored, so it can't disagree with the specs.
 */
export function sensorSize(pixel_size_um: number, resolution_x: number, resolution_y: number): SensorSize {
  const width_mm = (pixel_size_um * resolution_x) / 1000;
  const height_mm = (pixel_size_um * resolution_y) / 1000;
  return { width_mm, height_mm, diagonal_mm: Math.hypot(width_mm, height_mm) };
}
