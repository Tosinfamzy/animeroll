// Pure profile-handle rules. No DB here so it can be unit-tested and reused by
// the API route and any client-side pre-validation.

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;
export const DISPLAY_NAME_MAX = 50;
export const BIO_MAX = 280;

const HANDLE_RE = /^[a-z0-9_]+$/;

// Route segments and obvious impostor names that must not become handles.
const RESERVED = new Set([
  'about',
  'admin',
  'animeroll',
  'api',
  'archive',
  'discover',
  'edit',
  'help',
  'list',
  'lists',
  'login',
  'logout',
  'me',
  'new',
  'profile',
  'root',
  'settings',
  'share',
  'shares',
  'signin',
  'sign-in',
  'signup',
  'sign-up',
  'stats',
  'support',
  'u',
  'www',
]);

export type HandleError = 'too_short' | 'too_long' | 'invalid_chars' | 'reserved';

export function normalizeHandle(input: string): string {
  return input.trim().toLowerCase();
}

export type HandleResult =
  | { ok: true; handle: string }
  | { ok: false; error: HandleError };

export function validateHandle(input: string): HandleResult {
  const handle = normalizeHandle(input);
  if (handle.length < HANDLE_MIN) return { ok: false, error: 'too_short' };
  if (handle.length > HANDLE_MAX) return { ok: false, error: 'too_long' };
  if (!HANDLE_RE.test(handle)) return { ok: false, error: 'invalid_chars' };
  if (RESERVED.has(handle)) return { ok: false, error: 'reserved' };
  return { ok: true, handle };
}

export const HANDLE_ERROR_MESSAGES: Record<HandleError, string> = {
  too_short: `Handle must be at least ${HANDLE_MIN.toString()} characters.`,
  too_long: `Handle must be at most ${HANDLE_MAX.toString()} characters.`,
  invalid_chars: 'Use only lowercase letters, numbers, and underscores.',
  reserved: 'That handle is reserved.',
};
