import { useMutation, useQuery } from '@tanstack/react-query';
import { useHireWorkspace } from '@/state/HireWorkspace';
import type { Schemas } from '@nua-crew/contracts';
import { api, unwrap } from './client';

export type Award = Schemas['InstrumentOut'];
export type PayAssessmentOut = Schemas['PayAssessmentOut'];

export const useAwards = () =>
  useQuery({
    queryKey: ['awards'] as const,
    staleTime: 60 * 60_000,
    queryFn: async () => unwrap(await api.GET('/v1/awards')),
  });

export const useCoverageGuidance = (roleCode: string | null) =>
  useQuery({
    queryKey: ['coverage-guidance', roleCode] as const,
    enabled: !!roleCode,
    staleTime: 60 * 60_000,
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/awards/coverage-guidance', {
          params: { query: { role_code: roleCode ?? undefined } },
        }),
      ),
  });

function useHireAction<T, R>(task: (employerId: string, input: T) => Promise<R>) {
  const { employerId } = useHireWorkspace();
  return useMutation({
    mutationFn: (input: T) => {
      if (!employerId) throw new Error('Choose a business first.');
      return task(employerId, input);
    },
  });
}

export const useAssessPay = () =>
  useHireAction(async (id, body: Schemas['PayAssessmentIn']) =>
    unwrap(
      await api.POST('/v1/employers/{employer_id}/pay-assessments', {
        params: { path: { employer_id: id } },
        body,
      }),
    ),
  );

export const useAcknowledgePay = () =>
  useHireAction(async (id, assessmentId: string) =>
    unwrap(
      await api.POST('/v1/employers/{employer_id}/pay-assessments/{assessment_id}/acknowledge', {
        params: { path: { employer_id: id, assessment_id: assessmentId } },
        body: { note: 'Reviewed in the app job flow' },
      }),
    ),
  );
