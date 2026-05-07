/**
 * Typed wrapper around `fetch` that asserts the response type at the boundary.
 *
 * Why a helper: `res.json()` returns `Promise<any>`, which trips
 * `@typescript-eslint/no-unsafe-return` everywhere it's used. Centralising the
 * cast here keeps call sites readable and means we can swap in real schema
 * validation (Zod) later in one place.
 */
export async function jsonFetch<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status.toString()}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}
