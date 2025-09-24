import { describe, it, expect } from 'vitest';
import { handleUniqueViolation } from './dbErrors';

describe('handleUniqueViolation', () => {
	it('should return a unique violation message for code 23505', () => {
		const errorCode = {code: '23505'}; // Postgres unique violation code
		const expectedMessage = 'Unique constraint violated';
		const resp = {
			status: function(code: number) { this._status = code; return this; },
			json: function(data: any) { this._json = data; return this; },
			_status: undefined,
			_json: undefined
		} as any;

		expect(handleUniqueViolation(resp, errorCode, expectedMessage)).toBe(true);
	});
	
});