import type {
  EquipmentInput,
  EquipmentResponse,
  RigInput,
  RigResponse,
  ThreadSizeInput,
  ThreadSizeResponse,
  UserResponse,
} from '@sterenn/shared';
import { apiRequest } from './client';

// One function per route of ADR 0004 section 12. Bodies and responses are the
// shared types, so there is no wire shape to adapt.

export const signIn = (id_token: string) => apiRequest<UserResponse>('POST', '/auth/google', { id_token });
export const signOut = () => apiRequest<void>('POST', '/auth/logout');
export const fetchMe = () => apiRequest<UserResponse>('GET', '/auth/me');

export const listEquipment = () => apiRequest<EquipmentResponse[]>('GET', '/equipment');
export const createEquipment = (input: EquipmentInput) =>
  apiRequest<EquipmentResponse>('POST', '/equipment', input);
export const updateEquipment = (id: string, input: EquipmentInput) =>
  apiRequest<EquipmentResponse>('PUT', `/equipment/${id}`, input);
export const deleteEquipment = (id: string) => apiRequest<void>('DELETE', `/equipment/${id}`);

export const listThreadSizes = () => apiRequest<ThreadSizeResponse[]>('GET', '/thread-sizes');
export const createThreadSize = (input: ThreadSizeInput) =>
  apiRequest<ThreadSizeResponse>('POST', '/thread-sizes', input);

export const listRigs = () => apiRequest<RigResponse[]>('GET', '/rigs');
export const createRig = (input: RigInput) => apiRequest<RigResponse>('POST', '/rigs', input);
export const updateRig = (id: string, input: RigInput) => apiRequest<RigResponse>('PUT', `/rigs/${id}`, input);
export const deleteRig = (id: string) => apiRequest<void>('DELETE', `/rigs/${id}`);
