'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

type SetupStep = { title: string; description: string; content: ReactNode };
function ContinueButton({ final, label }: { final: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="nua-button" type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? 'Creating your account…' : final ? label : 'Continue'}
    </button>
  );
}

/** Fields stay mounted in memory when going back. Inactive steps cannot block intermediate
 * validation; all fields are enabled for the final, original server action. No browser storage. */
export function GuidedSetup({
  steps,
  action,
  submitLabel,
}: {
  steps: SetupStep[];
  action: (data: FormData) => void | Promise<void>;
  submitLabel: string;
}) {
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const previous = useRef(0);
  const final = step === steps.length - 1;
  useEffect(() => {
    if (previous.current !== step) heading.current?.focus();
    previous.current = step;
  }, [step]);
  return (
    <form
      action={action}
      className="nua-card nua-stack"
      onSubmit={(event) => {
        if (!final) {
          event.preventDefault();
          if (event.currentTarget.reportValidity()) setStep((current) => current + 1);
        }
      }}
      onInvalidCapture={(event) => {
        const fieldset = (event.target as HTMLElement).closest<HTMLFieldSetElement>(
          'fieldset[data-setup-step]',
        );
        if (fieldset) setStep(Number(fieldset.dataset.setupStep));
      }}
    >
      <ol className="nua-setup-progress" aria-label="Account setup progress">
        {steps.map((item, index) => (
          <li key={item.title} aria-current={index === step ? 'step' : undefined}>
            <span aria-hidden="true">{index < step ? '✓' : index + 1}</span>
            {item.title}
          </li>
        ))}
      </ol>
      <div>
        <p className="nua-hint" role="status">
          Step {step + 1} of {steps.length}
        </p>
        <h2 ref={heading} tabIndex={-1}>
          {steps[step]?.title}
        </h2>
        <p className="nua-muted">{steps[step]?.description}</p>
      </div>
      {steps.map((item, index) => (
        <fieldset
          key={item.title}
          data-setup-step={index}
          hidden={index !== step}
          disabled={!final && index !== step}
          className="nua-setup-fields"
        >
          <legend className="nua-sr-only">{item.title}</legend>
          {item.content}
        </fieldset>
      ))}
      <div className="nua-row">
        {step > 0 ? (
          <button
            type="button"
            className="nua-button nua-button--secondary"
            onClick={() => setStep((current) => current - 1)}
          >
            Back
          </button>
        ) : null}
        <ContinueButton final={final} label={submitLabel} />
      </div>
      <p className="nua-hint">
        Your answers stay on this page until you create your account. Nothing is saved if you leave
        or refresh.
      </p>
    </form>
  );
}
