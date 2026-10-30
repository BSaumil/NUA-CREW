import type { Schemas } from '@nua-crew/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './client';
import { useHireMutation, useHireQuery } from './hire';

export const useShifts = () =>
  useHireQuery(['shifts'], async (id) =>
    unwrap(
      await api.GET('/v1/employers/{employer_id}/shifts', {
        params: { path: { employer_id: id } },
      }),
    ),
  );
export const useCreateShift = () =>
  useHireMutation(async (id, body: Schemas['ShiftIn']) =>
    unwrap(
      await api.POST('/v1/employers/{employer_id}/shifts', {
        params: { path: { employer_id: id } },
        body,
      }),
    ),
  );
export const useOfferShift = () =>
  useHireMutation(async (id, input: { shift: string; conversation: string }) =>
    unwrap(
      await api.POST('/v1/employers/{employer_id}/shifts/{shift_id}/offers', {
        params: { path: { employer_id: id, shift_id: input.shift } },
        body: { conversation_id: input.conversation },
      }),
    ),
  );
export const useCancelShift = () =>
  useHireMutation(async (id, input: { shift: string; reason: string }) =>
    unwrap(
      await api.POST('/v1/employers/{employer_id}/shifts/{shift_id}/cancel', {
        params: { path: { employer_id: id, shift_id: input.shift } },
        body: { reason: input.reason },
      }),
    ),
  );
export const useEmployerBookings = () =>
  useHireQuery(['shift-bookings'], async (id) =>
    unwrap(
      await api.GET('/v1/employers/{employer_id}/shift-bookings', {
        params: { path: { employer_id: id } },
      }),
    ),
  );
export const useReviewTimesheet = () =>
  useHireMutation(async (id, input: { booking: string; body: Schemas['TimesheetReviewIn'] }) =>
    unwrap(
      await api.POST('/v1/employers/{employer_id}/shift-bookings/{booking_id}/timesheet-review', {
        params: { path: { employer_id: id, booking_id: input.booking } },
        body: input.body,
      }),
    ),
  );

export function useMyBookings() {
  return useQuery({
    queryKey: ['shift-bookings'],
    queryFn: async () => unwrap(await api.GET('/v1/candidate/shift-bookings')),
  });
}
export function useBookingAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { booking: string; body: Schemas['BookingActionIn'] }) =>
      unwrap(
        await api.POST('/v1/candidate/shift-bookings/{booking_id}/respond', {
          params: { path: { booking_id: input.booking } },
          body: input.body,
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['shift-bookings'] });
      void qc.invalidateQueries({ queryKey: ['timesheet-history'] });
      void qc.invalidateQueries({ queryKey: ['availability'] });
    },
  });
}
export function useSubmitTimesheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { booking: string; body: Schemas['TimesheetIn'] }) =>
      unwrap(
        await api.PUT('/v1/candidate/shift-bookings/{booking_id}/timesheet', {
          params: { path: { booking_id: input.booking } },
          body: input.body,
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['shift-bookings'] });
      void qc.invalidateQueries({ queryKey: ['timesheet-history'] });
    },
  });
}

export function useCandidateAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      booking,
      action,
      body,
    }: {
      booking: string;
      action: 'check-in' | 'check-out' | 'correction';
      body?: Schemas['CorrectionIn'];
    }) => {
      if (action === 'correction')
        return unwrap(
          await api.POST('/v1/candidate/shift-bookings/{booking_id}/attendance-corrections', {
            params: { path: { booking_id: booking } },
            body: body!,
          }),
        );
      if (action === 'check-in')
        return unwrap(
          await api.POST('/v1/candidate/shift-bookings/{booking_id}/check-in', {
            params: { path: { booking_id: booking } },
          }),
        );
      return unwrap(
        await api.POST('/v1/candidate/shift-bookings/{booking_id}/check-out', {
          params: { path: { booking_id: booking } },
        }),
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['shift-bookings'] });
    },
  });
}
export const useReviewCorrection = () =>
  useHireMutation(
    async (id, input: { booking: string; event: string; body: Schemas['CorrectionReviewIn'] }) =>
      unwrap(
        await api.POST(
          '/v1/employers/{employer_id}/shift-bookings/{booking_id}/attendance-corrections/{event_id}/review',
          {
            params: { path: { employer_id: id, booking_id: input.booking, event_id: input.event } },
            body: input.body,
          },
        ),
      ),
  );
export function useTimesheetHistory(booking: string, employerId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['timesheet-history', employerId, booking],
    enabled,
    queryFn: async () =>
      employerId
        ? unwrap(
            await api.GET(
              '/v1/employers/{employer_id}/shift-bookings/{booking_id}/timesheet-history',
              { params: { path: { employer_id: employerId, booking_id: booking } } },
            ),
          )
        : unwrap(
            await api.GET('/v1/candidate/shift-bookings/{booking_id}/timesheet-history', {
              params: { path: { booking_id: booking } },
            }),
          ),
  });
}
