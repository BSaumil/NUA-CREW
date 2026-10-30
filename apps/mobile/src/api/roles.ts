import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Schemas } from '@nua-crew/contracts';
import type { PickedRole } from '@/features/roles';
import { toBody } from '@/features/roles';
import { api, unwrap } from './client';

export type RoleOut = Schemas['RoleOut'];

// Private to the signed-in candidate; never persisted offline (only public jobs are).
export const roleKeys = {
  mine: ['my-roles'] as const,
  departments: ['taxonomy-departments'] as const,
  search: (q: string, dept: string | null) => ['taxonomy-roles', q, dept] as const,
};

export const useMyRoles = () =>
  useQuery({
    queryKey: roleKeys.mine,
    queryFn: async () => unwrap(await api.GET('/v1/candidate/roles')),
  });

export const useResumeSuggestions = () =>
  useQuery({
    queryKey: ['role-suggestions'] as const,
    enabled: false, // only when the person asks; never scanned in the background
    gcTime: 0,
    queryFn: async () => unwrap(await api.GET('/v1/candidate/roles/suggestions', {})),
  });

export const useDepartments = () =>
  useQuery({
    queryKey: roleKeys.departments,
    staleTime: 60 * 60_000,
    queryFn: async () => unwrap(await api.GET('/v1/taxonomy/departments')),
  });

export const useRoleSearch = (q: string, dept: string | null, enabled = true) =>
  useQuery({
    queryKey: roleKeys.search(q, dept),
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/taxonomy/roles', {
          params: { query: { q: q.trim() || undefined, department: dept ?? undefined, limit: 20 } },
        }),
      ),
  });

export function useSaveMyRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (list: PickedRole[]) =>
      unwrap(await api.PUT('/v1/candidate/roles', { body: toBody(list) })),
    onSuccess: (data) => {
      qc.setQueryData(roleKeys.mine, data);
      void qc.invalidateQueries({ queryKey: ['match'] });
    },
  });
}
