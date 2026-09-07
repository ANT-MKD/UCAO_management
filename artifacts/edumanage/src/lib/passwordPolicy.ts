export const PASSWORD_MIN_LENGTH = 6;

export function isPasswordValid(password: string): boolean {
  return password.trim().length >= PASSWORD_MIN_LENGTH;
}

export const PASSWORD_HINT = `Au moins ${PASSWORD_MIN_LENGTH} caractères`;
