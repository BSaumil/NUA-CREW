import { useState } from 'react';
import { messageOf } from '@/api/client';
import { useMe } from '@/api/queries';
import {
  EMAIL_UNAVAILABLE,
  requestEmailVerification,
  type RecoveryOutcome,
} from '@/features/recovery';
import { Button, Card, Text } from '@/ui';

const SAID: Record<RecoveryOutcome, string> = {
  sent: 'We have emailed you a confirmation link. It works once and expires in 24 hours.',
  unavailable: EMAIL_UNAVAILABLE,
  already_verified: 'Your email address is already confirmed.',
};

/** Shown only when the address is unconfirmed AND this deployment can actually send email. */
export function EmailVerificationCard() {
  const me = useMe();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  if (!me.data || me.data.email_verified || !me.data.email_delivery) return null;

  const send = async () => {
    setBusy(true);
    try {
      setSaid(SAID[await requestEmailVerification()]);
    } catch (e) {
      setSaid(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <Text variant="label">Confirm your email address</Text>
      <Text variant="caption" muted>
        A confirmed address lets you recover your account if you forget your password.
      </Text>
      {said ? <Text accessibilityLiveRegion="polite">{said}</Text> : null}
      <Button
        title="Email me a confirmation link"
        variant="secondary"
        loading={busy}
        onPress={() => void send()}
      />
    </Card>
  );
}
