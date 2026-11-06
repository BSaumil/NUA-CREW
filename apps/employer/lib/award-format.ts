/** Display helpers for award figures. Money is integer cents; nothing here uses floating point. */

export function dollars(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  return `${sign}$${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Basis points of the permanent ordinary hourly rate: 15000 -> "150%", 12550 -> "125.5%". */
export function percent(bp: number): string {
  const whole = Math.trunc(bp / 100);
  const frac = bp % 100;
  return frac === 0 ? `${whole}%` : `${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}%`;
}

export function day(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
