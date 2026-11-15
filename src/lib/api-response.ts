import type { FieldErrors } from "@/lib/action-result";

interface ErrorResponseOptions {
  /** Per-field messages, for a route whose caller shows them on its form. */
  fieldErrors?: FieldErrors;
  headers?: HeadersInit;
}

/** An API route's failure reply in the `{ success, data, error }` shape. */
export function errorResponse(
  error: string,
  status: number,
  { fieldErrors, headers }: ErrorResponseOptions = {},
): Response {
  return Response.json(
    { success: false, data: null, error, ...(fieldErrors && { fieldErrors }) },
    { status, headers },
  );
}
