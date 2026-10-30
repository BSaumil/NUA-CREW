export function Flash({
  error,
  notice,
}: {
  error?: string | undefined;
  notice?: string | undefined;
}) {
  if (error)
    return (
      <p role="alert" className="nua-alert nua-alert--error">
        {error}
      </p>
    );
  if (notice)
    return (
      <p role="status" className="nua-alert">
        {notice}
      </p>
    );
  return null;
}

export function Field({
  name,
  label,
  type = 'text',
  defaultValue,
  hint,
  required,
  autoComplete,
  min,
  max,
  minLength,
  step,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number | null;
  hint?: string;
  required?: boolean;
  autoComplete?: string;
  min?: number;
  max?: number;
  minLength?: number;
  step?: string;
}) {
  return (
    <div className="nua-field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ''}
        required={required}
        autoComplete={autoComplete}
        min={min}
        max={max}
        minLength={minLength}
        step={step}
        aria-describedby={hint ? `${name}-hint` : undefined}
      />
      {hint ? (
        <span id={`${name}-hint`} className="nua-hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

type SP = Promise<Record<string, string | string[] | undefined>>;
export async function flashFrom(sp: SP) {
  const p = await sp;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return { error: one(p.error), notice: one(p.notice), p };
}
