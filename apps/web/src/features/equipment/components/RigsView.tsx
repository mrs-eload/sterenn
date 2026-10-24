import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { EquipmentType, validateRig, type EquipmentResponse, type RigResponse } from '@sterenn/shared';
import IconifyIcon from '@app/components/base/IconifyIcon';
import {
  optionLabel,
  rigStatus,
  roleInChain,
  specRows,
  threadSizeShort,
  toRigPart,
  type ThreadSizeIndex,
} from '../format';
import { border, fontMono, size, text, tone } from '../tokens';
import { CardTitle, Dot } from './primitives';
import { OpticalChainDrawing } from './OpticalChainDrawing';

const STATUS_COLOR = { danger: tone.signal400, warning: tone.amber400, success: tone.green500 };

const section_title = { color: text.primary, fontWeight: 700, fontSize: size.md, mb: 1.75 } as const;
const row = {
  display: 'grid',
  gridTemplateColumns: '120px minmax(0,1fr)',
  gap: 1.5,
  py: 1.125,
  borderTop: `1px solid ${border.subtle}`,
  fontSize: size.base,
} as const;
const row_label = { color: text.secondary, fontSize: size.sm, pt: '2px' } as const;

export function RigsView({
  rigs,
  equipment_by_id,
  sizes,
  selected_id,
  onSelect,
  onNew,
  onEdit,
  onToggleCurrent,
}: {
  rigs: RigResponse[];
  equipment_by_id: ReadonlyMap<string, EquipmentResponse>;
  sizes: ThreadSizeIndex;
  selected_id: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onEdit: (rig: RigResponse) => void;
  onToggleCurrent: (rig: RigResponse, is_current: boolean) => void;
}) {
  const [focused_id, setFocusedId] = useState<string | null>(null);
  // Current rigs come first in the tab strip, and until a rig is picked the
  // view opens on the first of them.
  const ordered = [...rigs.filter((item) => item.is_current), ...rigs.filter((item) => !item.is_current)];
  const rig = ordered.find((item) => item.id === selected_id) ?? ordered[0];

  const parts = new Map([...equipment_by_id].map(([id, equipment]) => [id, toRigPart(equipment)]));
  const chain = rig ? rig.chain.map((id) => equipment_by_id.get(id)).filter((item) => item !== undefined) : [];
  // Problems come from the API; the junction labels from the same shared rules.
  const links = rig ? validateRig(rig, parts).links : [];
  const focused = (focused_id && chain.find((item) => item.id === focused_id)) || chain[0];

  const filter_count_by_holder = new Map<string, number>();
  rig?.filters.forEach((rig_filter) => {
    if (rig_filter.holder_id) {
      filter_count_by_holder.set(rig_filter.holder_id, (filter_count_by_holder.get(rig_filter.holder_id) ?? 0) + 1);
    }
  });

  const status = rig ? rigStatus(rig.problems) : null;

  return (
    <div>
      <Box role="tablist" sx={{ display: 'flex', gap: 3.5, borderBottom: `1px solid ${border.default}`, mb: 3.5, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {ordered.map((item) => {
          const is_on = rig?.id === item.id;
          const item_status = rigStatus(item.problems);
          return (
            <ButtonBase
              key={item.id}
              role="tab"
              aria-selected={is_on}
              onClick={() => {
                onSelect(item.id);
                setFocusedId(null);
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                pb: 1.5,
                whiteSpace: 'nowrap',
                borderBottom: `2px solid ${is_on ? tone.amber500 : 'transparent'}`,
                mb: '-1px',
                color: is_on ? text.primary : text.secondary,
                fontSize: size.base,
                fontWeight: is_on ? 600 : 400,
              }}
            >
              <Box component="span" title={item_status.label} sx={{ display: 'flex' }}>
                <Dot color={STATUS_COLOR[item_status.tone]} size={7} />
              </Box>
              {item.name}
              {item.is_current && <Box component="span" sx={{ color: text.muted, fontSize: size.sm, fontWeight: 400 }}>current</Box>}
            </ButtonBase>
          );
        })}
        <ButtonBase onClick={onNew} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pb: 1.5, color: text.secondary, fontSize: size.base, whiteSpace: 'nowrap' }}>
          <IconifyIcon icon="tabler:plus" sx={{ fontSize: 18 }} />
          New rig
        </ButtonBase>
      </Box>

      {!rig && <Box sx={{ color: text.secondary }}>No rigs yet. Create one to assemble your equipment.</Box>}

      {rig && status && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2.25, flexWrap: 'wrap' }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ color: STATUS_COLOR[status.tone], fontSize: size.sm, fontWeight: 600, mb: 0.75 }}>{status.label}</Box>
              <CardTitle>{rig.name}</CardTitle>
            </Box>
            <FormControlLabel
              control={<Switch checked={rig.is_current} onChange={(event) => onToggleCurrent(rig, event.target.checked)} />}
              label="Current rig"
            />
            <Button variant="outlined" color="inherit" size="small" onClick={() => onEdit(rig)}>Edit rig</Button>
          </Box>

          <Box sx={{ pt: 1 }}>
            <OpticalChainDrawing
              chain={chain}
              links={links}
              filter_count_by_holder={filter_count_by_holder}
              sizes={sizes}
              focused_id={focused?.id ?? null}
              onFocus={setFocusedId}
            />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
              gap: '28px 48px',
              borderTop: `1px solid ${border.default}`,
              pt: 3,
            }}
          >
            <div>
              <Box sx={section_title}>Optical chain</Box>
              {chain.map((equipment, index) => {
                const is_on = focused?.id === equipment.id;
                return (
                  <Box
                    key={`${equipment.id}-${index}`}
                    onClick={() => setFocusedId(equipment.id)}
                    sx={{ display: 'grid', gridTemplateColumns: '32px minmax(0,1fr)', gap: 1.25, py: 1.125, borderTop: `1px solid ${border.subtle}`, cursor: 'pointer' }}
                  >
                    <Box component="span" sx={{ color: is_on ? tone.amber400 : text.muted, fontFamily: fontMono, fontSize: size.sm, fontWeight: 700, pt: '2px' }}>
                      {String(index + 1).padStart(2, '0')}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ color: is_on ? tone.amber400 : text.primary, fontWeight: 600, fontSize: size.base }}>{equipment.model}</Box>
                      <Box sx={{ color: text.secondary, fontSize: size.sm }}>
                        {roleInChain(equipment.type, index, chain.length)} · {equipment.manufacturer}
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </div>

            <div>
              <Box sx={section_title}>{focused ? focused.model : 'Element'}</Box>
              {focused && (
                <>
                  {specRows(focused)
                    .filter(([, value]) => value !== null && value !== '')
                    .map(([label, value]) => (
                      <Box key={label} sx={row}>
                        <Box component="span" sx={row_label}>{label}</Box>
                        <Box component="span" sx={{ color: text.primary }}>{value}</Box>
                      </Box>
                    ))}
                  {focused.threads.map((thread) => (
                    <Box key={thread.id} sx={row}>
                      <Box component="span" sx={row_label}>{optionLabel(thread.position)} thread</Box>
                      <Box component="span" sx={{ color: text.primary }}>
                        <Box component="span" sx={{ fontFamily: fontMono, fontWeight: 700 }}>{threadSizeShort(sizes.get(thread.thread_size_id))}</Box> {thread.gender}
                      </Box>
                    </Box>
                  ))}
                </>
              )}
            </div>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
              <div>
                <Box sx={section_title}>Mount and guiding</Box>
                {(
                  [
                    ['Mount', rig.mount_id, true],
                    ['Guide scope', rig.guide_telescope_id, false],
                    ['Guide camera', rig.guide_camera_id, false],
                  ] as const
                ).map(([label, id, is_required]) => {
                  const part = id ? equipment_by_id.get(id) : undefined;
                  return (
                    <Box key={label} sx={row}>
                      <Box component="span" sx={row_label}>{label}</Box>
                      <Box component="span" sx={{ color: part ? text.primary : is_required ? tone.signal400 : text.muted }}>
                        {part ? part.model : is_required ? 'Missing' : 'None'}
                      </Box>
                    </Box>
                  );
                })}
              </div>

              <div>
                <Box sx={section_title}>Filters</Box>
                {rig.filters.length === 0 && <Box sx={{ color: text.muted, fontSize: size.base }}>None</Box>}
                {rig.filters.map((rig_filter) => {
                  const filter = equipment_by_id.get(rig_filter.filter_id);
                  const holder = rig_filter.holder_id ? equipment_by_id.get(rig_filter.holder_id) : undefined;
                  if (!filter || filter.type !== EquipmentType.FILTER) return null;
                  return (
                    <Box key={rig_filter.filter_id} sx={row}>
                      <Box component="span" sx={{ ...row_label, display: 'flex', alignItems: 'center', gap: 1, pt: 0 }}>
                        <Box component="span" sx={{ width: 4, height: 14, bgcolor: tone.cyan300 }} />
                        {optionLabel(filter.specs.filter_type)}
                      </Box>
                      <span>
                        <Box component="span" sx={{ color: text.primary }}>{filter.model}</Box>
                        <Box component="span" sx={{ color: text.secondary, fontSize: size.sm }}>
                          {holder
                            ? ` · ${holder.type === EquipmentType.FILTER_HOLDER ? 'in' : 'on'} ${holder.model}`
                            : ' · position not specified'}
                        </Box>
                      </span>
                    </Box>
                  );
                })}
              </div>

              <div>
                <Box sx={section_title}>Checks</Box>
                {rig.problems.errors.length + rig.problems.warnings.length === 0 ? (
                  <Box sx={{ color: tone.green500, fontSize: size.base }}>Every connection and filter checks out.</Box>
                ) : (
                  [
                    ...rig.problems.errors.map((message) => ['Error', message] as const),
                    ...rig.problems.warnings.map((message) => ['Warning', message] as const),
                  ].map(([level, message], index) => (
                    <Box key={index} sx={{ display: 'grid', gridTemplateColumns: '72px minmax(0,1fr)', gap: 1.25, py: 1.125, borderTop: `1px solid ${border.subtle}`, fontSize: size.base }}>
                      <Box component="span" sx={{ color: level === 'Error' ? tone.signal400 : tone.amber400, fontSize: size.sm, pt: '2px' }}>{level}</Box>
                      <Box component="span" sx={{ color: text.primary }}>{message}</Box>
                    </Box>
                  ))
                )}
              </div>
            </Box>
          </Box>
        </>
      )}
    </div>
  );
}
