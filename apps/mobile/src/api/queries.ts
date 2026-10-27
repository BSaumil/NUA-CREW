import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type { Schemas } from '@nua-crew/contracts';
import type { JobFilters } from '@/features/filters';
import { toQuery } from '@/features/filters';
import { api, unwrap, unwrapVoid } from './client';

export type Job = Schemas['JobOut'];
export type SavedSearch = Schemas['SavedSearchOut'];
export type Profile = Schemas['ProfileOut'];
export type ProfileIn = Schemas['ProfileIn'];

export const keys = {
  jobs: (f: JobFilters) => ['jobs', toQuery(f)] as const,
  job: (id: string) => ['job', id] as const,
  match: (id: string) => ['match', id] as const,
  savedIds: ['saved-ids'] as const,
  savedJobs: ['saved-jobs'] as const,
  savedSearches: ['saved-searches'] as const,
  applications: ['applications'] as const,
  application: (id: string) => ['application', id] as const,
  notifications: ['notifications'] as const,
  profile: ['profile'] as const,
  resumes: ['resumes'] as const,
  me: ['me'] as const,
  // Private to the signed-in candidate; never in the offline cache (see PERSISTED in the layout).
  workPrefs: ['work-prefs'] as const,
  availability: ['availability'] as const,
  employerPrefs: ['employer-prefs'] as const,
  inbox: ['inbox'] as const,
  invitations: ['invitations'] as const,
  invitation: (id: string) => ['invitation', id] as const,
  conversations: ['conversations'] as const,
  messages: (id: string) => ['messages', id] as const,
};

const PAGE = 15;

export function useJobs(filters: JobFilters) {
  return useInfiniteQuery({
    queryKey: keys.jobs(filters),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET('/v1/jobs', {
          params: { query: { ...toQuery(filters), page: pageParam, page_size: PAGE } },
        }),
      ),
    getNextPageParam: (last) =>
      last.page * last.page_size < last.total ? last.page + 1 : undefined,
  });
}

export const useJob = (id: string) =>
  useQuery({
    queryKey: keys.job(id),
    queryFn: async () =>
      unwrap(await api.GET('/v1/jobs/{job_id}', { params: { path: { job_id: id } } })),
  });

export const useMatch = (id: string) =>
  useQuery({
    queryKey: keys.match(id),
    queryFn: async () =>
      unwrap(await api.GET('/v1/jobs/{job_id}/match', { params: { path: { job_id: id } } })),
  });

export const useMe = () =>
  useQuery({ queryKey: keys.me, queryFn: async () => unwrap(await api.GET('/v1/auth/me')) });

// ---- saved jobs ----
export const useSavedIds = () =>
  useQuery({
    queryKey: keys.savedIds,
    queryFn: async () => unwrap(await api.GET('/v1/candidate/saved-jobs/ids')),
  });

export const useSavedJobs = () =>
  useQuery({
    queryKey: keys.savedJobs,
    queryFn: async () => unwrap(await api.GET('/v1/candidate/saved-jobs')),
  });

/** Heart toggle with optimistic update; rolls back and refetches if the server disagrees. */
export function useToggleSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, save }: { id: string; save: boolean }) => {
      const params = { params: { path: { job_id: id } } };
      unwrapVoid(
        save
          ? await api.PUT('/v1/candidate/saved-jobs/{job_id}', params)
          : await api.DELETE('/v1/candidate/saved-jobs/{job_id}', params),
      );
    },
    onMutate: async ({ id, save }) => {
      await qc.cancelQueries({ queryKey: keys.savedIds });
      const prev = qc.getQueryData<string[]>(keys.savedIds) ?? [];
      qc.setQueryData<string[]>(
        keys.savedIds,
        save ? [...new Set([...prev, id])] : prev.filter((x) => x !== id),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx && qc.setQueryData(keys.savedIds, ctx.prev),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.savedIds });
      void qc.invalidateQueries({ queryKey: keys.savedJobs });
    },
  });
}

// ---- saved searches ----
export const useSavedSearches = () =>
  useQuery({
    queryKey: keys.savedSearches,
    queryFn: async () => unwrap(await api.GET('/v1/candidate/saved-searches')),
  });

export function useCreateSavedSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Schemas['SavedSearchIn']) =>
      unwrap(await api.POST('/v1/candidate/saved-searches', { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.savedSearches }),
  });
}

export function usePatchSavedSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string } & Schemas['SavedSearchPatch']) =>
      unwrap(
        await api.PATCH('/v1/candidate/saved-searches/{search_id}', {
          params: { path: { search_id: id } },
          body,
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.savedSearches }),
  });
}

export function useDeleteSavedSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrapVoid(
        await api.DELETE('/v1/candidate/saved-searches/{search_id}', {
          params: { path: { search_id: id } },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.savedSearches }),
  });
}

// ---- applications ----
export const useApplications = () =>
  useQuery({
    queryKey: keys.applications,
    queryFn: async () => unwrap(await api.GET('/v1/candidate/applications')),
  });

export const useApplication = (id: string) =>
  useQuery({
    queryKey: keys.application(id),
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/candidate/applications/{application_id}', {
          params: { path: { application_id: id } },
        }),
      ),
  });

export function useApply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jobId,
      resumeId,
      note,
      idempotencyKey,
    }: {
      jobId: string;
      resumeId: string | null;
      note: string;
      idempotencyKey: string;
    }) =>
      unwrap(
        await api.POST('/v1/jobs/{job_id}/applications', {
          params: { path: { job_id: jobId }, header: { 'idempotency-key': idempotencyKey } },
          body: { resume_id: resumeId, cover_note: note || null },
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.applications });
    },
  });
}

export function useWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.POST('/v1/candidate/applications/{application_id}/withdraw', {
          params: { path: { application_id: id } },
        }),
      ),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: keys.applications });
      void qc.invalidateQueries({ queryKey: keys.application(id) });
    },
  });
}

// ---- notifications ----
export const useNotifications = () =>
  useQuery({
    queryKey: keys.notifications,
    queryFn: async () => unwrap(await api.GET('/v1/notifications')),
    refetchInterval: 60_000,
  });

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.POST('/v1/notifications/{notification_id}/read', {
          params: { path: { notification_id: id } },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrapVoid(await api.POST('/v1/notifications/read-all')),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  });
}

// ---- profile ----
export const useProfile = () =>
  useQuery({
    queryKey: keys.profile,
    queryFn: async () => unwrap(await api.GET('/v1/candidate/profile')),
  });

export const useResumes = () =>
  useQuery({
    queryKey: keys.resumes,
    queryFn: async () => unwrap(await api.GET('/v1/candidate/resumes')),
  });

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: ProfileIn) => unwrap(await api.PUT('/v1/candidate/profile', { body })),
    onSuccess: (data) => qc.setQueryData(keys.profile, data),
  });
}

export function useAddResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { title: string; content_text: string }) =>
      unwrap(await api.POST('/v1/candidate/resumes', { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.resumes }),
  });
}

export function useAddResumeVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content_text }: { id: string; content_text: string }) =>
      unwrap(
        await api.POST('/v1/candidate/resumes/{resume_id}/versions', {
          params: { path: { resume_id: id } },
          body: { content_text },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.resumes }),
  });
}

export function useDiscoveryConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (granted: boolean) =>
      unwrap(await api.PUT('/v1/candidate/consents/talent-discovery', { body: { granted } })),
    onSuccess: (data) => qc.setQueryData(keys.profile, data),
  });
}

export function usePushSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (push_enabled: boolean) =>
      unwrap(await api.PUT('/v1/candidate/notification-settings', { body: { push_enabled } })),
    onSuccess: (data) => qc.setQueryData(keys.profile, data),
  });
}

/** Remove everything cached for the signed-in person (sign-out, account deletion). */
export function wipeCache(qc: QueryClient) {
  qc.clear();
}

// ---- work preferences, availability, employer preferences (private) ----
export type WorkPrefs = Schemas['WorkPreferencesOut'];
export type WorkPrefIn = Schemas['WorkPreferenceIn'];
export type Availability = Schemas['AvailabilityOut'];
export type EmployerPref = Schemas['EmployerPreferenceOut'];

export const useWorkPrefs = () =>
  useQuery({
    queryKey: keys.workPrefs,
    queryFn: async () => unwrap(await api.GET('/v1/candidate/work-preferences')),
  });

export function useSaveWorkPref() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, body }: { kind: 'permanent' | 'temporary'; body: WorkPrefIn }) =>
      unwrap(
        await api.PUT('/v1/candidate/work-preferences/{kind}', {
          params: { path: { kind } },
          body,
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workPrefs }),
  });
}

export function useKindConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      kind,
      granted,
      alsoMaster,
    }: {
      kind: 'permanent' | 'temporary';
      granted: boolean;
      /** Granting needs the master talent-discovery switch on as well. */
      alsoMaster: boolean;
    }) => {
      if (granted && alsoMaster) {
        unwrap(
          await api.PUT('/v1/candidate/consents/talent-discovery', { body: { granted: true } }),
        );
      }
      return unwrap(
        await api.PUT('/v1/candidate/consents/discovery/{kind}', {
          params: { path: { kind } },
          body: { granted },
        }),
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.workPrefs });
      void qc.invalidateQueries({ queryKey: keys.profile });
    },
  });
}

export const useAvailability = () =>
  useQuery({
    queryKey: keys.availability,
    queryFn: async () => unwrap(await api.GET('/v1/candidate/availability')),
  });

export function useSaveRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Schemas['AvailabilityRulesIn']) =>
      unwrap(await api.PUT('/v1/candidate/availability/rules', { body })),
    onSuccess: (data) => qc.setQueryData(keys.availability, data),
  });
}

export function useAddException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Schemas['AvailabilityExceptionIn']) =>
      unwrap(await api.POST('/v1/candidate/availability/exceptions', { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.availability }),
  });
}

export function useDeleteException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrapVoid(
        await api.DELETE('/v1/candidate/availability/exceptions/{exception_id}', {
          params: { path: { exception_id: id } },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.availability }),
  });
}

export function useAddCommitment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Schemas['CommitmentIn']) =>
      unwrap(await api.POST('/v1/candidate/availability/commitments', { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.availability }),
  });
}

export function useDeleteCommitment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrapVoid(
        await api.DELETE('/v1/candidate/availability/commitments/{commitment_id}', {
          params: { path: { commitment_id: id } },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.availability }),
  });
}

export const useEmployerPrefs = () =>
  useQuery({
    queryKey: keys.employerPrefs,
    queryFn: async () => unwrap(await api.GET('/v1/candidate/employer-preferences')),
  });

export const useEmployerDirectory = (q: string) =>
  useQuery({
    queryKey: ['employer-directory', q] as const,
    enabled: q.trim().length >= 2,
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/candidate/employer-directory', { params: { query: { q: q.trim() } } }),
      ),
  });

export function useAddEmployerPref() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Schemas['EmployerPreferenceIn']) =>
      unwrap(await api.POST('/v1/candidate/employer-preferences', { body })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.employerPrefs });
      // a mute changes which jobs are listed
      void qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useDeleteEmployerPref() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrapVoid(
        await api.DELETE('/v1/candidate/employer-preferences/{pref_id}', {
          params: { path: { pref_id: id } },
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.employerPrefs });
      void qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

// ---- invitations and messaging (private; never in the offline cache) ----
export type Invitation = Schemas['InvitationOut'];
export type Conversation = Schemas['ConversationOut'];
export type Message = Schemas['MessageOut'];

export const useInboxSummary = () =>
  useQuery({
    queryKey: keys.inbox,
    queryFn: async () => unwrap(await api.GET('/v1/candidate/inbox/summary')),
    refetchInterval: 60_000,
  });

export const useInvitations = () =>
  useQuery({
    queryKey: keys.invitations,
    queryFn: async () => unwrap(await api.GET('/v1/candidate/invitations')),
  });

export const useInvitation = (id: string) =>
  useQuery({
    queryKey: keys.invitation(id),
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/candidate/invitations/{invitation_id}', {
          params: { path: { invitation_id: id } },
        }),
      ),
    retry: false, // a 404 (not yours, or gone) is final
  });

function refreshInbox(qc: QueryClient, id?: string) {
  void qc.invalidateQueries({ queryKey: keys.inbox });
  void qc.invalidateQueries({ queryKey: keys.invitations });
  void qc.invalidateQueries({ queryKey: keys.conversations });
  if (id) void qc.invalidateQueries({ queryKey: keys.invitation(id) });
}

export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, termsHash }: { id: string; termsHash: string }) =>
      unwrap(
        await api.POST('/v1/candidate/invitations/{invitation_id}/accept', {
          params: { path: { invitation_id: id } },
          body: { terms_hash: termsHash },
        }),
      ),
    onSettled: (_d, _e, v) => refreshInbox(qc, v.id),
  });
}

export function useDeclineInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.POST('/v1/candidate/invitations/{invitation_id}/decline', {
          params: { path: { invitation_id: id } },
        }),
      ),
    onSettled: (_d, _e, id) => refreshInbox(qc, id),
  });
}

export const useConversations = () =>
  useQuery({
    queryKey: keys.conversations,
    queryFn: async () => unwrap(await api.GET('/v1/candidate/conversations')),
  });

export function useMessages(id: string) {
  return useInfiniteQuery({
    queryKey: keys.messages(id),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET('/v1/candidate/conversations/{conversation_id}/messages', {
          params: {
            path: { conversation_id: id },
            query: { before: pageParam ?? null, limit: 30 },
          },
        }),
      ),
    getNextPageParam: (last) => last.next_before ?? undefined,
    retry: false,
  });
}

export function useSendMessage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, clientKey }: { body: string; clientKey: string }) =>
      unwrap(
        await api.POST('/v1/candidate/conversations/{conversation_id}/messages', {
          params: { path: { conversation_id: id } },
          body: { body, client_key: clientKey },
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.messages(id) });
      void qc.invalidateQueries({ queryKey: keys.conversations });
    },
  });
}

export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrapVoid(
        await api.POST('/v1/candidate/conversations/{conversation_id}/read', {
          params: { path: { conversation_id: id } },
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.inbox });
      void qc.invalidateQueries({ queryKey: keys.conversations });
    },
  });
}

export function useCloseConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.POST('/v1/candidate/conversations/{conversation_id}/close', {
          params: { path: { conversation_id: id } },
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.conversations });
      void qc.invalidateQueries({ queryKey: keys.inbox });
    },
  });
}

export const useReportConversation = () =>
  useMutation({
    mutationFn: async ({
      id,
      reason,
      messageId,
    }: {
      id: string;
      reason: string;
      messageId?: string | null;
    }) =>
      unwrap(
        await api.POST('/v1/candidate/conversations/{conversation_id}/report', {
          params: { path: { conversation_id: id } },
          body: { reason, message_id: messageId ?? null },
        }),
      ),
  });

export const useInvitationSettings = () =>
  useQuery({
    queryKey: ['invitation-settings'] as const,
    queryFn: async () => unwrap(await api.GET('/v1/candidate/invitation-settings')),
  });

export function useSetInvitationsEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) =>
      unwrap(await api.PUT('/v1/candidate/invitation-settings', { body: { enabled } })),
    onSuccess: (data) => qc.setQueryData(['invitation-settings'], data),
  });
}
