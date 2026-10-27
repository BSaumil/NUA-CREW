'use server';

import { redirect } from 'next/navigation';
import type { Schemas } from '@nua-crew/contracts';
import { api, errorMessage, requireEmployer } from '@/lib/api';

const field = (f: FormData, key: string) => String(f.get(key) ?? '').trim();
const back = (kind: string, message: string) =>
  redirect(`/billing?${kind}=${encodeURIComponent(message)}`);
function confirm(form: FormData) {
  if (form.get('confirm') !== 'on') back('error', 'Review and confirm the action first.');
}
function stripeRedirect(url: string) {
  if (!url.startsWith('https://checkout.stripe.com/'))
    back('error', 'Stripe did not return a valid checkout URL.');
  redirect(url);
}
export async function startCheckout(form: FormData) {
  const { employerId } = await requireEmployer();
  confirm(form);
  const { data, error } = await (
    await api()
  ).POST('/v1/employers/{employer_id}/billing/checkout', {
    params: { path: { employer_id: employerId } },
    body: {
      job_id: field(form, 'job_id'),
      action: field(form, 'action') as Schemas['CheckoutIn']['action'],
      client_key: field(form, 'client_key'),
      confirm_publish_and_terms: true,
    },
  });
  if (!data) back('error', errorMessage(error));
  else stripeRedirect(data.checkout_url);
}
export async function resumeCheckout(form: FormData) {
  const { employerId } = await requireEmployer();
  const { data, error } = await (
    await api()
  ).POST('/v1/employers/{employer_id}/billing/orders/{order_id}/resume', {
    params: { path: { employer_id: employerId, order_id: field(form, 'order_id') } },
  });
  if (!data) back('error', errorMessage(error));
  else stripeRedirect(data.checkout_url);
}
export async function cancelQuote(form: FormData) {
  const { employerId } = await requireEmployer();
  confirm(form);
  const { error, response } = await (
    await api()
  ).POST('/v1/employers/{employer_id}/billing/orders/{order_id}/cancel', {
    params: { path: { employer_id: employerId, order_id: field(form, 'order_id') } },
    body: { confirm: true },
  });
  if (!response.ok) back('error', errorMessage(error));
  back('notice', 'The unpaid quote has been cancelled.');
}
export async function refundOrder(form: FormData) {
  const { employerId } = await requireEmployer();
  confirm(form);
  const { error, response } = await (
    await api()
  ).POST('/v1/employers/{employer_id}/billing/orders/{order_id}/refund', {
    params: { path: { employer_id: employerId, order_id: field(form, 'order_id') } },
    body: { confirm: true },
  });
  if (!response.ok) back('error', errorMessage(error));
  back('notice', 'Refund requested. The order updates after Stripe confirms the outcome.');
}
