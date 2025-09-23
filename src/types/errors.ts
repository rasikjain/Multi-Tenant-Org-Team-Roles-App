export type ApiErrorShape = {
  error: string;
  code: string;
  details?: unknown;
};

// Standardized error response
export function makeError(code: string, message: string, details?: unknown): ApiErrorShape {
  return { error: message, code, details };
}

