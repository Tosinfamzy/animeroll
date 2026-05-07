import { NextResponse } from 'next/server';
import { z, type ZodError } from 'zod';

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
  headers?: HeadersInit,
): NextResponse {
  return NextResponse.json({ error: { code, message, details } }, { status, headers });
}

export function validationError(zerr: ZodError): NextResponse {
  return errorResponse(422, 'invalid_input', 'Validation failed', z.treeifyError(zerr));
}
