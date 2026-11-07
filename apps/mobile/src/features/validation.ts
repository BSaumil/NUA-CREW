export const MIN_PASSWORD = 12;

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export function emailError(v: string): string | null {
  if (!v.trim()) return 'Enter your email';
  return isEmail(v) ? null : 'Enter a valid email address';
}

export function passwordError(v: string, forNew = false): string | null {
  if (!v) return 'Enter your password';
  if (forNew && v.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters`;
  return null;
}

export const nameError = (v: string) => (v.trim() ? null : 'Enter your name');

/** A first venue is optional at sign-up, but a partly filled one is refused with a reason. */
export function venueError(v: { suburb: string; state: string; postcode: string }): string | null {
  if (!v.suburb.trim() && !v.state && !v.postcode.trim()) return null;
  if (!v.suburb.trim()) return 'Enter the venue suburb';
  if (!v.state) return 'Choose the venue state or territory';
  if (!/^\d{4}$/.test(v.postcode.trim())) return 'Enter a four-digit postcode';
  return null;
}
