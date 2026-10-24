import {
  EmissionLine,
  EquipmentType,
  FilterType,
  type Passband,
  type EquipmentResponse,
  type EquipmentThreadResponse,
  type RigPart,
  type RigResponse,
  type ThreadSizeResponse,
} from '@sterenn/shared';
import { effectiveFocalLength, fieldOfView, imageScale } from '@app/core/optics/imaging';
import { sensorSize } from '@app/core/optics/sensorSize';

// Pure display helpers for the equipment screens: labels, summaries and the
// adapter from API responses to the shared rig rules. No React here.

export const TYPE_ORDER: EquipmentType[] = Object.values(EquipmentType);

export const TYPE_LABEL: Record<EquipmentType, string> = {
  [EquipmentType.MOUNT]: 'Mount',
  [EquipmentType.TELESCOPE]: 'Telescope',
  [EquipmentType.CAMERA]: 'Camera',
  [EquipmentType.FILTER_HOLDER]: 'Filter holder',
  [EquipmentType.FILTER]: 'Filter',
  [EquipmentType.ADAPTER]: 'Adapter',
  [EquipmentType.CORRECTOR]: 'Corrector',
};

export const TYPE_PLURAL: Record<EquipmentType, string> = {
  [EquipmentType.MOUNT]: 'Mounts',
  [EquipmentType.TELESCOPE]: 'Telescopes',
  [EquipmentType.CAMERA]: 'Cameras',
  [EquipmentType.FILTER_HOLDER]: 'Filter holders',
  [EquipmentType.FILTER]: 'Filters',
  [EquipmentType.ADAPTER]: 'Adapters',
  [EquipmentType.CORRECTOR]: 'Correctors',
};

// Tabler icons through Iconify, as in the design; the mount uses iconoven:tripod.
export const TYPE_ICON: Record<EquipmentType, string> = {
  [EquipmentType.MOUNT]: 'iconoven:tripod',
  [EquipmentType.TELESCOPE]: 'tabler:telescope',
  [EquipmentType.CAMERA]: 'tabler:camera',
  [EquipmentType.FILTER_HOLDER]: 'tabler:wheel',
  [EquipmentType.FILTER]: 'tabler:color-filter',
  [EquipmentType.ADAPTER]: 'tabler:plug-connected',
  [EquipmentType.CORRECTOR]: 'tabler:lens-convex',
};

// Equipment that can sit in the optical chain.
export const CHAIN_TYPES: EquipmentType[] = [
  EquipmentType.TELESCOPE,
  EquipmentType.CORRECTOR,
  EquipmentType.ADAPTER,
  EquipmentType.FILTER_HOLDER,
  EquipmentType.CAMERA,
];

const OPTION_LABEL: Record<string, string> = {
  equatorial: 'Equatorial',
  alt_az: 'Alt-az',
  refractor: 'Refractor',
  reflector: 'Reflector',
  catadioptric: 'Catadioptric',
  color: 'Color',
  mono: 'Mono',
  wheel: 'Wheel',
  drawer: 'Drawer',
  male: 'Male',
  female: 'Female',
  front: 'Front',
  rear: 'Rear',
  inside: 'Inside',
  // Also the Ha filter type, which shares the value.
  [EmissionLine.H_ALPHA]: 'Hα',
  [EmissionLine.H_BETA]: 'Hβ',
  [FilterType.DUAL_BAND]: 'Dual-band',
  [FilterType.OTHER]: 'Other',
};

export function optionLabel(value: string): string {
  return OPTION_LABEL[value] ?? value;
}

// "Hα 7 nm" for a line band, "656.3 / 7 nm" for one without a line.
export function passbandLabel(band: Passband): string {
  // `line` is absent on bands saved before it existed.
  return band.line ? `${optionLabel(band.line)} ${band.bandwidth_nm} nm` : `${band.center_nm} / ${band.bandwidth_nm} nm`;
}

export function grams(value: number | null): string | null {
  return value === null ? null : `${value.toLocaleString('en-GB').replace(/,/g, ' ')} g`;
}

const withUnit = (value: number | null, unit: string): string | null => (value === null ? null : `${value} ${unit}`);

// "11.1 × 6.3 mm · ⌀ 12.8 mm", derived from pixel size and resolution.
export function sensorSizeLabel(pixel_size_um: number, resolution_x: number, resolution_y: number): string {
  const { width_mm, height_mm, diagonal_mm } = sensorSize(pixel_size_um, resolution_x, resolution_y);
  return `${width_mm.toFixed(1)} × ${height_mm.toFixed(1)} mm · ⌀ ${diagonal_mm.toFixed(1)} mm`;
}

export type ThreadSizeIndex = ReadonlyMap<string, ThreadSizeResponse>;

// "T2 · M42×0.75", or "M48×0.75" when the size has no common name.
export function threadSizeLabel(thread_size: ThreadSizeResponse | undefined): string {
  if (!thread_size) {
    return 'Unknown size';
  }
  const metric = `M${thread_size.diameter_mm}×${thread_size.pitch_mm}`;
  return thread_size.name ? `${thread_size.name} · ${metric}` : metric;
}

// "T2", or "M48" when unnamed: for tight spots like table cells and connectors.
export function threadSizeShort(thread_size: ThreadSizeResponse | undefined): string {
  if (!thread_size) {
    return '?';
  }
  return thread_size.name ?? `M${thread_size.diameter_mm}`;
}

export function threadAt(equipment: EquipmentResponse, position: string): EquipmentThreadResponse | undefined {
  return equipment.threads.find((thread) => thread.position === position);
}

// The label/value rows of the detail panel, in the design's order. Empty
// values are filtered out by the caller.
export function specRows(equipment: EquipmentResponse): [string, string | null][] {
  switch (equipment.type) {
    case EquipmentType.MOUNT: {
      const specs = equipment.specs;
      return [
        ['Mount type', optionLabel(specs.mount_type)],
        ['GoTo', specs.goto ? 'Yes' : 'No'],
        ['Payload capacity', grams(specs.payload_capacity_g)],
        ['GoTo precision', specs.goto_precision],
      ];
    }
    case EquipmentType.TELESCOPE: {
      const specs = equipment.specs;
      const backfocus =
        specs.backfocus_min_mm === null
          ? null
          : specs.backfocus_min_mm === specs.backfocus_max_mm || specs.backfocus_max_mm === null
            ? `${specs.backfocus_min_mm} mm`
            : `${specs.backfocus_min_mm}–${specs.backfocus_max_mm} mm`;
      return [
        ['Optical design', optionLabel(specs.optical_design)],
        ['Aperture', withUnit(specs.aperture_mm, 'mm')],
        ['Focal length', withUnit(specs.focal_length_mm, 'mm')],
        ['Backfocus', backfocus],
        ['Recommended backfocus', withUnit(specs.backfocus_recommended_mm, 'mm')],
        ['Tube length', withUnit(specs.tube_length_mm, 'mm')],
      ];
    }
    case EquipmentType.CAMERA: {
      const specs = equipment.specs;
      return [
        ['Pixel size', withUnit(specs.pixel_size_um, 'µm')],
        ['Resolution', `${specs.resolution_x} × ${specs.resolution_y}`],
        ['Sensor', optionLabel(specs.sensor_color)],
        ['Sensor chip', specs.sensor_chip],
        ['Sensor size', sensorSizeLabel(specs.pixel_size_um, specs.resolution_x, specs.resolution_y)],
        ['Cooled', specs.cooled === null ? null : specs.cooled ? 'Yes' : 'No'],
        ['Read noise', withUnit(specs.read_noise_e, 'e⁻')],
        ['Full well', specs.full_well_e === null ? null : `${(specs.full_well_e / 1000).toLocaleString('en-GB')} ke⁻`],
        ['Measured at gain', specs.measured_at_gain === null ? null : String(specs.measured_at_gain)],
      ];
    }
    case EquipmentType.FILTER_HOLDER: {
      const specs = equipment.specs;
      return [
        ['Holder type', optionLabel(specs.holder_type)],
        ['Positions', String(specs.positions)],
        ['Accepts disc', withUnit(specs.accepts_disc_diameter_mm, 'mm')],
      ];
    }
    case EquipmentType.FILTER: {
      const specs = equipment.specs;
      return [
        ['Filter type', optionLabel(specs.filter_type)],
        ['Mounting', specs.disc_diameter_mm ? `Unmounted · ${specs.disc_diameter_mm} mm disc` : 'Threaded'],
        [
          'Passbands',
          specs.passbands?.map(passbandLabel).join('  ·  ') ?? null,
        ],
      ];
    }
    case EquipmentType.CORRECTOR:
      return [['Focal multiplier', `×${equipment.specs.focal_multiplier}`]];
    case EquipmentType.ADAPTER:
      return [];
  }
}

// One-line summary under a model name.
export function summary(equipment: EquipmentResponse): string {
  switch (equipment.type) {
    case EquipmentType.MOUNT:
      return optionLabel(equipment.specs.mount_type) + (equipment.specs.goto ? ' · GoTo' : '');
    case EquipmentType.TELESCOPE:
      return `${equipment.specs.aperture_mm} mm · ${equipment.specs.focal_length_mm} mm · ${optionLabel(equipment.specs.optical_design)}`;
    case EquipmentType.CAMERA:
      return `${equipment.specs.pixel_size_um} µm · ${equipment.specs.resolution_x}×${equipment.specs.resolution_y} · ${optionLabel(equipment.specs.sensor_color)}`;
    case EquipmentType.FILTER_HOLDER:
      return `${optionLabel(equipment.specs.holder_type)} · ${equipment.specs.positions} ${equipment.specs.positions === 1 ? 'position' : 'positions'}`;
    case EquipmentType.FILTER:
      return (
        optionLabel(equipment.specs.filter_type) +
        (equipment.specs.disc_diameter_mm ? ` · ${equipment.specs.disc_diameter_mm} mm disc` : '')
      );
    case EquipmentType.CORRECTOR:
      return `×${equipment.specs.focal_multiplier}`;
    case EquipmentType.ADAPTER:
      return `${equipment.threads.length} threads`;
  }
}

export function toRigPart(equipment: EquipmentResponse): RigPart {
  return {
    id: equipment.id,
    type: equipment.type,
    manufacturer: equipment.manufacturer,
    model: equipment.model,
    threads: equipment.threads,
    positions: equipment.type === EquipmentType.FILTER_HOLDER ? equipment.specs.positions : null,
    accepts_disc_diameter_mm:
      equipment.type === EquipmentType.FILTER_HOLDER ? equipment.specs.accepts_disc_diameter_mm : null,
    disc_diameter_mm: equipment.type === EquipmentType.FILTER ? equipment.specs.disc_diameter_mm : null,
  };
}

export type RigStatus = { label: string; color: string; tone: 'danger' | 'warning' | 'success' };

// Ready / n warnings / Incomplete, from the rig's errors and warnings.
export function rigStatus(problems: { errors: string[]; warnings: string[] }): Omit<RigStatus, 'color'> {
  if (problems.errors.length > 0) {
    return { label: 'Incomplete', tone: 'danger' };
  }
  if (problems.warnings.length > 0) {
    const count = problems.warnings.length;
    return { label: `${count} warning${count > 1 ? 's' : ''}`, tone: 'warning' };
  }
  return { label: 'Ready', tone: 'success' };
}

// The role an item plays in a rig, for "Used in rigs".
export function roleInRig(rig: RigResponse, equipment_id: string): string | null {
  if (rig.mount_id === equipment_id) return 'Mount';
  if (rig.guide_telescope_id === equipment_id) return 'Guide scope';
  if (rig.guide_camera_id === equipment_id) return 'Guide camera';
  const index = rig.chain.indexOf(equipment_id);
  if (index === 0) return 'Main telescope';
  if (index === rig.chain.length - 1 && index > 0) return 'Main camera';
  if (index > 0) return `Chain · position ${index + 1}`;
  if (rig.filters.some((rig_filter) => rig_filter.filter_id === equipment_id)) return 'Filter';
  return null;
}

export type RigStat = { label: string; value: string; detail: string | null };

// Degrees above 1°, arcminutes below: 2.4° but 38′.
function angleLabel(degrees: number): string {
  return degrees >= 1 ? `${degrees.toFixed(1)}°` : `${Math.round(degrees * 60)}′`;
}

// The figures strip above the optical train. Optics need a telescope at the
// front of the chain, image scale and field a camera at the back; payload is
// always shown.
export function rigStats(rig: RigResponse, equipment_by_id: ReadonlyMap<string, EquipmentResponse>): RigStat[] {
  const chain = rig.chain.map((id) => equipment_by_id.get(id)).filter((item) => item !== undefined);
  const stats: RigStat[] = [];
  const scope = chain[0]?.type === EquipmentType.TELESCOPE ? chain[0] : null;
  const last = chain[chain.length - 1];
  const camera = chain.length > 1 && last?.type === EquipmentType.CAMERA ? last : null;

  if (scope) {
    const multipliers = chain.flatMap((item) => (item.type === EquipmentType.CORRECTOR ? [item.specs.focal_multiplier] : []));
    const focal_length = effectiveFocalLength(scope.specs.focal_length_mm, multipliers);
    stats.push({
      label: 'Focal length',
      value: `${Math.round(focal_length)} mm`,
      detail: multipliers.length > 0 ? `native ${scope.specs.focal_length_mm} mm` : null,
    });
    stats.push({ label: 'Focal ratio', value: `f/${(focal_length / scope.specs.aperture_mm).toFixed(1)}`, detail: null });
    if (camera) {
      const { pixel_size_um, resolution_x, resolution_y } = camera.specs;
      const fov = fieldOfView(pixel_size_um, resolution_x, resolution_y, focal_length);
      stats.push({ label: 'Image scale', value: `${imageScale(pixel_size_um, focal_length).toFixed(2)}″/px`, detail: null });
      stats.push({ label: 'Field of view', value: `${angleLabel(fov.width_deg)} × ${angleLabel(fov.height_deg)}`, detail: null });
    }
  }

  // Everything the mount carries: the chain, guiding and the filters.
  const carried = [...rig.chain, rig.guide_telescope_id, rig.guide_camera_id, ...rig.filters.map((item) => item.filter_id)];
  const grams_total = carried.reduce((sum, id) => sum + ((id && equipment_by_id.get(id)?.weight_g) || 0), 0);
  const mount = rig.mount_id ? equipment_by_id.get(rig.mount_id) : undefined;
  const capacity_g = mount?.type === EquipmentType.MOUNT ? mount.specs.payload_capacity_g : null;
  stats.push({
    label: 'Payload',
    value: `${(grams_total / 1000).toFixed(1)} kg`,
    detail: mount && capacity_g ? `of ${Number((capacity_g / 1000).toFixed(1))} kg on ${mount.model}` : null,
  });
  return stats;
}

export function roleInChain(type: EquipmentType, index: number, length: number): string {
  if (index === 0) return 'Main telescope';
  if (index === length - 1 && length > 1) return 'Main camera';
  return TYPE_LABEL[type];
}
