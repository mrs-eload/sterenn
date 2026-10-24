// 206 265 arcseconds per radian; with pixels in µm and focal length in mm the
// factors of 1000 cancel to this constant.
const ARCSEC_PER_RAD_MILLI = 206.265;

/**
 * Focal length after every reducer or barlow in the train: a 0.8× reducer on
 * a 264 mm scope gives 211.2 mm. Multipliers compound, so two 0.8× give 0.64×.
 */
export function effectiveFocalLength(native_focal_length_mm: number, focal_multipliers: number[]): number {
  return focal_multipliers.reduce((focal_length, multiplier) => focal_length * multiplier, native_focal_length_mm);
}

/** Sky angle covered by one pixel, in arcseconds per pixel. */
export function imageScale(pixel_size_um: number, focal_length_mm: number): number {
  return (ARCSEC_PER_RAD_MILLI * pixel_size_um) / focal_length_mm;
}

/**
 * Field of view of the sensor, in degrees. Uses the exact angle (atan) rather
 * than the small-angle approximation, which drifts on short focal lengths.
 */
export function fieldOfView(
  pixel_size_um: number,
  resolution_x: number,
  resolution_y: number,
  focal_length_mm: number,
): { width_deg: number; height_deg: number } {
  const angle = (pixels: number) =>
    (2 * Math.atan((pixel_size_um * pixels) / 1000 / (2 * focal_length_mm)) * 180) / Math.PI;
  return { width_deg: angle(resolution_x), height_deg: angle(resolution_y) };
}
