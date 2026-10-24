import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  EquipmentInput,
  EquipmentResponse,
  RigInput,
  RigResponse,
  ThreadSizeInput,
  ThreadSizeResponse,
  UserResponse,
} from '@sterenn/shared';
import * as api from '@app/data/sterennApi';

export type Session = { state: 'loading' } | { state: 'signed_out' } | { state: 'signed_in'; user: UserResponse };

export type EquipmentData = {
  session: Session;
  equipment: EquipmentResponse[];
  thread_sizes: ThreadSizeResponse[];
  rigs: RigResponse[];
  equipment_by_id: ReadonlyMap<string, EquipmentResponse>;
  thread_size_by_id: ReadonlyMap<string, ThreadSizeResponse>;
  load_error: string | null;
  signIn: (id_token: string) => Promise<void>;
  signOut: () => Promise<void>;
  saveEquipment: (input: EquipmentInput, id: string | null) => Promise<EquipmentResponse>;
  deleteEquipment: (id: string) => Promise<void>;
  createThreadSize: (input: ThreadSizeInput) => Promise<ThreadSizeResponse>;
  saveRig: (input: RigInput, id: string | null) => Promise<RigResponse>;
  deleteRig: (id: string) => Promise<void>;
};

// Wires the API to the equipment screens. Rig problems are recomputed by the
// API on read, so after any equipment change the rigs are reloaded too.
export function useEquipment(): EquipmentData {
  const [session, setSession] = useState<Session>({ state: 'loading' });
  const [equipment, setEquipment] = useState<EquipmentResponse[]>([]);
  const [thread_sizes, setThreadSizes] = useState<ThreadSizeResponse[]>([]);
  const [rigs, setRigs] = useState<RigResponse[]>([]);
  const [load_error, setLoadError] = useState<string | null>(null);

  // Any 401 means the session is gone: fall back to the sign-in screen.
  const guard = useCallback(async <T,>(request: Promise<T>): Promise<T> => {
    try {
      return await request;
    } catch (error) {
      if (api.isUnauthorized(error)) {
        setSession({ state: 'signed_out' });
      }
      throw error;
    }
  }, []);

  const reloadRigs = useCallback(async () => setRigs(await guard(api.listRigs())), [guard]);

  const reloadAll = useCallback(async () => {
    try {
      const [loaded_equipment, loaded_thread_sizes, loaded_rigs] = await guard(
        Promise.all([api.listEquipment(), api.listThreadSizes(), api.listRigs()]),
      );
      setEquipment(loaded_equipment);
      setThreadSizes(loaded_thread_sizes);
      setRigs(loaded_rigs);
      setLoadError(null);
    } catch (error) {
      if (!api.isUnauthorized(error)) {
        setLoadError(api.errorMessages(error).join('. '));
      }
    }
  }, [guard]);

  useEffect(() => {
    api
      .fetchMe()
      .then((user) => {
        setSession({ state: 'signed_in', user });
        return reloadAll();
      })
      .catch((error: unknown) => {
        setSession({ state: 'signed_out' });
        if (!api.isUnauthorized(error)) {
          setLoadError(api.errorMessages(error).join('. '));
        }
      });
  }, [reloadAll]);

  const signIn = useCallback(
    async (id_token: string) => {
      const user = await api.signIn(id_token);
      setSession({ state: 'signed_in', user });
      await reloadAll();
    },
    [reloadAll],
  );

  const signOut = useCallback(async () => {
    await api.signOut();
    setSession({ state: 'signed_out' });
  }, []);

  const saveEquipment = useCallback(
    async (input: EquipmentInput, id: string | null) => {
      const saved = await guard(id === null ? api.createEquipment(input) : api.updateEquipment(id, input));
      setEquipment((list) =>
        list.some((item) => item.id === saved.id)
          ? list.map((item) => (item.id === saved.id ? saved : item))
          : [...list, saved],
      );
      await reloadRigs();
      return saved;
    },
    [guard, reloadRigs],
  );

  const deleteEquipment = useCallback(
    async (id: string) => {
      await guard(api.deleteEquipment(id));
      setEquipment((list) => list.filter((item) => item.id !== id));
      await reloadRigs();
    },
    [guard, reloadRigs],
  );

  const createThreadSize = useCallback(
    async (input: ThreadSizeInput) => {
      const created = await guard(api.createThreadSize(input));
      setThreadSizes((list) => [...list, created]);
      return created;
    },
    [guard],
  );

  const saveRig = useCallback(
    async (input: RigInput, id: string | null) => {
      const saved = await guard(id === null ? api.createRig(input) : api.updateRig(id, input));
      setRigs((list) =>
        list.some((rig) => rig.id === saved.id) ? list.map((rig) => (rig.id === saved.id ? saved : rig)) : [...list, saved],
      );
      return saved;
    },
    [guard],
  );

  const deleteRig = useCallback(
    async (id: string) => {
      await guard(api.deleteRig(id));
      setRigs((list) => list.filter((rig) => rig.id !== id));
    },
    [guard],
  );

  const equipment_by_id = useMemo(() => new Map(equipment.map((item) => [item.id, item])), [equipment]);
  const thread_size_by_id = useMemo(() => new Map(thread_sizes.map((size) => [size.id, size])), [thread_sizes]);

  return {
    session,
    equipment,
    thread_sizes,
    rigs,
    equipment_by_id,
    thread_size_by_id,
    load_error,
    signIn,
    signOut,
    saveEquipment,
    deleteEquipment,
    createThreadSize,
    saveRig,
    deleteRig,
  };
}
