import type { Response } from "express";
import { makeError } from "../types/errors";

function getPgCode(error: unknown): string | undefined {
  const e = error as any;
  return e?.code || e?.cause?.code || e?.originalError?.code;
}

// Handle unique violation (23505) errors from Postgres
export function handleUniqueViolation(res: Response, error: unknown, message: string): boolean {
  const code = getPgCode(error);
  if (code === "23505") {
    res.status(409).json(makeError("CONFLICT_DUPLICATE", message));
    return true;
  }
  return false;
}

