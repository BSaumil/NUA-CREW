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
    },
  });
}

/** Attendance: the server records the time of a check in or out; the phone never sends one. */
function useCandidateAttendance<T>(call: (booking: string, input: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { booking: string } & T) => call(input.booking, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['shift-bookings'] });
    },
  });
}
export const useCheckIn = () =>
  useCandidateAttendance<object>(async (booking) =>
    unwrap(
      await api.POST('/v1/candidate/shift-bookings/{booking_id}/check-in', {
        params: { path: { booking_id: booking } },
      }),
    ),
  );
export const useCheckOut = () =>
  useCandidateAttendance<object>(async (booking) =>
    unwrap(
      await api.POST('/v1/candidate/shift-bookings/{booking_id}/check-out', {
        params: { path: { booking_id: booking } },
      }),
    ),
  );
export const useRequestCorrection = () =>
  useCandidateAttendance<{ body: Schemas['CorrectionIn'] }>(async (booking, input) =>
    unwrap(
      await api.POST('/v1/candidate/shift-bookings/{booking_id}/attendance-corrections', {
        params: { path: { booking_id: booking } },
        body: input.body,
      }),
    ),
  );
export const useReviewCorrection = () =>
  useHireMutation(
    async (id, input: { booking: string; event: string; body: Schemas['CorrectionReviewIn'] }) =>
      unwrap(
        await api.POST(
          '/v1/employers/{employer_id}/shift-bookings/{booking_id}/attendance-corrections/{event_id}/review',
          {
            params: {
              path: { employer_id: id, booking_id: input.booking, event_id: input.event },
            },
            body: input.body,
          },
        ),
      ),
  );
export const useNoShow = () =>
  useHireMutation(
    async (id, input: { booking: string; reverse: boolean; body: Schemas['ReasonIn'] }) =>
      input.reverse
        ? unwrap(
            await api.POST(
              '/v1/employers/{employer_id}/shift-bookings/{booking_id}/no-show/reverse',
              {
                params: { path: { employer_id: id, booking_id: input.booking } },
                body: input.body,
              },
            ),
          )
        : unwrap(
            await api.POST('/v1/employers/{employer_id}/shift-bookings/{booking_id}/no-show', {
              params: { path: { employer_id: id, booking_id: input.booking } },
              body: input.body,
            }),
          ),
  );
