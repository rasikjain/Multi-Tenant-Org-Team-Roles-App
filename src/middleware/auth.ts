import type { Request, Response, NextFunction } from "express";
import { makeError } from "../types/errors";

// Demo header-based auth. In real apps use JWT.
// Expect headers: x-user-id, x-org-id
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  let userId = req.header("x-user-id");
  let orgId = req.header("x-org-id");
  console.log(userId)
  
  //userId = 'alfa1'
  //orgId = 'a3adaa7f-1993-4722-8d6b-e94741922990'

  if (!userId || !orgId) {
    return res.status(401).json(makeError("UNAUTHENTICATED", "Missing x-user-id or x-org-id headers"));
  }
  
  

  (req as any).caller = { userId, orgId };
  console.log('alfa123')
  next();
}

export type CallerReq = Request & { caller: { userId: string; orgId: string } };

