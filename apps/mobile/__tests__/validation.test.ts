import { emailError, nameError, passwordError } from '../src/features/validation';

it('validates sign-in and sign-up fields', () => {
  expect(emailError('')).toBe('Enter your email');
  expect(emailError('nope')).toBe('Enter a valid email address');
  expect(emailError(' a@b.co ')).toBeNull();
  expect(passwordError('')).toBe('Enter your password');
  expect(passwordError('short')).toBeNull(); // sign-in accepts whatever the account has
  expect(passwordError('short', true)).toBe('Use at least 12 characters');
  expect(passwordError('long-enough-pass', true)).toBeNull();
  expect(nameError('  ')).toBe('Enter your name');
});
