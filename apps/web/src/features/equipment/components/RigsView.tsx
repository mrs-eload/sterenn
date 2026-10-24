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
  rigStats,
  rigStatus,
  specRows,
  threadSizeShort,
  toRigPart,
  TYPE_LABEL,
  type ThreadSizeIndex,
} from '../format';
import { border, fontMono, radius, size, surface, text, tone } from '../tokens';
import { CardTitle, Dot } from './primitives';
import { OpticalTrain } from './OpticalTrain';

const STATUS_COLOR = { danger: tone.signal400, warning: tone.amber400, success: tone.green500 };

const panel = { bgcolor: surface.panel, border: `1px solid ${border.default}`, borderRadius: radius.lg } as const;
const section_title = { color: text.primary, fontWeight: 700, fontSize: size.md } as const;
const row = {
  display: 'grid',
  gridTemplateColumns: '140px minmax(0,1fr)',
  gap: 1.5,
  py: 1.25,
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

  const filters_by_holder = new Map<string, EquipmentResponse[]>();
  rig?.filters.forEach((rig_filter) => {
    const filter = equipment_by_id.get(rig_filter.filter_id);
    if (rig_filter.holder_id && filter) {
      filters_by_holder.set(rig_filter.holder_id, [...(filters_by_holder.get(rig_filter.holder_id) ?? []), filter]);
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
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2.25, flexWrap: 'wrap', mb: 3 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ color: STATUS_COLOR[status.tone], fontSize: size.sm, fontWeight: 600, mb: 0.75 }}>{status.label}</Box>
              <CardTitle>{rig.name}</CardTitle>
            </Box>
            <FormControlLabel
              control={<Switch checked={rig.is_current} onChange={(event) => onToggleCurrent(rig, event.target.checked)} />}
              label="Current rig"
            />
            <Button variant="outlined" color="inherit" onClick={() => onEdit(rig)}>Edit rig</Button>
          </Box>

          <Box sx={{ ...panel, overflow: 'hidden' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', borderBottom: `1px solid ${border.default}` }}>
              {rigStats(rig, equipment_by_id).map((stat, index) => (
                <Box
                  key={stat.label}
                  sx={{ px: 2.75, py: 2.5, borderLeft: index ? `1px solid ${border.subtle}` : 'none', display: 'flex', flexDirection: 'column', gap: 0.5 }}
                >
                  <Box component="span" sx={{ color: text.secondary, fontSize: size.sm }}>{stat.label}</Box>
                  <Box component="span" sx={{ color: text.primary, fontSize: size.xxl, fontWeight: 900, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
                    {stat.value}
                  </Box>
                  {stat.detail && <Box component="span" sx={{ color: text.muted, fontSize: size.sm }}>{stat.detail}</Box>}
                </Box>
              ))}
            </Box>
            <Box sx={{ px: 2.75, pt: 2.75, pb: 3.25 }}>
              <Box sx={{ ...section_title, mb: 0.75 }}>Optical train</Box>
              <OpticalTrain
                chain={chain}
                links={links}
                filters_by_holder={filters_by_holder}
                sizes={sizes}
                focused_id={focused?.id ?? null}
                onFocus={setFocusedId}
              />
            </Box>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
              gap: 2.5,
              mt: 2.5,
              alignItems: 'start',
            }}
          >
            <Box sx={{ ...panel, px: 2.75, pt: 2.5, pb: 1.5 }}>
              {focused && (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 1.25, mb: 1.75 }}>
                    <Box component="span" sx={section_title}>{focused.model}</Box>
                    <Box component="span" sx={{ color: text.secondary, fontSize: size.sm }}>
                      {TYPE_LABEL[focused.type]} · {focused.manufacturer}
                    </Box>
                  </Box>
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
            </Box>

            <Box sx={{ ...panel, px: 2.75, pt: 2.5, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 3.25 }}>
              <div>
                <Box sx={{ ...section_title, mb: 1.75 }}>Mount and guiding</Box>
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
                <Box sx={{ ...section_title, mb: 1.75 }}>Filters</Box>
                {rig.filters.length === 0 && <Box sx={{ color: text.muted, fontSize: size.base, pb: 1 }}>None</Box>}
                {rig.filters.map((rig_filter) => {
                  const filter = equipment_by_id.get(rig_filter.filter_id);
                  const holder = rig_filter.holder_id ? equipment_by_id.get(rig_filter.holder_id) : undefined;
                  if (!filter || filter.type !== EquipmentType.FILTER) return null;
                  return (
                    <Box key={rig_filter.filter_id} sx={row}>
                      <Box component="span" sx={{ ...row_label, display: 'flex', alignItems: 'center', gap: 1, pt: 0 }}>
                        <Box component="span" sx={{ width: 3, height: 12, bgcolor: tone.cyan300 }} />
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
                <Box sx={{ ...section_title, mb: 1.75 }}>Checks</Box>
                {rig.problems.errors.length + rig.problems.warnings.length === 0 ? (
                  <Box sx={{ color: tone.green500, fontSize: size.base, pb: 1 }}>Every connection and filter checks out.</Box>
                ) : (
                  [
                    ...rig.problems.errors.map((message) => ['Error', message] as const),
                    ...rig.problems.warnings.map((message) => ['Warning', message] as const),
                  ].map(([level, message], index) => (
                    <Box key={index} sx={{ ...row, gridTemplateColumns: '72px minmax(0,1fr)' }}>
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
