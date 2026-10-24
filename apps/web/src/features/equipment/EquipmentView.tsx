import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { EquipmentType, type EquipmentResponse, type RigInput, type RigResponse } from '@sterenn/shared';
import IconifyIcon from '@app/components/base/IconifyIcon';
import { useEquipment } from './hooks/useEquipment';
import { ConfirmDialog } from './components/ConfirmDialog';
import { EquipmentDialog } from './components/EquipmentDialog';
import { GoogleSignIn } from './components/GoogleSignIn';
import { InventoryView } from './components/InventoryView';
import { PageTitle } from './components/primitives';
import { RigEditor } from './components/RigEditor';
import { RigsView } from './components/RigsView';
import { size, text, tone } from './tokens';

type TabName = 'inventory' | 'rigs';
// null: closed; 'new': add; otherwise the item being edited.
type EquipmentDialogState = null | 'new' | EquipmentResponse;
type RigEditorState = null | { mode: 'new' } | { mode: 'edit'; rig_id: string };

function toRigInput(rig: RigResponse): RigInput {
  return {
    name: rig.name,
    is_current: rig.is_current,
    mount_id: rig.mount_id ?? '',
    guide_telescope_id: rig.guide_telescope_id,
    guide_camera_id: rig.guide_camera_id,
    chain: rig.chain,
    filters: rig.filters,
  };
}

/**
 * Equipment screen (design: ui_kits/equipment/index.html, Rigs tab from
 * rigs-visual.html). Owns the hook and the open dialogs; the components render.
 */
export function EquipmentView() {
  const data = useEquipment();
  const [tab, setTab] = useState<TabName>('rigs');
  const [selected_equipment_id, setSelectedEquipmentId] = useState<string | null>(null);
  const [selected_rig_id, setSelectedRigId] = useState<string | null>(null);
  const [equipment_dialog, setEquipmentDialog] = useState<EquipmentDialogState>(null);
  const [equipment_to_delete, setEquipmentToDelete] = useState<{ equipment: EquipmentResponse; used_in: RigResponse[] } | null>(null);
  const [rig_editor, setRigEditor] = useState<RigEditorState>(null);
  const [rig_to_delete, setRigToDelete] = useState<RigResponse | null>(null);
  const [action_error, setActionError] = useState<string | null>(null);

  if (data.session.state === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (data.session.state === 'signed_out') {
    return <GoogleSignIn onCredential={data.signIn} />;
  }

  const current_count = data.rigs.filter((rig) => rig.is_current).length;
  const edited_rig = rig_editor?.mode === 'edit' ? data.rigs.find((rig) => rig.id === rig_editor.rig_id) : undefined;

  const saveRig = async (input: RigInput) => {
    const saved = await data.saveRig(input, edited_rig?.id ?? null);
    setSelectedRigId(saved.id);
    setRigEditor(null);
  };

  const toggleCurrent = (rig: RigResponse, is_current: boolean) => {
    setActionError(null);
    data.saveRig({ ...toRigInput(rig), is_current }, rig.id).catch(() => setActionError(`Could not update ${rig.name}.`));
  };

  return (
    <Box sx={{ px: { xs: 2, md: 5 }, pt: 3.5, pb: 7.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2.5, mb: 1 }}>
        <Box sx={{ flex: 1 }}>
          <PageTitle>Equipment</PageTitle>
          <Box sx={{ color: text.muted, fontSize: size.sm, mt: 0.75 }}>
            {data.equipment.length} pieces · {data.rigs.length} rigs · {current_count} current
          </Box>
        </Box>
        {tab === 'inventory' ? (
          <Button variant="contained" startIcon={<IconifyIcon icon="tabler:plus" />} onClick={() => setEquipmentDialog('new')}>
            Add equipment
          </Button>
        ) : (
          !rig_editor && (
            <Button variant="contained" startIcon={<IconifyIcon icon="tabler:plus" />} onClick={() => setRigEditor({ mode: 'new' })}>
              New rig
            </Button>
          )
        )}
      </Box>

      <Tabs
        value={tab}
        onChange={(_, value: TabName) => {
          setTab(value);
          setRigEditor(null);
          // Coming back to Rigs always lands on the current rig again.
          if (value === 'rigs') setSelectedRigId(null);
        }}
        sx={{ mb: 3 }}
      >
        <Tab value="rigs" label="Rigs" />
        <Tab value="inventory" label="Inventory" />
      </Tabs>

      {(data.load_error || action_error) && (
        <Box sx={{ color: tone.signal400, fontSize: size.sm, mb: 2 }}>{data.load_error ?? action_error}</Box>
      )}

      {tab === 'inventory' && (
        <InventoryView
          equipment={data.equipment}
          rigs={data.rigs}
          sizes={data.thread_size_by_id}
          selected_id={selected_equipment_id}
          onSelect={setSelectedEquipmentId}
          onEdit={(equipment) => setEquipmentDialog(equipment)}
          onDelete={(equipment, used_in) => setEquipmentToDelete({ equipment, used_in })}
        />
      )}

      {tab === 'rigs' && rig_editor && (
        <RigEditor
          key={rig_editor.mode === 'edit' ? rig_editor.rig_id : 'new'}
          rig={edited_rig}
          equipment={data.equipment}
          equipment_by_id={data.equipment_by_id}
          sizes={data.thread_size_by_id}
          onCancel={() => setRigEditor(null)}
          onSave={saveRig}
          onDelete={(rig) => setRigToDelete(rig)}
        />
      )}

      {tab === 'rigs' && !rig_editor && (
        <RigsView
          rigs={data.rigs}
          equipment_by_id={data.equipment_by_id}
          sizes={data.thread_size_by_id}
          selected_id={selected_rig_id}
          onSelect={setSelectedRigId}
          onNew={() => setRigEditor({ mode: 'new' })}
          onEdit={(rig) => setRigEditor({ mode: 'edit', rig_id: rig.id })}
          onToggleCurrent={toggleCurrent}
        />
      )}

      {equipment_dialog !== null && (
        <EquipmentDialog
          equipment={equipment_dialog === 'new' ? null : equipment_dialog}
          thread_sizes={data.thread_sizes}
          onClose={() => setEquipmentDialog(null)}
          onCreateThreadSize={data.createThreadSize}
          onSave={async (input, id) => {
            const saved = await data.saveEquipment(input, id);
            setSelectedEquipmentId(saved.id);
            setEquipmentDialog(null);
          }}
        />
      )}

      {equipment_to_delete && (
        <ConfirmDialog
          title={`Delete ${equipment_to_delete.equipment.model}?`}
          confirm_label="Delete"
          onCancel={() => setEquipmentToDelete(null)}
          onConfirm={async () => {
            await data.deleteEquipment(equipment_to_delete.equipment.id);
            setSelectedEquipmentId(null);
            setEquipmentToDelete(null);
          }}
        >
          {equipment_to_delete.used_in.length > 0
            ? `It will be removed from ${equipment_to_delete.used_in.map((rig) => rig.name).join(', ')}. The rigs are kept${
                equipment_to_delete.equipment.type === EquipmentType.MOUNT ? ' and flagged incomplete until you pick another mount' : ''
              }.`
            : "It isn't used in any rig."}
        </ConfirmDialog>
      )}

      {rig_to_delete && (
        <ConfirmDialog
          title={`Delete ${rig_to_delete.name}?`}
          confirm_label="Delete rig"
          onCancel={() => setRigToDelete(null)}
          onConfirm={async () => {
            await data.deleteRig(rig_to_delete.id);
            setRigToDelete(null);
            setRigEditor(null);
            setSelectedRigId(null);
          }}
        >
          The equipment in it is kept.
        </ConfirmDialog>
      )}
    </Box>
  );
}
