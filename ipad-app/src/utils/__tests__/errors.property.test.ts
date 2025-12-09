/**
 * Property-Based Tests for Error Handling
 * 
 * Tests correctness properties for error classification, localized messages,
 * and error logging functionality.
 */

import fc from 'fast-check';
import {
  ErrorType,
  AppError,
  classifyError,
  getLocalizedErrorMessage,
  isRecoverable,
  createAppError,
  logError,
  handleError
} from '../errors';
import { Language } from '../../types';

describe('Error Handling Property Tests', () => {
  /**
   * Feature: code-consistency-security-offline, Property 33: Localized error messages
   * Validates: Requirements 10.1
   */
  describe('Property 33: Localized error messages', () => {
    it('should return error messages in the requested language for all error types', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(ErrorType)),
          fc.constantFrom<Language>('ja', 'en'),
          (errorType, language) => {
            const message = getLocalizedErrorMessage(errorType, language);
            
            // Message should not be empty
            expect(message).toBeTruthy();
            expect(message.length).toBeGreaterThan(0);
            
            // Message should be a string
            expect(typeof message).toBe('string');
            
            // Message should not be the error type itself (should be translated)
            expect(message).not.toBe(errorType);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return consistent messages for the same error type and language', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(ErrorType)),
          fc.constantFrom<Language>('ja', 'en'),
          (errorType, language) => {
            const message1 = getLocalizedErrorMessage(errorType, language);
            const message2 = getLocalizedErrorMessage(errorType, language);
            
            // Same error type and language should always return same message
            expect(message1).toBe(message2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return different messages for different languages', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(ErrorType)),
          (errorType) => {
            const messageJa = getLocalizedErrorMessage(errorType, 'ja');
            const messageEn = getLocalizedErrorMessage(errorType, 'en');
            
            // Messages in different languages should be different
            expect(messageJa).not.toBe(messageEn);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create AppError with both language messages', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(ErrorType)),
          fc.string({ minLength: 1, maxLength: 100 }),
          (errorType, details) => {
            const appError = new AppError({
              type: errorType,
              message: getLocalizedErrorMessage(errorType, 'en', details),
              messageJa: getLocalizedErrorMessage(errorType, 'ja', details),
              messageEn: getLocalizedErrorMessage(errorType, 'en', details),
              recoverable: isRecoverable(errorType)
            });
            
            // Both language messages should be present
            expect(appError.messageJa).toBeTruthy();
            expect(appError.messageEn).toBeTruthy();
            
            // getLocalizedMessage should return the correct language
            expect(appError.getLocalizedMessage('ja')).toBe(appError.messageJa);
            expect(appError.getLocalizedMessage('en')).toBe(appError.messageEn);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 34: Error type classification
   * Validates: Requirements 10.2
   */
  describe('Property 34: Error type classification', () => {
    it('should classify network errors correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            { message: 'Network request failed', code: undefined },
            { message: 'Network Error', code: undefined },
            { message: 'Connection failed', code: 'ECONNABORTED' },
            { message: 'Host not found', code: 'ENOTFOUND' },
            { message: 'Network unreachable', code: 'ENETUNREACH' },
            { message: 'Connection timeout', code: 'ETIMEDOUT' }
          ),
          (errorData) => {
            const error: any = new Error(errorData.message);
            if (errorData.code) {
              error.code = errorData.code;
            }
            const errorType = classifyError(error);
            
            expect(errorType).toBe(ErrorType.NETWORK_ERROR);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should classify authentication errors correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(401, 403),
          (statusCode) => {
            const error = {
              response: {
                status: statusCode,
                data: { message: 'Unauthorized' }
              }
            };
            const errorType = classifyError(error);
            
            expect(errorType).toBe(ErrorType.AUTHENTICATION_ERROR);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should classify client errors correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 400, max: 499 }).filter(n => n !== 401 && n !== 403),
          (statusCode) => {
            const error = {
              response: {
                status: statusCode,
                data: { message: 'Client error' }
              }
            };
            const errorType = classifyError(error);
            
            expect(errorType).toBe(ErrorType.CLIENT_ERROR);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should classify server errors correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 500, max: 599 }),
          (statusCode) => {
            const error = {
              response: {
                status: statusCode,
                data: { message: 'Server error' }
              }
            };
            const errorType = classifyError(error);
            
            expect(errorType).toBe(ErrorType.SERVER_ERROR);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should classify validation errors correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'validation failed',
            'invalid input',
            'ValidationError'
          ),
          (errorMessage) => {
            const error = new Error(errorMessage);
            const errorType = classifyError(error);
            
            expect(errorType).toBe(ErrorType.VALIDATION_ERROR);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should classify encryption errors correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'encryption failed',
            'decryption failed',
            'cipher error'
          ),
          (errorMessage) => {
            const error = new Error(errorMessage);
            const errorType = classifyError(error);
            
            expect(errorType).toBe(ErrorType.ENCRYPTION_ERROR);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should classify cache errors correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'AsyncStorage error',
            'cache read failed',
            'storage error'
          ),
          (errorMessage) => {
            const error = new Error(errorMessage);
            const errorType = classifyError(error);
            
            expect(errorType).toBe(ErrorType.CACHE_ERROR);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should classify BLE errors correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Bluetooth connection failed',
            'BLE device not found',
            'device connection error',
            'device pairing failed'
          ),
          (errorMessage) => {
            const error = new Error(errorMessage);
            const errorType = classifyError(error);
            
            expect(errorType).toBe(ErrorType.BLE_ERROR);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve AppError type when classifying', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(ErrorType)),
          (errorType) => {
            const appError = new AppError({
              type: errorType,
              message: 'Test error',
              messageJa: 'テストエラー',
              messageEn: 'Test error',
              recoverable: true
            });
            
            const classified = classifyError(appError);
            
            // Should preserve the original error type
            expect(classified).toBe(errorType);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 35: Error logging
   * Validates: Requirements 10.5
   */
  describe('Property 35: Error logging', () => {
    // Capture console.error calls
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should log errors with context information', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (errorMessage, userId, screen, action) => {
            const error = new Error(errorMessage);
            
            logError(error, { userId, screen, action });
            
            // Should have called console.error in development
            if (__DEV__) {
              expect(consoleErrorSpy).toHaveBeenCalled();
              
              // Check that the log includes context
              const logCall = consoleErrorSpy.mock.calls[consoleErrorSpy.mock.calls.length - 1];
              const logData = logCall[1];
              
              expect(logData.context.userId).toBe(userId);
              expect(logData.context.screen).toBe(screen);
              expect(logData.context.action).toBe(action);
              expect(logData.context.timestamp).toBeInstanceOf(Date);
            }
            
            consoleErrorSpy.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should log AppError with type information', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(ErrorType)),
          fc.string({ minLength: 1, maxLength: 100 }),
          (errorType, errorMessage) => {
            const appError = new AppError({
              type: errorType,
              message: errorMessage,
              messageJa: 'エラー',
              messageEn: 'Error',
              recoverable: true
            });
            
            logError(appError);
            
            // Should have called console.error in development
            if (__DEV__) {
              expect(consoleErrorSpy).toHaveBeenCalled();
              
              // Check that the log includes error type
              const logCall = consoleErrorSpy.mock.calls[consoleErrorSpy.mock.calls.length - 1];
              const logData = logCall[1];
              
              expect(logData.type).toBe(errorType);
              expect(logData.message).toBe(errorMessage);
            }
            
            consoleErrorSpy.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include stack trace in error logs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (errorMessage) => {
            const error = new Error(errorMessage);
            
            logError(error);
            
            // Should have called console.error in development
            if (__DEV__) {
              expect(consoleErrorSpy).toHaveBeenCalled();
              
              // Check that the log includes stack trace
              const logCall = consoleErrorSpy.mock.calls[consoleErrorSpy.mock.calls.length - 1];
              const logData = logCall[1];
              
              expect(logData.stack).toBeTruthy();
            }
            
            consoleErrorSpy.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create unique error IDs for each log entry', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 10 }),
          (errorMessages) => {
            const errorIds = new Set<string>();
            
            for (const message of errorMessages) {
              const error = new Error(message);
              logError(error);
              
              if (__DEV__) {
                const logCall = consoleErrorSpy.mock.calls[consoleErrorSpy.mock.calls.length - 1];
                const logData = logCall[1];
                errorIds.add(logData.id);
              }
            }
            
            // All error IDs should be unique
            if (__DEV__) {
              expect(errorIds.size).toBe(errorMessages.length);
            }
            
            consoleErrorSpy.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Error Recovery', () => {
    it('should correctly identify recoverable errors', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(ErrorType)),
          (errorType) => {
            const recoverable = isRecoverable(errorType);
            
            // Check expected recoverability
            switch (errorType) {
              case ErrorType.NETWORK_ERROR:
              case ErrorType.SERVER_ERROR:
              case ErrorType.BLE_ERROR:
              case ErrorType.AUTHENTICATION_ERROR:
              case ErrorType.VALIDATION_ERROR:
              case ErrorType.CLIENT_ERROR:
                expect(recoverable).toBe(true);
                break;
              
              case ErrorType.ENCRYPTION_ERROR:
              case ErrorType.CACHE_ERROR:
              case ErrorType.UNKNOWN_ERROR:
                expect(recoverable).toBe(false);
                break;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create AppError with correct recoverability', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(ErrorType)),
          (errorType) => {
            const appError = new AppError({
              type: errorType,
              message: 'Test',
              messageJa: 'テスト',
              messageEn: 'Test',
              recoverable: isRecoverable(errorType)
            });
            
            expect(appError.recoverable).toBe(isRecoverable(errorType));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Error Creation', () => {
    it('should create AppError from any error with all required fields', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.uuid(),
          (errorMessage, userId) => {
            const error = new Error(errorMessage);
            const appError = createAppError(error, userId);
            
            // Should have all required fields
            expect(appError).toBeInstanceOf(AppError);
            expect(appError.type).toBeTruthy();
            expect(appError.message).toBeTruthy();
            expect(appError.messageJa).toBeTruthy();
            expect(appError.messageEn).toBeTruthy();
            expect(appError.userId).toBe(userId);
            expect(appError.timestamp).toBeInstanceOf(Date);
            expect(typeof appError.recoverable).toBe('boolean');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
