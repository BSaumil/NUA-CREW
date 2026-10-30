import { createContext, useContext, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Schemas } from '@nua-crew/contracts';
import { api, unwrap } from '@/api/client';
import { useAuth } from './AuthProvider';

type Workspace = {
  employerId: string | null;
  role: string | null;
  memberships: Schemas['MembershipOut'][];
  select: (id: string) => void;
  pending: boolean;
  error: unknown;
  retry: () => void;
};
const Context = createContext<Workspace | null>(null);

/** Selection and all hiring data stay in memory, never in the public offline cache. */
export function HireWorkspaceProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const me = useQuery({
    queryKey: ['hire-memberships'],
    enabled: auth.status === 'signedIn' && auth.role === 'employer',
    queryFn: async () => unwrap(await api.GET('/v1/auth/me')),
  });
  const memberships = auth.role === 'employer' ? (me.data?.memberships ?? []) : [];
  const active = memberships.find((m) => m.employer_id === selected) ?? memberships[0];
  return (
    <Context.Provider
      value={{
        employerId: active?.employer_id ?? null,
        role: active?.role ?? null,
        memberships,
        select: (id) => {
          if (memberships.some((m) => m.employer_id === id)) setSelected(id);
        },
        pending: me.isPending,
        error: me.error,
        retry: () => {
          void me.refetch();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useHireWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error('HireWorkspaceProvider is required');
  return value;
}
