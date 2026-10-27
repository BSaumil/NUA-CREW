import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Schemas } from '@nua-crew/contracts';
import { useHireWorkspace } from '@/state/HireWorkspace';
import { api, unwrap, unwrapVoid, UserMessage } from './client';

export const canRecruit = (role: string | null) => role === 'owner' || role === 'recruiter';

function useHireQuery<T>(key: string[], task: (id: string) => Promise<T>) {
  const { employerId } = useHireWorkspace();
  return useQuery({
    queryKey: ['hire', employerId, ...key],
    enabled: !!employerId,
    queryFn: () => task(employerId!),
  });
}
function useHireMutation<T, R>(task: (id: string, input: T) => Promise<R>) {
  const { employerId } = useHireWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['hire-action', employerId],
    mutationFn: (input: T) => {
      if (!employerId) throw new UserMessage('Choose a business first.');
      return task(employerId, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hire', employerId] });
    },
  });
}

export const useHireBusiness = () =>
  useHireQuery(['business'], async (id) =>
    unwrap(await api.GET('/v1/employers/{employer_id}', { params: { path: { employer_id: id } } })),
  );
export const useHireBusinesses = () =>
  useHireQuery(['business-list'], async () => unwrap(await api.GET('/v1/employers')));
export const useHireJobs = () =>
  useHireQuery(['jobs'], async (id) =>
    unwrap(
      await api.GET('/v1/employers/{employer_id}/jobs', { params: { path: { employer_id: id } } }),
    ),
  );
export const useHireLocations = () =>
  useHireQuery(['locations'], async (id) =>
    unwrap(
      await api.GET('/v1/employers/{employer_id}/locations', {
        params: { path: { employer_id: id } },
      }),
    ),
  );
export const useHireMembers = () =>
  useHireQuery(['members'], async (id) =>
    unwrap(
      await api.GET('/v1/employers/{employer_id}/members', {
        params: { path: { employer_id: id } },
      }),
    ),
  );
export const useHireJob = (jobId: string) =>
  useHireQuery(['job', jobId], async (id) =>
    unwrap(
      await api.GET('/v1/employers/{employer_id}/jobs/{job_id}', {
        params: { path: { employer_id: id, job_id: jobId } },
      }),
    ),
  );
export const useHireApplicants = (jobId: string) =>
  useHireQuery(['applicants', jobId], async (id) =>
    unwrap(
      await api.GET('/v1/employers/{employer_id}/jobs/{job_id}/applications', {
        params: { path: { employer_id: id, job_id: jobId } },
      }),
    ),
  );
export const useHireApplicant = (applicationId: string) =>
  useHireQuery(['applicant', applicationId], async (id) =>
    unwrap(
      await api.GET('/v1/employers/{employer_id}/applications/{application_id}', {
        params: { path: { employer_id: id, application_id: applicationId } },
      }),
    ),
  );
export const useHireCreateJob = () =>
  useHireMutation(async (id, input: Schemas['JobIn']) =>
    unwrap(
      await api.POST('/v1/employers/{employer_id}/jobs', {
        params: { path: { employer_id: id } },
        body: input,
      }),
    ),
  );
export const useHireEditJob = (jobId: string) =>
  useHireMutation(async (id, input: Schemas['JobIn']) =>
    unwrap(
      await api.PUT('/v1/employers/{employer_id}/jobs/{job_id}', {
        params: { path: { employer_id: id, job_id: jobId } },
        body: input,
      }),
    ),
  );
export const useHireJobAction = (jobId: string) =>
  useHireMutation(async (id, action: 'publish' | 'unpublish' | 'close') => {
    const paths = {
      publish: '/v1/employers/{employer_id}/jobs/{job_id}/publish',
      unpublish: '/v1/employers/{employer_id}/jobs/{job_id}/unpublish',
      close: '/v1/employers/{employer_id}/jobs/{job_id}/close',
    } as const;
    return unwrap(
      await api.POST(paths[action], { params: { path: { employer_id: id, job_id: jobId } } }),
    );
  });
export const useHireDecision = (applicationId: string) =>
  useHireMutation(async (id, input: Schemas['StatusChangeIn']) =>
    unwrap(
      await api.POST('/v1/employers/{employer_id}/applications/{application_id}/status', {
        params: { path: { employer_id: id, application_id: applicationId } },
        body: input,
      }),
    ),
  );
export const useHireSearch = () =>
  useHireMutation(async (id, input: Schemas['TalentSearchIn']) =>
    unwrap(
      await api.POST('/v1/employers/{employer_id}/talent/search', {
        params: { path: { employer_id: id } },
        body: input,
      }),
    ),
  );
export const useHireInvite = () =>
  useHireMutation(async (id, input: { body: Schemas['InvitationIn']; key: string }) =>
    unwrap(
      await api.POST('/v1/employers/{employer_id}/invitations', {
        params: { path: { employer_id: id } },
        body: input.body,
        headers: { 'Idempotency-Key': input.key },
      }),
    ),
  );
export const useHireInvitations = () =>
  useHireQuery(['invitations'], async (id) =>
    unwrap(
      await api.GET('/v1/employers/{employer_id}/invitations', {
        params: { path: { employer_id: id } },
      }),
    ),
  );
export const useHireWithdraw = () =>
  useHireMutation(async (id, invitationId: string) =>
    unwrap(
      await api.POST('/v1/employers/{employer_id}/invitations/{invitation_id}/withdraw', {
        params: { path: { employer_id: id, invitation_id: invitationId } },
      }),
    ),
  );
export const useHireThreads = () =>
  useHireQuery(['threads'], async (id) =>
    unwrap(
      await api.GET('/v1/employers/{employer_id}/conversations', {
        params: { path: { employer_id: id } },
      }),
    ),
  );
export const useHireSend = (conversationId: string) =>
  useHireMutation(async (id, input: Schemas['MessageIn']) =>
    unwrap(
      await api.POST('/v1/employers/{employer_id}/conversations/{conversation_id}/messages', {
        params: { path: { employer_id: id, conversation_id: conversationId } },
        body: input,
      }),
    ),
  );
export const useHireRead = (conversationId: string) =>
  useHireMutation(async (id, _: void) =>
    unwrapVoid(
      await api.POST('/v1/employers/{employer_id}/conversations/{conversation_id}/read', {
        params: { path: { employer_id: id, conversation_id: conversationId } },
      }),
    ),
  );
export function useHireMessages(conversationId: string) {
  const { employerId } = useHireWorkspace();
  return useInfiniteQuery({
    queryKey: ['hire', employerId, 'messages', conversationId],
    enabled: !!employerId,
    initialPageParam: undefined as string | undefined,
    refetchInterval: 15_000,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET('/v1/employers/{employer_id}/conversations/{conversation_id}/messages', {
          params: {
            path: { employer_id: employerId!, conversation_id: conversationId },
            query: { limit: 30, before: pageParam },
          },
        }),
      ),
    getNextPageParam: (last) => last.next_before ?? undefined,
  });
}
export const useHireAddLocation = () =>
  useHireMutation(async (id, input: Schemas['LocationIn']) =>
    unwrap(
      await api.POST('/v1/employers/{employer_id}/locations', {
        params: { path: { employer_id: id } },
        body: input,
      }),
    ),
  );
export const useHireAddMember = () =>
  useHireMutation(async (id, input: Schemas['MemberIn']) =>
    unwrap(
      await api.POST('/v1/employers/{employer_id}/members', {
        params: { path: { employer_id: id } },
        body: input,
      }),
    ),
  );
export const useHireReport = (conversationId: string) =>
  useHireMutation(async (id, input: Schemas['ReportIn']) =>
    unwrap(
      await api.POST('/v1/employers/{employer_id}/conversations/{conversation_id}/report', {
        params: { path: { employer_id: id, conversation_id: conversationId } },
        body: input,
      }),
    ),
  );
