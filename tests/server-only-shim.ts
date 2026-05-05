// Empty shim. The real `server-only` package throws when imported from a
// client bundle; under Vitest we run on Node and want it to be a no-op so
// pure-logic modules that mark themselves server-only remain testable.
export {};
