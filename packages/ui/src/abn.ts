/**
 * ABN shape check, mirroring services/api/app/abn.py. A well-formed number is NOT verification of
 * the business: the organisation stays unverified until an admin reviews it.
 */
const WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

export const normaliseAbn = (value: string): string => value.replace(/\D/g, '');

export function isValidAbn(value: string): boolean {
  const digits = normaliseAbn(value);
  if (digits.length !== 11) return false;
  const nums = [...digits].map(Number);
  nums[0] = (nums[0] ?? 0) - 1;
  return nums.reduce((sum, n, i) => sum + n * (WEIGHTS[i] ?? 0), 0) % 89 === 0;
}

/** Message for a form, or null when the ABN is well formed. */
export function abnError(value: string): string | null {
  if (!value.trim()) return 'Enter your ABN';
  if (normaliseAbn(value).length !== 11) return 'An ABN has 11 digits';
  return isValidAbn(value) ? null : 'That ABN does not look right. Check the digits and try again.';
}
