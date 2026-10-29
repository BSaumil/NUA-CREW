import { useState } from 'react';
import { View } from 'react-native';
import { messageOf } from '@/api/client';
import { useAssessPay, useAwards, useCoverageGuidance, type PayAssessmentOut } from '@/api/pay';
import {
  AWARD_LABEL,
  buildAssessment,
  dollars,
  type CheckForm,
  type PayResult,
} from '@/features/pay-check';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { Button, Chip, Field, Row, Text } from './primitives';
import { PayVerdictCard } from './pay';

export type CheckState = {
  instrument: string;
  classification: string | null;
  coverageOk: boolean;
  classOk: boolean;
};
export const emptyCheck: CheckState = {
  instrument: '',
  classification: null,
  coverageOk: false,
  classOk: false,
};

export function checkKey(c: CheckState, rate: string, jobType: string) {
  return [c.instrument, c.classification, c.coverageOk, c.classOk, rate.trim(), jobType].join('|');
}

/** Employer picks the award and classification; the server checks the rate. Titles never decide. */
export function PayCheckPanel({
  roleCode,
  state,
  jobType,
  rate,
  onRate,
  max,
  onMax,
  value,
  onChange,
  assessment,
  onAssessment,
  stale,
  acknowledged,
  onAcknowledge,
}: {
  roleCode: string;
  state: string;
  jobType: string;
  rate: string;
  onRate: (v: string) => void;
  max: string;
  onMax: (v: string) => void;
  value: CheckState;
  onChange: (v: CheckState) => void;
  assessment: PayAssessmentOut | null;
  onAssessment: (a: PayAssessmentOut, key: string) => void;
  stale: boolean;
  acknowledged: boolean;
  onAcknowledge: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  const awards = useAwards();
  const guidance = useCoverageGuidance(roleCode);
  const assess = useAssessPay();
  const [error, setError] = useState<string | null>(null);
  const award = awards.data?.find((a) => a.code === value.instrument);
  const suggested = new Set((guidance.data?.suggestions ?? []).map((s) => s.instrument));
  const leads = new Set((guidance.data?.suggestions ?? []).flatMap((s) => s.classification_leads));
  const set = (patch: Partial<CheckState>) => onChange({ ...value, ...patch });

  const run = async () => {
    setError(null);
    const form: CheckForm = {
      state,
      roleCode,
      instrument: value.instrument || 'unknown',
      coverageConfirmed: value.coverageOk,
      classification: value.classification,
      classificationConfirmed: value.classOk,
      jobType,
      hourlyRate: rate,
    };
    const built = buildAssessment(form);
    if (!built.body) return setError(built.error ?? 'Check the details.');
    try {
      const out = await assess.mutateAsync(built.body);
      onAssessment(out, checkKey(value, rate, jobType));
    } catch (e) {
      setError(messageOf(e));
    }
  };

  const result: PayResult | null = assessment && !stale ? assessment.result : null;
  return (
    <View style={{ gap: space(1.5) }}>
      <Text variant="heading" accessibilityRole="header">
        Which award covers this work?
      </Text>
      <Text variant="caption" muted>
        {guidance.data?.note ?? 'A job title never decides pay.'}
      </Text>
      <Row>
        {(awards.data ?? []).map((a) => (
          <Chip
            key={a.code}
            label={`${AWARD_LABEL[a.code] ?? a.title}${suggested.has(a.code) ? ' · often used' : ''}`}
            selected={value.instrument === a.code}
            onPress={() => set({ instrument: a.code, classification: null, classOk: false })}
          />
        ))}
        <Chip
          label="Enterprise agreement / not sure"
          selected={value.instrument === 'unknown'}
          onPress={() => set({ instrument: 'unknown', classification: null, classOk: false })}
        />
      </Row>
      {award ? (
        <>
          <Chip
            label="This award covers my business and this work"
            selected={value.coverageOk}
            onPress={() => set({ coverageOk: !value.coverageOk })}
            accessibilityHint="Check with the Fair Work Ombudsman if unsure. Don’t confirm on a guess."
          />
          <Text variant="label">Classification that matches the actual duties</Text>
          {award.classifications.map((c) => (
            <Chip
              key={c.code}
              label={`${c.label} · ${dollars(c.hourly_minor)}/h${leads.has(c.code) ? ' · listed for this role' : ''}`}
              selected={value.classification === c.code}
              onPress={() => set({ classification: c.code })}
            />
          ))}
          {value.classification ? (
            <Text variant="caption" muted>
              {award.classifications.find((c) => c.code === value.classification)?.description}
            </Text>
          ) : null}
          <Chip
            label="I’ve matched this to the real duties, skills and training"
            selected={value.classOk}
            onPress={() => set({ classOk: !value.classOk })}
          />
        </>
      ) : value.instrument === 'unknown' ? (
        <Text muted>
          We can’t confirm a minimum without a known award. Check the pay and we’ll flag it for
          review.
        </Text>
      ) : null}
      <Field
        label="Hourly rate (AUD, before super)"
        value={rate}
        onChangeText={onRate}
        keyboardType="decimal-pad"
      />
      <Field
        label="Top of range (optional)"
        value={max}
        onChangeText={onMax}
        keyboardType="decimal-pad"
      />
      <Button
        title={assessment ? 'Check this pay again' : 'Check this pay'}
        variant="secondary"
        loading={assess.isPending}
        onPress={() => void run()}
        disabled={!value.instrument}
      />
      {error ? (
        <Text accessibilityRole="alert" color={colors.danger}>
          {error}
        </Text>
      ) : null}
      {assessment && stale ? (
        <Text accessibilityRole="alert" muted>
          The details changed after the last check. Check the pay again.
        </Text>
      ) : null}
      {result ? <PayVerdictCard result={result} /> : null}
      {result?.needs_acknowledgement ? (
        <Chip
          label="I’ve reviewed the award coverage and classification myself"
          selected={acknowledged}
          onPress={() => onAcknowledge(!acknowledged)}
          accessibilityHint="We record this. You can’t publish below an award minimum."
        />
      ) : null}
    </View>
  );
}
