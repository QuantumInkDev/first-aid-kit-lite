import { describe, it, expect } from 'vitest';
import {
  IdSchema,
  NonEmptyStringSchema,
  SafeStringSchema,
  SystemInfoSchema,
  ScriptDefinitionSchema,
  ExecuteScriptRequestSchema,
  AppSettingsSchema,
  ProtocolUrlSchema,
  sanitizeInput,
  validateAndSanitize,
} from '@shared/validation/schemas';

describe('Validation Schemas', () => {
  describe('IdSchema', () => {
    it('should accept valid UUID', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(() => IdSchema.parse(validUuid)).not.toThrow();
    });

    it('should reject invalid UUID', () => {
      expect(() => IdSchema.parse('not-a-uuid')).toThrow();
      expect(() => IdSchema.parse('')).toThrow();
      expect(() => IdSchema.parse('123')).toThrow();
    });
  });

  describe('NonEmptyStringSchema', () => {
    it('should accept non-empty strings', () => {
      expect(() => NonEmptyStringSchema.parse('hello')).not.toThrow();
      expect(() => NonEmptyStringSchema.parse('a')).not.toThrow();
    });

    it('should reject empty strings', () => {
      expect(() => NonEmptyStringSchema.parse('')).toThrow();
    });

    it('should reject strings over 10000 characters', () => {
      const longString = 'a'.repeat(10001);
      expect(() => NonEmptyStringSchema.parse(longString)).toThrow();
    });
  });

  describe('SafeStringSchema', () => {
    it('should accept safe alphanumeric strings', () => {
      expect(() => SafeStringSchema.parse('hello world')).not.toThrow();
      expect(() => SafeStringSchema.parse('test-123_value')).not.toThrow();
    });

    it('should accept common punctuation', () => {
      expect(() => SafeStringSchema.parse('Hello, World!')).not.toThrow();
      expect(() => SafeStringSchema.parse("It's working")).not.toThrow();
    });
  });

  describe('SystemInfoSchema', () => {
    it('should accept valid Windows system info', () => {
      const validInfo = {
        platform: 'win32',
        version: '10.0.22631',
        arch: 'x64',
        powershellVersion: '5.1',
        isElevated: false,
      };
      expect(() => SystemInfoSchema.parse(validInfo)).not.toThrow();
    });

    it('should reject invalid platform', () => {
      const invalidInfo = {
        platform: 'windows', // should be win32
        version: '10.0',
        arch: 'x64',
        powershellVersion: '5.1',
        isElevated: false,
      };
      expect(() => SystemInfoSchema.parse(invalidInfo)).toThrow();
    });

    it('should reject invalid architecture', () => {
      const invalidInfo = {
        platform: 'win32',
        version: '10.0',
        arch: 'arm', // should be arm64
        powershellVersion: '5.1',
        isElevated: false,
      };
      expect(() => SystemInfoSchema.parse(invalidInfo)).toThrow();
    });
  });

  describe('ExecuteScriptRequestSchema', () => {
    it('should accept valid script execution request', () => {
      const validRequest = {
        scriptId: 'clear-temp',
        parameters: { path: 'C:/temp' },
      };
      expect(() => ExecuteScriptRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('should accept request without parameters', () => {
      const validRequest = {
        scriptId: 'flush-dns',
      };
      expect(() => ExecuteScriptRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('should reject invalid script ID format', () => {
      const invalidRequest = {
        scriptId: 'invalid script id!', // contains invalid characters
      };
      expect(() => ExecuteScriptRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject parameters with invalid keys', () => {
      const invalidRequest = {
        scriptId: 'clear-temp',
        parameters: { 'invalid-key!': 'value' },
      };
      expect(() => ExecuteScriptRequestSchema.parse(invalidRequest)).toThrow();
    });
  });

  describe('AppSettingsSchema', () => {
    it('should accept valid settings', () => {
      const validSettings = {
        confirmationRequired: true,
        notificationLevel: 'all',
        logRetentionDays: 30,
        theme: 'system',
        maxConcurrentExecutions: 3,
        scriptTimeout: 300000,
        enableDetailedLogging: true,
      };
      expect(() => AppSettingsSchema.parse(validSettings)).not.toThrow();
    });

    it('should reject invalid notification level', () => {
      const invalidSettings = {
        confirmationRequired: true,
        notificationLevel: 'sometimes', // invalid
        logRetentionDays: 30,
        theme: 'system',
        maxConcurrentExecutions: 3,
        scriptTimeout: 300000,
        enableDetailedLogging: true,
      };
      expect(() => AppSettingsSchema.parse(invalidSettings)).toThrow();
    });

    it('should reject log retention over 365 days', () => {
      const invalidSettings = {
        confirmationRequired: true,
        notificationLevel: 'all',
        logRetentionDays: 400, // too high
        theme: 'system',
        maxConcurrentExecutions: 3,
        scriptTimeout: 300000,
        enableDetailedLogging: true,
      };
      expect(() => AppSettingsSchema.parse(invalidSettings)).toThrow();
    });

    it('should reject script timeout under 5 seconds', () => {
      const invalidSettings = {
        confirmationRequired: true,
        notificationLevel: 'all',
        logRetentionDays: 30,
        theme: 'system',
        maxConcurrentExecutions: 3,
        scriptTimeout: 1000, // too low (min is 5000)
        enableDetailedLogging: true,
      };
      expect(() => AppSettingsSchema.parse(invalidSettings)).toThrow();
    });
  });

  describe('ProtocolUrlSchema', () => {
    it('should accept valid first-aid-kit:// URLs', () => {
      const validUrl = 'first-aid-kit://run/clear-temp';
      expect(() => ProtocolUrlSchema.parse(validUrl)).not.toThrow();
    });

    it('should accept valid fak:// URLs', () => {
      const validUrl = 'fak://run/flush-dns';
      expect(() => ProtocolUrlSchema.parse(validUrl)).not.toThrow();
    });

    it('should reject http:// URLs', () => {
      const invalidUrl = 'http://example.com/run/clear-temp';
      expect(() => ProtocolUrlSchema.parse(invalidUrl)).toThrow();
    });

    it('should reject invalid URLs', () => {
      expect(() => ProtocolUrlSchema.parse('not-a-url')).toThrow();
    });
  });
});

describe('Validation Utilities', () => {
  describe('sanitizeInput', () => {
    it('should return valid data', () => {
      const result = sanitizeInput(NonEmptyStringSchema, 'hello');
      expect(result).toBe('hello');
    });

    it('should throw on invalid data', () => {
      expect(() => sanitizeInput(NonEmptyStringSchema, '')).toThrow();
    });
  });

  describe('validateAndSanitize', () => {
    it('should return success object for valid data', () => {
      const result = validateAndSanitize(NonEmptyStringSchema, 'hello');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('hello');
      }
    });

    it('should return error object for invalid data', () => {
      const result = validateAndSanitize(NonEmptyStringSchema, '');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }
    });

    it('should include context in error message', () => {
      const result = validateAndSanitize(NonEmptyStringSchema, '', 'Test context');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Test context');
      }
    });
  });
});
