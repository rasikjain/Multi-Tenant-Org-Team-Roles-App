import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authMiddleware, orgScopeFromParam, requireOrgParamMatch } from './auth';
import { db } from '../db/client';
import { makeError } from '../types/errors';

// Mock the database
vi.mock('../db/client', () => ({
  db: {
    select: vi.fn(),
  }
}));

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      header: vi.fn(),
      params: {}
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  describe('authMiddleware', () => {
    it('should set caller userId when x-user-id header is present', () => {
      const userId = 'test-user-123';
      (mockReq.header as any).mockReturnValue(userId);

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq).toHaveProperty('caller.userId', userId);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 when x-user-id header is missing', () => {
      (mockReq.header as any).mockReturnValue(undefined);

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        makeError("UNAUTHENTICATED", "Missing x-user-id header")
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('orgScopeFromParam', () => {
    it('should set caller orgId when user has membership', async () => {
      mockReq.caller = { userId: 'test-user-123' };
      const mockOrgId = 'test-org-123';
      const mockRows = [{ orgId: mockOrgId }];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockRows)
      });

      await orgScopeFromParam(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.caller).toHaveProperty('orgId', mockOrgId);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 when caller is not set', async () => {
      await orgScopeFromParam(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        makeError("UNAUTHENTICATED", "Missing caller")
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when user has no memberships', async () => {
      mockReq.caller = { userId: 'test-user-123' };
      
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([])
      });

      await orgScopeFromParam(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        makeError("FORBIDDEN", "Not a member of this organization")
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireOrgParamMatch', () => {
    it('should pass when orgId param matches caller orgId', () => {
      const orgId = 'test-org-123';
      mockReq.params = { orgId };
      mockReq.caller = { orgId };

      requireOrgParamMatch(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should pass when no orgId param is present', () => {
      mockReq.caller = { orgId: 'test-org-123' };

      requireOrgParamMatch(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 when orgIds do not match', () => {
      mockReq.params = { orgId: 'org-1' };
      mockReq.caller = { orgId: 'org-2' };

      requireOrgParamMatch(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        makeError("FORBIDDEN", "Cross-org access denied")
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when caller orgId is not resolved', () => {
      mockReq.params = { orgId: 'org-1' };
      mockReq.caller = {};

      requireOrgParamMatch(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        makeError("FORBIDDEN", "Organization not resolved for caller")
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});