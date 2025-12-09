/**
 * Error Handling Utilities
 * 
 * Provides comprehensive error classification, localized error messages,
 * and error logging with context for the VerbumCare application.
 */

import { Language } from '../types';

/**
 * Error types for classification
 */
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',           // No connectivity
  SERVER_ERROR = 'SERVER_ERROR',             // 5xx responses
  CLIENT_ERROR = 'CLIENT_ERROR',             // 4xx responses
  VALIDATION_ERROR = 'VALIDATION_ERROR',     // Data validation failed
  AUTHENTICATION_ERROR = 'AUTH_ERROR',       // Auth token invalid/expired
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',     // Encryption/decryption failed
  CACHE_ERROR = 'CACHE_ERROR',               // Cache read/write failed
  BLE_ERROR = 'BLE_ERROR',                   // BLE device connection failed
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'            // Unexpected error
}

/**
 * Application error with localized messages
 */
export class AppError extends Error {
  type: ErrorType;
  messageJa: string;
  messageEn: string;
  code?: string;
  details?: any;
  timestamp: Date;
  userId?: string;
  recoverable: boolean;

  constructor(params: {
    type: ErrorType;
    message: string;
    messageJa: string;
    messageEn: string;
    code?: string;
    details?: any;
    userId?: string;
    recoverable?: boolean;
  }) {
    super(params.message);
    this.name = 'AppError';
    this.type = params.type;
    this.messageJa = params.messageJa;
    this.messageEn = params.messageEn;
    this.code = params.code;
    this.details = params.details;
    this.timestamp = new Date();
    this.userId = params.userId;
    this.recoverable = params.recoverable ?? true;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Get localized message for the user's language
   */
  getLocalizedMessage(language: Language): string {
    switch (language) {
      case 'ja':
        return this.messageJa;
      case 'en':
        return this.messageEn;
      default:
        return this.messageJa; // Default to Japanese
    }
  }
}

/**
 * Error log entry for debugging
 */
export interface ErrorLog {
  errorId: string;
  type: ErrorType;
  message: string;
  stackTrace?: string;
  context: {
    userId?: string;
    screen?: string;
    action?: string;
    timestamp: Date;
  };
  deviceInfo: {
    platform: string;
    osVersion: string;
    appVersion: string;
  };
}

/**
 * Classify an error into an ErrorType
 */
export function classifyError(error: any): ErrorType {
  // Check if already an AppError
  if (error instanceof AppError) {
    return error.type;
  }

  const errorMessage = error.message?.toLowerCase() || '';

  // Network error codes (check first - most specific)
  if (
    error.code === 'ECONNABORTED' ||
    error.code === 'ENOTFOUND' ||
    error.code === 'ENETUNREACH' ||
    error.code === 'ETIMEDOUT' ||
    error.code === 'ECONNREFUSED' ||
    error.code === 'ECONNRESET'
  ) {
    return ErrorType.NETWORK_ERROR;
  }

  // HTTP status code based classification
  if (error.response?.status) {
    const status = error.response.status;
    
    if (status === 401 || status === 403) {
      return ErrorType.AUTHENTICATION_ERROR;
    }
    
    if (status >= 400 && status < 500) {
      return ErrorType.CLIENT_ERROR;
    }
    
    if (status >= 500) {
      return ErrorType.SERVER_ERROR;
    }
  }

  // Encryption errors (check before network errors to avoid false positives)
  if (
    errorMessage.includes('encrypt') ||
    errorMessage.includes('decrypt') ||
    errorMessage.includes('cipher')
  ) {
    return ErrorType.ENCRYPTION_ERROR;
  }

  // Cache errors (check before network errors)
  if (
    errorMessage.includes('asyncstorage') ||
    errorMessage.includes('cache') ||
    errorMessage.includes('storage')
  ) {
    return ErrorType.CACHE_ERROR;
  }

  // BLE errors (check before network errors)
  if (
    errorMessage.includes('bluetooth') ||
    errorMessage.includes('ble') ||
    errorMessage.includes('device connection') ||
    errorMessage.includes('device pairing')
  ) {
    return ErrorType.BLE_ERROR;
  }

  // Validation errors (check before network errors)
  if (
    errorMessage.includes('validation') ||
    errorMessage.includes('invalid') ||
    error.name === 'ValidationError'
  ) {
    return ErrorType.VALIDATION_ERROR;
  }

  // Network errors (check after more specific errors)
  if (
    errorMessage.includes('network request failed') ||
    errorMessage.includes('network error') ||
    (!error.response && (errorMessage.includes('failed') || errorMessage.includes('timeout')))
  ) {
    return ErrorType.NETWORK_ERROR;
  }

  // Default to unknown
  return ErrorType.UNKNOWN_ERROR;
}

/**
 * Get localized error message for an error type
 */
export function getLocalizedErrorMessage(
  errorType: ErrorType,
  language: Language,
  details?: string
): string {
  const messages: Record<ErrorType, Record<Language, string>> = {
    [ErrorType.NETWORK_ERROR]: {
      ja: 'ネットワーク接続がありません。キャッシュされたデータを使用しています。',
      en: 'No network connection. Using cached data.'
    },
    [ErrorType.SERVER_ERROR]: {
      ja: 'サーバーエラーが発生しました。しばらくしてから再試行してください。',
      en: 'Server error occurred. Please try again later.'
    },
    [ErrorType.CLIENT_ERROR]: {
      ja: 'リクエストエラーが発生しました。入力内容を確認してください。',
      en: 'Request error occurred. Please check your input.'
    },
    [ErrorType.VALIDATION_ERROR]: {
      ja: '入力データが無効です。必須項目を確認してください。',
      en: 'Invalid input data. Please check required fields.'
    },
    [ErrorType.AUTHENTICATION_ERROR]: {
      ja: '認証エラーが発生しました。再度ログインしてください。',
      en: 'Authentication error. Please log in again.'
    },
    [ErrorType.ENCRYPTION_ERROR]: {
      ja: 'データの暗号化/復号化に失敗しました。',
      en: 'Failed to encrypt/decrypt data.'
    },
    [ErrorType.CACHE_ERROR]: {
      ja: 'キャッシュの読み書きに失敗しました。',
      en: 'Failed to read/write cache.'
    },
    [ErrorType.BLE_ERROR]: {
      ja: 'Bluetoothデバイスの接続に失敗しました。',
      en: 'Failed to connect to Bluetooth device.'
    },
    [ErrorType.UNKNOWN_ERROR]: {
      ja: '予期しないエラーが発生しました。',
      en: 'An unexpected error occurred.'
    }
  };

  const message = messages[errorType]?.[language] || messages[ErrorType.UNKNOWN_ERROR][language];
  
  if (details) {
    return `${message} (${details})`;
  }
  
  return message;
}

/**
 * Check if an error type is recoverable
 */
export function isRecoverable(errorType: ErrorType): boolean {
  switch (errorType) {
    case ErrorType.NETWORK_ERROR:
    case ErrorType.SERVER_ERROR:
    case ErrorType.BLE_ERROR:
      return true; // Can retry or use cached data
    
    case ErrorType.AUTHENTICATION_ERROR:
      return true; // Can refresh token or re-login
    
    case ErrorType.VALIDATION_ERROR:
    case ErrorType.CLIENT_ERROR:
      return true; // User can correct input
    
    case ErrorType.ENCRYPTION_ERROR:
    case ErrorType.CACHE_ERROR:
      return false; // Requires clearing cache or re-authentication
    
    case ErrorType.UNKNOWN_ERROR:
      return false; // Unknown errors are not safely recoverable
    
    default:
      return false;
  }
}

/**
 * Create an AppError from any error
 */
export function createAppError(
  error: any,
  userId?: string,
  context?: { screen?: string; action?: string }
): AppError {
  const errorType = classifyError(error);
  const details = error.response?.data?.message || error.message || 'Unknown error';

  return new AppError({
    type: errorType,
    message: getLocalizedErrorMessage(errorType, 'en', details),
    messageJa: getLocalizedErrorMessage(errorType, 'ja', details),
    messageEn: getLocalizedErrorMessage(errorType, 'en', details),
    code: error.code || error.response?.status?.toString(),
    details: {
      originalError: error.message,
      response: error.response?.data,
      ...context
    },
    userId,
    recoverable: isRecoverable(errorType)
  });
}

/**
 * Log an error with context
 */
export function logError(
  error: Error | AppError,
  context?: {
    userId?: string;
    screen?: string;
    action?: string;
  }
): void {
  const errorLog: ErrorLog = {
    errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: error instanceof AppError ? error.type : classifyError(error),
    message: error.message,
    stackTrace: error.stack,
    context: {
      userId: context?.userId,
      screen: context?.screen,
      action: context?.action,
      timestamp: new Date()
    },
    deviceInfo: {
      platform: 'ios', // Could be dynamic based on Platform.OS
      osVersion: 'unknown', // Could be from Device.osVersion
      appVersion: 'unknown' // Could be from app.json
    }
  };

  // Log to console in development
  if (__DEV__) {
    console.error('[ErrorLog]', {
      id: errorLog.errorId,
      type: errorLog.type,
      message: errorLog.message,
      context: errorLog.context,
      stack: errorLog.stackTrace
    });
  }

  // In production, could send to error tracking service
  // TODO: Implement error tracking service integration
}

/**
 * Handle an error with appropriate recovery strategy
 */
export async function handleError(
  error: any,
  options?: {
    userId?: string;
    screen?: string;
    action?: string;
    onRetry?: () => Promise<any>;
    onFallback?: () => Promise<any>;
  }
): Promise<AppError> {
  const appError = createAppError(error, options?.userId, {
    screen: options?.screen,
    action: options?.action
  });

  // Log the error
  logError(appError, {
    userId: options?.userId,
    screen: options?.screen,
    action: options?.action
  });

  // Handle based on error type
  switch (appError.type) {
    case ErrorType.NETWORK_ERROR:
      // Try fallback to cached data if available
      if (options?.onFallback) {
        try {
          await options.onFallback();
        } catch (fallbackError) {
          console.error('Fallback failed:', fallbackError);
        }
      }
      break;

    case ErrorType.SERVER_ERROR:
      // Could implement retry logic here
      if (options?.onRetry) {
        // Don't auto-retry, let caller decide
        console.log('Server error - retry available');
      }
      break;

    case ErrorType.AUTHENTICATION_ERROR:
      // Token refresh should be handled by auth store
      console.log('Authentication error - token refresh needed');
      break;

    case ErrorType.CACHE_ERROR:
    case ErrorType.ENCRYPTION_ERROR:
      // These require clearing cache or re-authentication
      console.error('Critical error - cache/encryption failure');
      break;

    default:
      // Log unknown errors
      console.error('Unhandled error type:', appError.type);
  }

  return appError;
}
