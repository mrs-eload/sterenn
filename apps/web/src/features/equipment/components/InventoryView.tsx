import { Fragment, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { EquipmentType, type EquipmentResponse, type RigResponse } from '@sterenn/shared';
import {
  grams,
  optionLabel,
  roleInRig,
  specRows,
  threadAt,
  threadSizeLabel,
  threadSizeShort,
  TYPE_LABEL,
  TYPE_ORDER,
  TYPE_PLURAL,
  type ThreadSizeIndex,
} from '../format';
import { border, fontMono, radius, size, surface, text, tone, trackingWide } from '../tokens';
import { Badge, EmptyText, FilterChip, Panel, Rule, SectionLabel, TypeBadge, TypeIcon } from './primitives';

type Column = [label: string, render: (equipment: EquipmentResponse) => ReactNode];

const muted = (content: ReactNode) => <Box component="span" sx={{ color: text.muted }}>{content}</Box>;
const unit = (value: number | null, suffix: string) => (value === null ? null : `${value} ${suffix}`);

function ThreadCell({ equipment, position, sizes }: { equipment: EquipmentResponse; position: string; sizes: ThreadSizeIndex }) {
  const thread = threadAt(equipment, position);
  if (!thread) {
    if (position === 'front' && equipment.type === EquipmentType.FILTER && equipment.specs.disc_diameter_mm) {
      return <Box component="span" sx={{ color: text.secondary }}>{equipment.specs.disc_diameter_mm} mm disc</Box>;
    }
    return muted('—');
  }
  const thread_size = sizes.get(thread.thread_size_id);
  return (
    <Box component="span" title={`${threadSizeLabel(thread_size)} ${thread.gender}`} sx={{ whiteSpace: 'nowrap' }}>
      <Box component="span" sx={{ color: text.primary, fontFamily: fontMono, fontWeight: 700 }}>{threadSizeShort(thread_size)}</Box>
      <Box component="span" sx={{ color: text.secondary }}> {thread.gender}</Box>
    </Box>
  );
}

// The design's per-type spec columns. Every table shares one 5-slot grid so
// columns line up across categories.
function columnsFor(type: EquipmentType, sizes: ThreadSizeIndex): Column[] {
  const thread = (label: string, position: string): Column => [
    label,
    (equipment) => <ThreadCell equipment={equipment} position={position} sizes={sizes} />,
  ];
  switch (type) {
    case EquipmentType.MOUNT:
      return [
        ['Type', (e) => e.type === EquipmentType.MOUNT && optionLabel(e.specs.mount_type)],
        ['GoTo', (e) => e.type === EquipmentType.MOUNT && (e.specs.goto ? 'Yes' : 'No')],
        ['Payload', (e) => e.type === EquipmentType.MOUNT && grams(e.specs.payload_capacity_g)],
      ];
    case EquipmentType.TELESCOPE:
      return [
        ['Design', (e) => e.type === EquipmentType.TELESCOPE && optionLabel(e.specs.optical_design)],
        ['Aperture', (e) => e.type === EquipmentType.TELESCOPE && unit(e.specs.aperture_mm, 'mm')],
        ['Focal length', (e) => e.type === EquipmentType.TELESCOPE && unit(e.specs.focal_length_mm, 'mm')],
        thread('Rear thread', 'rear'),
      ];
    case EquipmentType.CAMERA:
      return [
        ['Sensor', (e) => e.type === EquipmentType.CAMERA && optionLabel(e.specs.sensor_color)],
        ['Pixel', (e) => e.type === EquipmentType.CAMERA && unit(e.specs.pixel_size_um, 'µm')],
        ['Resolution', (e) => e.type === EquipmentType.CAMERA && `${e.specs.resolution_x}×${e.specs.resolution_y}`],
        thread('Front thread', 'front'),
      ];
    case EquipmentType.FILTER_HOLDER:
      return [
        ['Type', (e) => e.type === EquipmentType.FILTER_HOLDER && optionLabel(e.specs.holder_type)],
        ['Slots', (e) => e.type === EquipmentType.FILTER_HOLDER && e.specs.positions],
        thread('Front', 'front'),
        thread('Rear', 'rear'),
        thread('Inside', 'inside'),
      ];
    case EquipmentType.FILTER:
      return [
        ['Type', (e) => e.type === EquipmentType.FILTER && optionLabel(e.specs.filter_type)],
        [
          'Passbands (nm)',
          (e) =>
            e.type === EquipmentType.FILTER &&
            e.specs.passbands && (
              <Box component="span" sx={{ display: 'flex', flexDirection: 'column', whiteSpace: 'nowrap' }}>
                {e.specs.passbands.map((band) => (
                  <span key={band.center_nm}>{band.center_nm} / {band.bandwidth_nm}</span>
                ))}
              </Box>
            ),
        ],
        thread('Mounting', 'front'),
      ];
    case EquipmentType.ADAPTER:
      return [thread('Front', 'front'), thread('Rear', 'rear')];
    case EquipmentType.CORRECTOR:
      return [
        ['Multiplier', (e) => e.type === EquipmentType.CORRECTOR && `×${e.specs.focal_multiplier}`],
        thread('Front', 'front'),
        thread('Rear', 'rear'),
      ];
  }
}

const SLOTS = 5;
const GRID = `minmax(150px,2fr) repeat(${SLOTS}, minmax(94px,1fr)) 72px`;
const MIN_WIDTH = 150 + SLOTS * 94 + 72 + 12 * (SLOTS + 1) + 36;
const cell = {
  fontSize: size.base,
  color: text.primary,
  fontVariantNumeric: 'tabular-nums',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

function CategoryTable({
  type,
  items,
  selected_id,
  onSelect,
  sizes,
}: {
  type: EquipmentType;
  items: EquipmentResponse[];
  selected_id: string | null;
  onSelect: (id: string) => void;
  sizes: ThreadSizeIndex;
}) {
  const columns = columnsFor(type, sizes);
  const headers = ['Model', ...columns.map(([label]) => label), ...Array<string>(SLOTS - columns.length).fill(''), 'Weight'];
  return (
    <section>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, mb: 1.5 }}>
        <Box
          component="span"
          sx={{ width: 40, height: 40, borderRadius: radius.md, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: surface.warningBg, color: tone.amber400 }}
        >
          <TypeIcon type={type} size={22} />
        </Box>
        <Box component="span" sx={{ color: text.primary, fontWeight: 900, fontSize: size.lg, lineHeight: 1 }}>{TYPE_PLURAL[type]}</Box>
        <Box component="span" sx={{ color: text.muted, fontSize: size.sm, fontVariantNumeric: 'tabular-nums' }}>{items.length}</Box>
      </Box>
      <Box sx={{ border: `1px solid ${border.default}`, overflowX: 'auto', scrollbarWidth: 'thin', bgcolor: surface.panel }}>
        <Box role="table" sx={{ minWidth: MIN_WIDTH }}>
          <Box
            role="row"
            sx={{ display: 'grid', gridTemplateColumns: GRID, gap: 1.5, px: 2.25, py: 1.125, bgcolor: surface.cardAlt, borderBottom: `1px solid ${border.default}` }}
          >
            {headers.map((header, index) => (
              <Box
                key={header || `spacer-${index}`}
                component="span"
                role="columnheader"
                sx={{
                  ...cell,
                  color: text.secondary,
                  fontSize: size.xs,
                  fontWeight: 700,
                  letterSpacing: trackingWide,
                  textTransform: 'uppercase',
                  textAlign: index === headers.length - 1 ? 'right' : 'left',
                }}
              >
                {header}
              </Box>
            ))}
          </Box>
          {items.map((equipment, index) => {
            const is_selected = equipment.id === selected_id;
            return (
              <Box
                key={equipment.id}
                role="row"
                aria-selected={is_selected}
                onClick={() => onSelect(equipment.id)}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: GRID,
                  gap: 1.5,
                  alignItems: 'center',
                  px: 2.25,
                  minHeight: 52,
                  cursor: 'pointer',
                  borderTop: index === 0 ? 'none' : `1px solid ${border.subtle}`,
                  bgcolor: is_selected ? surface.selected : 'transparent',
                  boxShadow: is_selected ? `inset 3px 0 0 ${tone.amber500}` : 'none',
                  transition: 'background-color 120ms',
                  '&:hover': { bgcolor: is_selected ? surface.selected : surface.cardAlt },
                }}
              >
                <Box sx={{ minWidth: 0, py: 1.125 }}>
                  <Box title={equipment.model} sx={{ ...cell, fontWeight: 600 }}>{equipment.model}</Box>
                  <Box sx={{ ...cell, fontSize: size.sm, color: text.secondary, mt: '1px' }}>{equipment.manufacturer}</Box>
                </Box>
                {columns.map(([label, render]) => {
                  const value = render(equipment);
                  return <Box key={label} sx={cell}>{value === null || value === false || value === undefined ? muted('—') : value}</Box>;
                })}
                {Array.from({ length: SLOTS - columns.length }, (_, pad) => <span key={`pad-${pad}`} />)}
                <Box sx={{ ...cell, textAlign: 'right', color: text.secondary }}>{grams(equipment.weight_g) ?? '—'}</Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </section>
  );
}

const value_text = { color: text.primary, fontSize: size.sm, fontWeight: 700, fontFamily: fontMono, textAlign: 'right' } as const;

function DetailPanel({
  equipment,
  rigs,
  sizes,
  onEdit,
  onDelete,
}: {
  equipment: EquipmentResponse | undefined;
  rigs: RigResponse[];
  sizes: ThreadSizeIndex;
  onEdit: (equipment: EquipmentResponse) => void;
  onDelete: (equipment: EquipmentResponse, used_in: RigResponse[]) => void;
}) {
  if (!equipment) {
    return (
      <Panel>
        <EmptyText>Select a piece of equipment.</EmptyText>
      </Panel>
    );
  }
  const rows = specRows(equipment).filter(([, value]) => value !== null && value !== '');
  const used_in = rigs.filter((rig) => roleInRig(rig, equipment.id) !== null);
  return (
    <Panel sx={{ position: 'sticky', top: 24 }}>
      <Box sx={{ display: 'flex', gap: 1.75, alignItems: 'center' }}>
        <TypeBadge type={equipment.type} active size={48} />
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ mb: 0.75 }}><Badge tone="neutral">{TYPE_LABEL[equipment.type]}</Badge></Box>
          <Box sx={{ color: text.primary, fontWeight: 900, fontSize: size.xl, lineHeight: 1.1 }}>{equipment.model}</Box>
          <Box sx={{ color: text.muted, fontSize: size.sm }}>{equipment.manufacturer}</Box>
        </Box>
      </Box>

      <Box sx={{ borderTop: `1px solid ${border.subtle}`, mt: 2.5, mb: 2 }} />
      <SectionLabel>Specifications</SectionLabel>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 1.25 }}>
        {[...rows, ['Weight', grams(equipment.weight_g) ?? '—'] as [string, string]].map(([label, value]) => (
          <Fragment key={label}>
            <Box component="span" sx={{ color: text.muted, fontSize: size.xs }}>{label}</Box>
            <Box component="span" sx={value_text}>{value}</Box>
          </Fragment>
        ))}
      </Box>

      <Rule my={2} />
      <SectionLabel>Threads</SectionLabel>
      {equipment.threads.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {equipment.threads.map((thread) => (
            <Box key={thread.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box component="span" sx={{ width: 54, color: text.muted, fontSize: size.xs, textTransform: 'capitalize' }}>{thread.position}</Box>
              <Box
                component="span"
                sx={{ display: 'inline-flex', alignItems: 'center', columnGap: 0.75, px: 1.125, py: 0.375, borderRadius: radius.lg, bgcolor: surface.inset, border: `1px solid ${border.subtle}`, fontSize: size.xs }}
              >
                <Box component="span" sx={{ color: text.primary, fontFamily: fontMono, fontWeight: 700 }}>{threadSizeLabel(sizes.get(thread.thread_size_id))}</Box>
                <Box component="span" sx={{ color: text.muted }}>{thread.gender}</Box>
              </Box>
            </Box>
          ))}
        </Box>
      ) : (
        <Box sx={{ color: text.muted, fontSize: size.xs }}>
          {equipment.type === EquipmentType.FILTER && equipment.specs.disc_diameter_mm
            ? 'Unmounted filter: matched by disc diameter.'
            : 'No threads recorded.'}
        </Box>
      )}

      {equipment.notes && (
        <>
          <Rule my={2} />
          <SectionLabel>Notes</SectionLabel>
          <Box sx={{ color: text.secondary, fontSize: size.sm }}>{equipment.notes}</Box>
        </>
      )}

      <Rule my={2} />
      <SectionLabel>Used in rigs</SectionLabel>
      {used_in.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {used_in.map((rig) => (
            <Box key={rig.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.25, fontSize: size.sm }}>
              <Box component="span" sx={{ color: text.primary, fontWeight: 700 }}>{rig.name}</Box>
              <Box component="span" sx={{ color: text.muted, fontSize: size.xs }}>{roleInRig(rig, equipment.id)}</Box>
            </Box>
          ))}
        </Box>
      ) : (
        <Box sx={{ color: text.muted, fontSize: size.xs }}>Not used in any rig.</Box>
      )}

      <Box sx={{ display: 'flex', gap: 1.25, mt: 2.75 }}>
        <Button variant="outlined" color="inherit" sx={{ flex: 1 }} onClick={() => onEdit(equipment)}>
          Edit
        </Button>
        <Button variant="text" sx={{ color: tone.signal400 }} onClick={() => onDelete(equipment, used_in)}>
          Delete
        </Button>
      </Box>
    </Panel>
  );
}

export function InventoryView({
  equipment,
  rigs,
  sizes,
  selected_id,
  onSelect,
  onEdit,
  onDelete,
}: {
  equipment: EquipmentResponse[];
  rigs: RigResponse[];
  sizes: ThreadSizeIndex;
  selected_id: string | null;
  onSelect: (id: string) => void;
  onEdit: (equipment: EquipmentResponse) => void;
  onDelete: (equipment: EquipmentResponse, used_in: RigResponse[]) => void;
}) {
  const [type_filter, setTypeFilter] = useState<EquipmentType | 'all'>('all');
  const visible = equipment.filter((item) => type_filter === 'all' || item.type === type_filter);
  const groups = TYPE_ORDER.map((type) => [type, visible.filter((item) => item.type === type)] as const).filter(
    ([, items]) => items.length > 0,
  );
  const selected = equipment.find((item) => item.id === selected_id);

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'flex-start' }}>
      <Panel sx={{ flex: '1 1 820px', minWidth: 0 }}>
        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', scrollbarWidth: 'none', pr: 5, mb: 2.25 }}>
          <FilterChip active={type_filter === 'all'} onClick={() => setTypeFilter('all')}>All · {equipment.length}</FilterChip>
          {TYPE_ORDER.map((type) => {
            const count = equipment.filter((item) => item.type === type).length;
            return count > 0 ? (
              <FilterChip key={type} active={type_filter === type} onClick={() => setTypeFilter(type)} icon={<TypeIcon type={type} size={14} />}>
                {TYPE_PLURAL[type]} · {count}
              </FilterChip>
            ) : null;
          })}
        </Box>

        {groups.length === 0 && (
          <Box sx={{ color: text.muted, fontSize: size.sm, py: 3.5 }}>
            {equipment.length === 0 ? 'No equipment yet. Add your first piece.' : 'Nothing in this category.'}
          </Box>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4.5, mt: 1 }}>
          {groups.map(([type, items]) => (
            <CategoryTable key={type} type={type} items={items} selected_id={selected_id} onSelect={onSelect} sizes={sizes} />
          ))}
        </Box>
      </Panel>
      <Box sx={{ flex: '0 1 360px', minWidth: 300, alignSelf: 'stretch' }}>
        <DetailPanel equipment={selected} rigs={rigs} sizes={sizes} onEdit={onEdit} onDelete={onDelete} />
      </Box>
    </Box>
  );
}
