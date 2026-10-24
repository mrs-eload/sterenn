import { Fragment, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import {
  EquipmentType,
  filterFitsHolder,
  validateRig,
  type EquipmentResponse,
  type RigInput,
  type RigResponse,
} from '@sterenn/shared';
import IconifyIcon from '@app/components/base/IconifyIcon';
import { errorMessages } from '@app/data/sterennApi';
import { CHAIN_TYPES, roleInChain, threadSizeLabel, toRigPart, type ThreadSizeIndex } from '../format';
import { border, fontMono, size, text, tone } from '../tokens';
import { Badge, Field, PageTitle } from './primitives';

type Draft = RigInput;

function draftFrom(rig: RigResponse | undefined): Draft {
  if (!rig) {
    return { name: '', is_current: false, mount_id: '', guide_telescope_id: null, guide_camera_id: null, chain: [], filters: [] };
  }
  return {
    name: rig.name,
    is_current: rig.is_current,
    mount_id: rig.mount_id ?? '',
    guide_telescope_id: rig.guide_telescope_id,
    guide_camera_id: rig.guide_camera_id,
    chain: [...rig.chain],
    filters: rig.filters.map((rig_filter) => ({ ...rig_filter })),
  };
}

function EditorSection({ number, title, hint, action, children }: { number: string; title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Box
      component="section"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(180px, 240px) minmax(0, 1fr)' },
        gap: { xs: 2, md: 4 },
        py: 3.5,
        borderTop: `1px solid ${border.default}`,
      }}
    >
      <div>
        <Box sx={{ color: text.muted, fontFamily: fontMono, fontSize: size.sm }}>{number}</Box>
        <Box sx={{ color: text.primary, fontWeight: 700, fontSize: size.md, mt: 0.5 }}>{title}</Box>
        {hint && <Box sx={{ color: text.secondary, fontSize: size.sm, mt: 0.75, lineHeight: 1.5 }}>{hint}</Box>}
        {action && <Box sx={{ mt: 1.75 }}>{action}</Box>}
      </div>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

const optionText = (equipment: EquipmentResponse) => `${equipment.model} · ${equipment.manufacturer}`;

export function RigEditor({
  rig,
  equipment,
  equipment_by_id,
  sizes,
  onCancel,
  onSave,
  onDelete,
}: {
  rig: RigResponse | undefined;
  equipment: EquipmentResponse[];
  equipment_by_id: ReadonlyMap<string, EquipmentResponse>;
  sizes: ThreadSizeIndex;
  onCancel: () => void;
  onSave: (input: RigInput) => Promise<void>;
  onDelete: (rig: RigResponse) => void;
}) {
  const is_new = rig === undefined;
  const [draft, setDraft] = useState<Draft>(() => draftFrom(rig));
  const [server_errors, setServerErrors] = useState<string[]>([]);
  const [is_saving, setIsSaving] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  // The same rules the API applies, run live (ADR 0004 section 10).
  const parts = new Map(equipment.map((item) => [item.id, toRigPart(item)]));
  const check = validateRig({ ...draft, mount_id: draft.mount_id || null }, parts);
  const is_name_missing = draft.name.trim() === '';
  const error_count = check.errors.length + (is_name_missing ? 1 : 0);
  const can_save = error_count === 0 && !is_saving;

  const ofTypes = (types: EquipmentType[]) => equipment.filter((item) => types.includes(item.type));

  const setChain = (update: (chain: string[]) => string[]) => setDraft((current) => ({ ...current, chain: update(current.chain) }));
  const move = (index: number, direction: -1 | 1) =>
    setChain((chain) => {
      const next = [...chain];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
  // Telescope first; afterwards insert before a trailing camera, or add one.
  const addElement = () =>
    setChain((chain) => {
      const chain_items = ofTypes(CHAIN_TYPES);
      if (chain.length === 0) {
        const telescope = chain_items.find((item) => item.type === EquipmentType.TELESCOPE) ?? chain_items[0];
        return telescope ? [telescope.id] : chain;
      }
      const last = equipment_by_id.get(chain[chain.length - 1]);
      if (last?.type === EquipmentType.CAMERA) {
        const middle = chain_items.find((item) => item.type !== EquipmentType.TELESCOPE && item.type !== EquipmentType.CAMERA);
        return middle ? [...chain.slice(0, -1), middle.id, chain[chain.length - 1]] : chain;
      }
      const camera = chain_items.find((item) => item.type === EquipmentType.CAMERA) ?? chain_items[0];
      return camera ? [...chain, camera.id] : chain;
    });

  const used_filter_ids = draft.filters.map((rig_filter) => rig_filter.filter_id);
  const free_filters = ofTypes([EquipmentType.FILTER]).filter((item) => !used_filter_ids.includes(item.id));
  const addFilter = () => {
    if (free_filters[0]) {
      set('filters', [...draft.filters, { filter_id: free_filters[0].id, holder_id: null }]);
    }
  };
  const setFilter = (index: number, change: Partial<Draft['filters'][number]>) =>
    set('filters', draft.filters.map((rig_filter, at) => (at === index ? { ...rig_filter, ...change } : rig_filter)));

  const holder_count = new Map<string, number>();
  draft.filters.forEach((rig_filter) => {
    if (rig_filter.holder_id) holder_count.set(rig_filter.holder_id, (holder_count.get(rig_filter.holder_id) ?? 0) + 1);
  });
  const chain_parts = [...new Set(draft.chain)].map((id) => equipment_by_id.get(id)).filter((item) => item !== undefined);

  const save = async () => {
    if (!can_save) return;
    setIsSaving(true);
    setServerErrors([]);
    try {
      await onSave({ ...draft, name: draft.name.trim() });
    } catch (error) {
      setServerErrors(errorMessages(error));
      setIsSaving(false);
    }
  };

  const status =
    check.errors.length > 0 ? (
      <Badge tone="danger">Incomplete</Badge>
    ) : check.warnings.length > 0 ? (
      <Badge tone="warning">{check.warnings.length} warning{check.warnings.length > 1 ? 's' : ''}</Badge>
    ) : (
      <Badge tone="success">Ready</Badge>
    );

  // Junction labels need existing items only, in chain order.
  let link_index = -1;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: text.secondary, fontSize: size.sm, mb: 1.25 }}>
        <Box component="a" href="#" onClick={(event) => { event.preventDefault(); onCancel(); }} sx={{ color: text.secondary, textDecoration: 'none' }}>
          Rigs
        </Box>
        <Box component="span" sx={{ color: text.muted }}>/</Box>
        <Box component="span" sx={{ color: text.primary }}>{is_new ? 'New rig' : `Edit ${rig.name}`}</Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, pb: 3 }}>
        <Box sx={{ flex: 1 }}><PageTitle>{is_new ? 'New rig' : 'Edit rig'}</PageTitle></Box>
        {status}
      </Box>

      <EditorSection number="01" title="Identity">
        <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field
            label="Name"
            placeholder="SQA55 widefield"
            value={draft.name}
            onChange={(event) => set('name', event.target.value)}
            sx={{ flex: '1 1 320px' }}
          />
          <FormControlLabel control={<Switch checked={draft.is_current} onChange={(event) => set('is_current', event.target.checked)} />} label="Current rig" />
        </Box>
        <Box sx={{ color: text.muted, fontSize: size.sm, mt: 1.25 }}>Several rigs can be current at once.</Box>
      </EditorSection>

      <EditorSection number="02" title="Mount and guiding" hint="A rig needs a mount. Guide scope and guide camera are optional.">
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2 }}>
          <Field select label="Mount" value={draft.mount_id} onChange={(event) => set('mount_id', event.target.value)}>
            <MenuItem value="">Choose a mount</MenuItem>
            {ofTypes([EquipmentType.MOUNT]).map((item) => <MenuItem key={item.id} value={item.id}>{optionText(item)}</MenuItem>)}
          </Field>
          <Field select label="Guide scope" value={draft.guide_telescope_id ?? ''} onChange={(event) => set('guide_telescope_id', event.target.value || null)}>
            <MenuItem value="">None</MenuItem>
            {ofTypes([EquipmentType.TELESCOPE]).map((item) => <MenuItem key={item.id} value={item.id}>{optionText(item)}</MenuItem>)}
          </Field>
          <Field select label="Guide camera" value={draft.guide_camera_id ?? ''} onChange={(event) => set('guide_camera_id', event.target.value || null)}>
            <MenuItem value="">None</MenuItem>
            {ofTypes([EquipmentType.CAMERA]).map((item) => <MenuItem key={item.id} value={item.id}>{optionText(item)}</MenuItem>)}
          </Field>
        </Box>
      </EditorSection>

      <EditorSection
        number="03"
        title="Optical chain"
        hint="Front to back. Starts with the main telescope, ends with the main camera. Thread mismatches are warnings and don't block saving."
        action={
          <Button variant="outlined" color="inherit" size="small" startIcon={<IconifyIcon icon="tabler:plus" />} onClick={addElement} disabled={ofTypes(CHAIN_TYPES).length === 0}>
            Add element
          </Button>
        }
      >
        {draft.chain.length === 0 && <Box sx={{ color: text.secondary, fontSize: size.base, py: 1.75 }}>No elements yet. Add the main telescope first.</Box>}
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {draft.chain.map((id, index) => {
            const item = equipment_by_id.get(id);
            const is_last = index === draft.chain.length - 1;
            // A junction follows this item when it and the next item both exist.
            const next = equipment_by_id.get(draft.chain[index + 1]);
            if (item) link_index += item && next ? 1 : 0;
            const shared_size = item && next ? check.links[link_index] : undefined;
            return (
              <Fragment key={index}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '36px minmax(0,1fr) auto', gap: 1.5, alignItems: 'center' }}>
                  <Box component="span" sx={{ color: text.muted, fontFamily: fontMono, fontSize: size.sm, textAlign: 'right' }}>{String(index + 1).padStart(2, '0')}</Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '140px minmax(0,1fr)', gap: 1.75, alignItems: 'center' }}>
                    <Box component="span" sx={{ color: text.secondary, fontSize: size.sm }}>
                      {item ? roleInChain(item.type, index, draft.chain.length) : 'Removed'}
                    </Box>
                    <Field select value={item ? id : ''} onChange={(event) => setChain((chain) => chain.map((value, at) => (at === index ? event.target.value : value)))}>
                      {ofTypes(CHAIN_TYPES).map((option) => <MenuItem key={option.id} value={option.id}>{optionText(option)}</MenuItem>)}
                    </Field>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}><IconifyIcon icon="tabler:chevron-up" sx={{ fontSize: 16 }} /></IconButton>
                    <IconButton aria-label="Move down" disabled={is_last} onClick={() => move(index, 1)}><IconifyIcon icon="tabler:chevron-down" sx={{ fontSize: 16 }} /></IconButton>
                    <IconButton aria-label="Remove" onClick={() => setChain((chain) => chain.filter((_, at) => at !== index))}><IconifyIcon icon="tabler:x" sx={{ fontSize: 18 }} /></IconButton>
                  </Box>
                </Box>
                {shared_size !== undefined && (
                  <Box sx={{ display: 'grid', gridTemplateColumns: '36px minmax(0,1fr) auto', gap: 1.5, alignItems: 'center', minHeight: 34 }}>
                    <span />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pl: { xs: 0, sm: '154px' }, fontSize: size.sm }}>
                      <Box component="span" sx={{ width: '1px', height: 22, bgcolor: shared_size ? tone.green500 : tone.amber500 }} />
                      {shared_size ? (
                        <Box component="span" sx={{ color: tone.green500 }}>
                          Connects · <Box component="span" sx={{ fontFamily: fontMono, fontWeight: 700 }}>{threadSizeLabel(sizes.get(shared_size))}</Box>
                        </Box>
                      ) : (
                        <Box component="span" sx={{ color: tone.amber400 }}>No shared thread</Box>
                      )}
                    </Box>
                    <span />
                  </Box>
                )}
              </Fragment>
            );
          })}
        </Box>
      </EditorSection>

      <EditorSection
        number="04"
        title="Filters"
        hint="Optional. Say where each filter sits: in a filter holder, screwed onto another element of the chain, or leave it unspecified."
        action={
          <Button variant="outlined" color="inherit" size="small" startIcon={<IconifyIcon icon="tabler:plus" />} onClick={addFilter} disabled={free_filters.length === 0}>
            Add filter
          </Button>
        }
      >
        {draft.filters.length === 0 && <Box sx={{ color: text.secondary, fontSize: size.base, py: 1.75 }}>No filters.</Box>}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {draft.filters.map((rig_filter, index) => {
            const filter = equipment_by_id.get(rig_filter.filter_id);
            const holder = rig_filter.holder_id ? equipment_by_id.get(rig_filter.holder_id) : undefined;
            const fits = filter && holder ? filterFitsHolder(toRigPart(filter), toRigPart(holder)) : null;
            return (
              <Box key={index} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 120px 36px', gap: 1.5, alignItems: 'center' }}>
                <Field select value={rig_filter.filter_id} onChange={(event) => setFilter(index, { filter_id: event.target.value })}>
                  {ofTypes([EquipmentType.FILTER])
                    .filter((option) => option.id === rig_filter.filter_id || !used_filter_ids.includes(option.id))
                    .map((option) => <MenuItem key={option.id} value={option.id}>{option.model}</MenuItem>)}
                </Field>
                <Field select value={rig_filter.holder_id ?? ''} onChange={(event) => setFilter(index, { holder_id: event.target.value || null })}>
                  <MenuItem value="">Not specified</MenuItem>
                  {chain_parts.map((part) => (
                    <MenuItem key={part.id} value={part.id}>
                      {part.type === EquipmentType.FILTER_HOLDER
                        ? `In ${part.model} · ${holder_count.get(part.id) ?? 0}/${part.specs.positions}`
                        : `On ${part.model}`}
                    </MenuItem>
                  ))}
                </Field>
                <Box component="span" sx={{ fontSize: size.sm, color: fits ? tone.green500 : tone.signal400 }}>
                  {fits === null ? '' : fits ? 'Fits' : "Doesn't fit"}
                </Box>
                <IconButton aria-label="Remove filter" onClick={() => set('filters', draft.filters.filter((_, at) => at !== index))}>
                  <IconifyIcon icon="tabler:x" sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
            );
          })}
        </Box>
      </EditorSection>

      <EditorSection number="05" title="Checks" hint="Errors block saving. Warnings don't.">
        {error_count + check.warnings.length + server_errors.length === 0 ? (
          <Box sx={{ color: tone.green500, fontSize: size.base }}>Every connection and filter checks out.</Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {[
              ...(is_name_missing ? ['Give the rig a name.'] : []),
              ...check.errors,
              ...server_errors,
            ].map((message, index) => (
              <Box key={`error-${index}`} sx={{ display: 'flex', gap: 1.25, fontSize: size.base }}>
                <Box component="span" sx={{ color: tone.signal400, width: 64, flexShrink: 0, fontSize: size.sm, pt: '2px' }}>Error</Box>
                <Box component="span" sx={{ color: text.primary }}>{message}</Box>
              </Box>
            ))}
            {check.warnings.map((message, index) => (
              <Box key={`warning-${index}`} sx={{ display: 'flex', gap: 1.25, fontSize: size.base }}>
                <Box component="span" sx={{ color: tone.amber400, width: 64, flexShrink: 0, fontSize: size.sm, pt: '2px' }}>Warning</Box>
                <Box component="span" sx={{ color: text.primary }}>{message}</Box>
              </Box>
            ))}
          </Box>
        )}
      </EditorSection>

      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          py: 2,
          borderTop: `1px solid ${border.default}`,
          bgcolor: 'background.default',
          zIndex: 1,
        }}
      >
        {!is_new && (
          <Button variant="text" sx={{ color: tone.signal400 }} onClick={() => onDelete(rig)}>
            Delete rig
          </Button>
        )}
        <Box component="span" sx={{ flex: 1, textAlign: 'right', color: text.secondary, fontSize: size.sm }}>
          {error_count > 0 ? `${error_count} error${error_count > 1 ? 's' : ''} to fix before saving` : ''}
        </Box>
        <Button variant="text" color="inherit" onClick={onCancel}>Cancel</Button>
        <Button variant="contained" disabled={!can_save} onClick={save}>
          {is_new ? 'Create rig' : 'Save changes'}
        </Button>
      </Box>
    </Box>
  );
}
