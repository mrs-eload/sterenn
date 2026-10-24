import { useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import {
  EMISSION_LINE_NM,
  EmissionLine,
  EquipmentType,
  FilterType,
  HolderType,
  MountType,
  OpticalDesign,
  SensorColor,
  ThreadGender,
  ThreadPosition,
  equipment_input_schema,
  type EquipmentInput,
  type EquipmentResponse,
  type ThreadSizeInput,
  type ThreadSizeResponse,
} from '@sterenn/shared';
import IconifyIcon from '@app/components/base/IconifyIcon';
import { errorMessages } from '@app/data/sterennApi';
import { optionLabel, sensorSizeLabel, threadSizeLabel, TYPE_LABEL, TYPE_ORDER } from '../format';
import { border, radius, size, surface, text, tone } from '../tokens';
import { Field, FilterChip, SectionLabel, TypeIcon } from './primitives';

// Field definitions per type, in the design's order. Select options come from
// the shared enums, so no list is typed twice.
type Field =
  // scale: how many stored units one typed unit is (full well is typed in ke⁻,
  // stored in e⁻ as the column name says).
  | { key: string; label: string; kind: 'number'; optional?: boolean; scale?: number }
  | { key: string; label: string; kind: 'text'; optional?: boolean }
  | { key: string; label: string; kind: 'select'; options: string[] }
  | { key: string; label: string; kind: 'switch'; optional?: boolean };

const SPEC_FIELDS: Record<EquipmentType, Field[]> = {
  [EquipmentType.MOUNT]: [
    { key: 'mount_type', label: 'Mount type', kind: 'select', options: Object.values(MountType) },
    { key: 'goto', label: 'GoTo', kind: 'switch' },
    { key: 'payload_capacity_g', label: 'Payload capacity (g)', kind: 'number', optional: true },
    { key: 'goto_precision', label: 'GoTo precision', kind: 'text', optional: true },
  ],
  [EquipmentType.TELESCOPE]: [
    { key: 'optical_design', label: 'Optical design', kind: 'select', options: Object.values(OpticalDesign) },
    { key: 'aperture_mm', label: 'Aperture (mm)', kind: 'number' },
    { key: 'focal_length_mm', label: 'Focal length (mm)', kind: 'number' },
    { key: 'tube_length_mm', label: 'Tube length (mm)', kind: 'number', optional: true },
    { key: 'backfocus_min_mm', label: 'Backfocus min (mm)', kind: 'number', optional: true },
    { key: 'backfocus_max_mm', label: 'Backfocus max (mm)', kind: 'number', optional: true },
    { key: 'backfocus_recommended_mm', label: 'Recommended backfocus (mm)', kind: 'number', optional: true },
  ],
  [EquipmentType.CAMERA]: [
    { key: 'sensor_color', label: 'Sensor', kind: 'select', options: Object.values(SensorColor) },
    { key: 'sensor_chip', label: 'Sensor chip', kind: 'text', optional: true },
    { key: 'pixel_size_um', label: 'Pixel size (µm)', kind: 'number' },
    { key: 'resolution_x', label: 'Resolution X (px)', kind: 'number' },
    { key: 'resolution_y', label: 'Resolution Y (px)', kind: 'number' },
    { key: 'cooled', label: 'Cooled', kind: 'switch', optional: true },
    { key: 'read_noise_e', label: 'Read noise (e⁻)', kind: 'number', optional: true },
    { key: 'full_well_e', label: 'Full well (ke⁻)', kind: 'number', optional: true, scale: 1000 },
    { key: 'measured_at_gain', label: 'Measured at gain', kind: 'number', optional: true },
  ],
  [EquipmentType.FILTER_HOLDER]: [
    { key: 'holder_type', label: 'Holder type', kind: 'select', options: Object.values(HolderType) },
    { key: 'positions', label: 'Positions', kind: 'number' },
    { key: 'accepts_disc_diameter_mm', label: 'Accepts disc diameter (mm)', kind: 'number', optional: true },
  ],
  [EquipmentType.FILTER]: [
    { key: 'filter_type', label: 'Filter type', kind: 'select', options: Object.values(FilterType) },
    { key: 'disc_diameter_mm', label: 'Disc diameter (mm)', kind: 'number', optional: true },
  ],
  [EquipmentType.CORRECTOR]: [{ key: 'focal_multiplier', label: 'Focal multiplier', kind: 'number' }],
  [EquipmentType.ADAPTER]: [],
};

type SpecValues = Record<string, string | boolean>;
type ThreadRow = { thread_size_id: string; gender: ThreadGender; position: ThreadPosition };
// line '' is "Other": a band not built around a named emission line.
type PassbandRow = { line: EmissionLine | ''; center_nm: string; bandwidth_nm: string };

const NEW_THREAD_SIZE = '__new__';

function scaleOf(type: EquipmentType, key: string): number {
  const field = SPEC_FIELDS[type].find((item) => item.key === key);
  return field?.kind === 'number' ? (field.scale ?? 1) : 1;
}

function specValuesFrom(equipment: EquipmentResponse | null): SpecValues {
  if (!equipment || equipment.type === EquipmentType.ADAPTER) return {};
  const values: SpecValues = {};
  for (const [key, value] of Object.entries(equipment.specs)) {
    if (typeof value === 'boolean') values[key] = value;
    else if (typeof value === 'number') values[key] = String(value / scaleOf(equipment.type, key));
    else if (value !== null && typeof value !== 'object') values[key] = String(value);
  }
  return values;
}

function defaultsFor(type: EquipmentType): SpecValues {
  const values: SpecValues = {};
  for (const field of SPEC_FIELDS[type]) {
    if (field.kind === 'select') values[field.key] = field.options[0];
    if (field.kind === 'switch' && !field.optional) values[field.key] = false;
  }
  return values;
}

// Strings from the inputs become numbers, empty optional fields become null.
// The zod schema then has the final say.
function buildSpecs(type: EquipmentType, values: SpecValues, passbands: PassbandRow[]): Record<string, unknown> {
  const specs: Record<string, unknown> = {};
  for (const field of SPEC_FIELDS[type]) {
    const raw = values[field.key];
    if (field.kind === 'number') {
      // Rounded after scaling: 40.5 ke⁻ must reach the integer column as 40500, not 40500.000001.
      const scale = field.scale ?? 1;
      specs[field.key] = raw === undefined || raw === '' ? null : scale === 1 ? Number(raw) : Math.round(Number(raw) * scale);
    }
    else if (field.kind === 'text') specs[field.key] = raw === undefined || raw === '' ? null : raw;
    else if (field.kind === 'switch') specs[field.key] = raw === undefined ? null : raw;
    else specs[field.key] = raw;
  }
  // Empty number inputs are kept as '' so zod reports them instead of reading 0.
  if (type === EquipmentType.FILTER) {
    specs.passbands =
      passbands.length === 0
        ? null
        : passbands.map((row) => ({
            line: row.line === '' ? null : row.line,
            center_nm: row.center_nm === '' ? '' : Number(row.center_nm),
            bandwidth_nm: row.bandwidth_nm === '' ? '' : Number(row.bandwidth_nm),
          }));
  }
  return specs;
}

function passbandRowsFrom(equipment: EquipmentResponse | null): PassbandRow[] {
  if (equipment?.type !== EquipmentType.FILTER || !equipment.specs.passbands) return [];
  return equipment.specs.passbands.map((band) => ({
    // Bands saved before lines existed have no `line` key at all.
    line: band.line ?? '',
    center_nm: String(band.center_nm),
    bandwidth_nm: String(band.bandwidth_nm),
  }));
}

function Labelled({ label, optional }: { label: string; optional?: boolean }): ReactNode {
  return (
    <span>
      {label}
      {optional && <Box component="span" sx={{ opacity: 0.7 }}> · optional</Box>}
    </span>
  );
}

export function EquipmentDialog({
  equipment,
  thread_sizes,
  onClose,
  onSave,
  onCreateThreadSize,
}: {
  // null: add a new piece.
  equipment: EquipmentResponse | null;
  thread_sizes: ThreadSizeResponse[];
  onClose: () => void;
  onSave: (input: EquipmentInput, id: string | null) => Promise<void>;
  onCreateThreadSize: (input: ThreadSizeInput) => Promise<ThreadSizeResponse>;
}) {
  const is_edit = equipment !== null;
  const [type, setType] = useState<EquipmentType>(equipment?.type ?? EquipmentType.TELESCOPE);
  const [manufacturer, setManufacturer] = useState(equipment?.manufacturer ?? '');
  const [model, setModel] = useState(equipment?.model ?? '');
  const [weight, setWeight] = useState(equipment?.weight_g === null || !equipment ? '' : String(equipment.weight_g));
  const [notes, setNotes] = useState(equipment?.notes ?? '');
  const [spec_values, setSpecValues] = useState<SpecValues>(() =>
    equipment ? specValuesFrom(equipment) : defaultsFor(EquipmentType.TELESCOPE),
  );
  const [threads, setThreads] = useState<ThreadRow[]>(
    () => equipment?.threads.map(({ thread_size_id, gender, position }) => ({ thread_size_id, gender, position })) ?? [],
  );
  const [passbands, setPassbands] = useState<PassbandRow[]>(() => passbandRowsFrom(equipment));
  const [new_size_row, setNewSizeRow] = useState<number | null>(null);
  const [new_size, setNewSize] = useState({ diameter_mm: '', pitch_mm: '', name: '' });
  const [errors, setErrors] = useState<string[]>([]);
  const [is_saving, setIsSaving] = useState(false);

  const changeType = (next: EquipmentType) => {
    setType(next);
    setSpecValues(defaultsFor(next));
  };
  const setSpec = (key: string, value: string | boolean) => setSpecValues((values) => ({ ...values, [key]: value }));
  const setThread = (index: number, change: Partial<ThreadRow>) =>
    setThreads((rows) => rows.map((row, at) => (at === index ? { ...row, ...change } : row)));
  const setPassband = (index: number, change: Partial<PassbandRow>) =>
    setPassbands((rows) => rows.map((row, at) => (at === index ? { ...row, ...change } : row)));
  // Picking a line fills in its wavelength; it stays editable for off-centre filters.
  const pickLine = (index: number, line: EmissionLine | '') =>
    setPassband(index, line === '' ? { line } : { line, center_nm: String(EMISSION_LINE_NM[line]) });

  const addThreadSize = async () => {
    if (new_size_row === null) return;
    try {
      const created = await onCreateThreadSize({
        diameter_mm: Number(new_size.diameter_mm),
        pitch_mm: Number(new_size.pitch_mm),
        name: new_size.name.trim() || null,
      });
      setThread(new_size_row, { thread_size_id: created.id });
      setNewSizeRow(null);
      setNewSize({ diameter_mm: '', pitch_mm: '', name: '' });
      setErrors([]);
    } catch (error) {
      setErrors(errorMessages(error));
    }
  };

  const save = async () => {
    const candidate = {
      type,
      manufacturer,
      model,
      weight_g: weight === '' ? null : Number(weight),
      notes: notes.trim() === '' ? null : notes,
      threads: threads.map((row) => ({ ...row, notes: null })),
      ...(type === EquipmentType.ADAPTER ? {} : { specs: buildSpecs(type, spec_values, passbands) }),
    };
    const parsed = equipment_input_schema.safeParse(candidate);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message].filter(Boolean).join(': ')));
      return;
    }
    setIsSaving(true);
    try {
      await onSave(parsed.data, equipment?.id ?? null);
    } catch (error) {
      setErrors(errorMessages(error));
      setIsSaving(false);
    }
  };

  const fields = SPEC_FIELDS[type];

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth={false}
      slotProps={{
        paper: {
          sx: { bgcolor: surface.panel, border: `1px solid ${border.default}`, borderRadius: radius.xl, backgroundImage: 'none' },
        },
        backdrop: { sx: { bgcolor: 'rgba(6,12,18,0.6)', backdropFilter: 'blur(4px)' } },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 2.5, borderBottom: `1px solid ${border.subtle}` }}>
        <Box component="span" sx={{ flex: 1, color: text.primary, fontWeight: 700, fontSize: size.md }}>
          {is_edit ? `Edit ${equipment.model}` : 'Add equipment'}
        </Box>
        <IconButton aria-label="Close" onClick={onClose}><IconifyIcon icon="tabler:x" sx={{ fontSize: 18 }} /></IconButton>
      </Box>

      <Box sx={{ p: 3, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2.75 }}>
        <div>
          <SectionLabel>Type</SectionLabel>
          {is_edit ? (
            // The type picks the specs table, so it is fixed once created.
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: text.primary }}>
              <TypeIcon type={type} size={16} /> {TYPE_LABEL[type]}
              <Box component="span" sx={{ color: text.muted, fontSize: size.xs }}>· can't be changed</Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {TYPE_ORDER.map((option) => (
                <FilterChip key={option} active={type === option} onClick={() => changeType(option)} icon={<TypeIcon type={option} size={14} />}>
                  {TYPE_LABEL[option]}
                </FilterChip>
              ))}
            </Box>
          )}
        </div>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 160px' }, gap: 1.75 }}>
          <Field label="Manufacturer" placeholder="Askar" value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} />
          <Field label="Model" placeholder="SQA55" value={model} onChange={(event) => setModel(event.target.value)} />
          <Field label={<Labelled label="Weight (g)" optional />} placeholder="2100" type="number" value={weight} onChange={(event) => setWeight(event.target.value)} />
        </Box>

        {fields.length > 0 && (
          <div>
            <SectionLabel>{TYPE_LABEL[type]} specifications</SectionLabel>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1.75, alignItems: 'end' }}>
              {fields.map((field) => {
                const value = spec_values[field.key];
                if (field.kind === 'select') {
                  return (
                    <Field key={type + field.key} select label={field.label} value={typeof value === 'string' ? value : field.options[0]} onChange={(event) => setSpec(field.key, event.target.value)}>
                      {field.options.map((option) => <MenuItem key={option} value={option}>{optionLabel(option)}</MenuItem>)}
                    </Field>
                  );
                }
                if (field.kind === 'switch') {
                  return (
                    <FormControlLabel
                      key={type + field.key}
                      control={<Switch checked={value === true} onChange={(event) => setSpec(field.key, event.target.checked)} />}
                      label={field.label + (field.optional ? ' (optional)' : '')}
                    />
                  );
                }
                return (
                  <Field
                    key={type + field.key}
                    label={<Labelled label={field.label} optional={field.optional} />}
                    placeholder="—"
                    type={field.kind === 'number' ? 'number' : 'text'}
                    value={typeof value === 'string' ? value : ''}
                    onChange={(event) => setSpec(field.key, event.target.value)}
                  />
                );
              })}
            </Box>
            {type === EquipmentType.CAMERA && (
              <Box sx={{ color: text.muted, fontSize: size.xs, mt: 1.25 }}>
                {Number(spec_values.pixel_size_um) > 0 && Number(spec_values.resolution_x) > 0 && Number(spec_values.resolution_y) > 0
                  ? `Sensor size: ${sensorSizeLabel(Number(spec_values.pixel_size_um), Number(spec_values.resolution_x), Number(spec_values.resolution_y))}, from pixel size × resolution.`
                  : 'Sensor size is derived from pixel size × resolution.'}
              </Box>
            )}
            {type === EquipmentType.FILTER && (
              <>
                <Box sx={{ color: text.muted, fontSize: size.xs, mt: 1.25 }}>
                  Threaded filter: add its thread below. Unmounted filter: fill in the disc diameter instead.
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2.5, mb: 1.25 }}>
                  <SectionLabel sx={{ mb: 0 }}>Passbands</SectionLabel>
                  <Button
                    variant="text"
                    color="inherit"
                    startIcon={<IconifyIcon icon="tabler:plus" />}
                    onClick={() => setPassbands((rows) => [...rows, { line: '', center_nm: '', bandwidth_nm: '' }])}
                  >
                    Add passband
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  {passbands.length === 0 && <Box sx={{ color: text.muted, fontSize: size.xs }}>No passbands.</Box>}
                  {passbands.map((row, index) => (
                    <Box key={index} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 36px', gap: 1.25, alignItems: 'end' }}>
                      <Field select label="Line" value={row.line} onChange={(event) => pickLine(index, event.target.value as EmissionLine | '')}>
                        {Object.values(EmissionLine).map((line) => <MenuItem key={line} value={line}>{optionLabel(line)}</MenuItem>)}
                        <MenuItem value="">Other</MenuItem>
                      </Field>
                      <Field label="Centre (nm)" type="number" placeholder="—" value={row.center_nm} onChange={(event) => setPassband(index, { center_nm: event.target.value })} />
                      <Field label="Bandwidth (nm)" type="number" placeholder="7" value={row.bandwidth_nm} onChange={(event) => setPassband(index, { bandwidth_nm: event.target.value })} />
                      <IconButton aria-label="Remove passband" onClick={() => setPassbands((rows) => rows.filter((_, at) => at !== index))} sx={{ mb: '6px' }}>
                        <IconifyIcon icon="tabler:x" sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </div>
        )}

        <div>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
            <SectionLabel sx={{ mb: 0 }}>Threads</SectionLabel>
            <Button
              variant="text"
              color="inherit"
              startIcon={<IconifyIcon icon="tabler:plus" />}
              onClick={() =>
                setThreads((rows) => [
                  ...rows,
                  { thread_size_id: thread_sizes[0]?.id ?? '', gender: ThreadGender.FEMALE, position: ThreadPosition.FRONT },
                ])
              }
            >
              Add thread
            </Button>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {threads.length === 0 && <Box sx={{ color: text.muted, fontSize: size.xs }}>No threads.</Box>}
            {threads.map((row, index) => (
              <Box key={index}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) 36px', gap: 1.25, alignItems: 'center' }}>
                  <Field
                    select
                    value={new_size_row === index ? NEW_THREAD_SIZE : row.thread_size_id}
                    onChange={(event) => {
                      if (event.target.value === NEW_THREAD_SIZE) setNewSizeRow(index);
                      else {
                        setNewSizeRow(null);
                        setThread(index, { thread_size_id: event.target.value });
                      }
                    }}
                  >
                    {thread_sizes.map((option) => <MenuItem key={option.id} value={option.id}>{threadSizeLabel(option)}</MenuItem>)}
                    <MenuItem value={NEW_THREAD_SIZE}>New thread size…</MenuItem>
                  </Field>
                  <Field select value={row.gender} onChange={(event) => setThread(index, { gender: event.target.value as ThreadGender })}>
                    {Object.values(ThreadGender).map((option) => <MenuItem key={option} value={option}>{optionLabel(option)}</MenuItem>)}
                  </Field>
                  <Field select value={row.position} onChange={(event) => setThread(index, { position: event.target.value as ThreadPosition })}>
                    {Object.values(ThreadPosition).map((option) => <MenuItem key={option} value={option}>{optionLabel(option)}</MenuItem>)}
                  </Field>
                  <IconButton aria-label="Remove thread" onClick={() => setThreads((rows) => rows.filter((_, at) => at !== index))}>
                    <IconifyIcon icon="tabler:x" sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>
                {new_size_row === index && (
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 1.25, alignItems: 'end', mt: 1.25, p: 1.5, borderRadius: radius.md, bgcolor: surface.inset, border: `1px solid ${border.subtle}` }}>
                    <Field label="Diameter (mm)" type="number" value={new_size.diameter_mm} onChange={(event) => setNewSize((size_input) => ({ ...size_input, diameter_mm: event.target.value }))} />
                    <Field label="Pitch (mm)" type="number" value={new_size.pitch_mm} onChange={(event) => setNewSize((size_input) => ({ ...size_input, pitch_mm: event.target.value }))} />
                    <Field label={<Labelled label="Name" optional />} placeholder="T2" value={new_size.name} onChange={(event) => setNewSize((size_input) => ({ ...size_input, name: event.target.value }))} />
                    {/* Same padding, font size and line height as Field's input, so it lines up at the same height. */}
                    <Button
                      variant="outlined"
                      color="inherit"
                      onClick={addThreadSize}
                      sx={{ px: 2.25, py: '10px', fontSize: size.base, lineHeight: 1.5, borderRadius: radius.md, whiteSpace: 'nowrap' }}
                    >
                      Add size
                    </Button>
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </div>

        <Field label={<Labelled label="Notes" optional />} placeholder="Anything worth remembering" value={notes} onChange={(event) => setNotes(event.target.value)} multiline minRows={1} />

        {errors.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {errors.map((message, index) => (
              <Box key={index} sx={{ color: tone.signal400, fontSize: size.sm }}>{message}</Box>
            ))}
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.25, px: 3, py: 2, borderTop: `1px solid ${border.subtle}` }}>
        <Button variant="text" color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={is_saving}>Save equipment</Button>
      </Box>
    </Dialog>
  );
}
