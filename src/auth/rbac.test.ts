import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrgPermissions, ensureOrgManage, ensureTeamManage, ensureReadInOrg } from './rbac';
import { db } from '../db/client';

// Mock the database client
vi.mock('../db/client', () => ({
  db: {
    select: vi.fn(),
  }
}));

describe('RBAC Tests', () => {
  const testCaller = {
    userId: 'user1',
    orgId: 'org1'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrgPermissions', () => {
    it('should aggregate permissions correctly', async () => {
      // Mock DB response with multiple roles
      const mockRows = [
        { canOrgManage: true, canTeamManage: false, canTeamWrite: false, canReadAll: false },
        { canOrgManage: false, canTeamManage: true, canTeamWrite: true, canReadAll: true }
      ];

      // Setup mock implementation
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(mockRows);

      (db.select as any).mockReturnValue({
        from: mockFrom,
        innerJoin: mockInnerJoin,
        where: mockWhere
      });

      const result = await getOrgPermissions(testCaller);

      expect(result).toEqual({
        canOrgManage: true,
        canTeamManage: true,
        canTeamWrite: true,
        canReadAll: true
      });
    });
  });

  describe('ensureOrgManage', () => {
    it('should throw error if user lacks org management permission', async () => {
      // Mock permissions without org manage rights
      const mockRows = [{
        canOrgManage: false,
        canTeamManage: true,
        canTeamWrite: true,
        canReadAll: true
      }];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockRows)
      });

      await expect(ensureOrgManage(testCaller))
        .rejects.toThrow('FORBIDDEN_ORG_MANAGE');
    });
  });

  describe('ensureTeamManage', () => {
    it('should pass if user has org manage permission', async () => {
      const mockRows = [{
        canOrgManage: true,
        canTeamManage: false,
        canTeamWrite: false,
        canReadAll: false
      }];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockRows)
      });

      await expect(ensureTeamManage(testCaller, 'team1'))
        .resolves.not.toThrow();
    });
  });

  describe('ensureReadInOrg', () => {
    it('should throw error if user has no read permissions', async () => {
      const mockRows = [{
        canOrgManage: false,
        canTeamManage: false,
        canTeamWrite: false,
        canReadAll: false
      }];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockRows)
      });

      await expect(ensureReadInOrg(testCaller))
        .rejects.toThrow('FORBIDDEN_READ');
    });
  });
});