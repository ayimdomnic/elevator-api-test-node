import { v4 as uuidv4 } from 'uuid';

interface SuccessResponse<T> {
  success: true;
  data: T;
  requestId: string;
  message?: string;
  metadata?: {
    timestamp: string;
    [key: string]: unknown;
  };
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
  metadata?: {
    timestamp: string;
    [key: string]: unknown;
  };
}

interface ResponseMetadata {
  [key: string]: unknown;
  timestamp?: string;
}

export class ResponseUtil {
  static createSuccessResponse<T>(
    data: T,
    requestId: string = uuidv4(),
    message?: string,
    metadata: ResponseMetadata = {}
  ): SuccessResponse<T> {
    return {
      success: true,
      data,
      requestId,
      message,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    };
  }

  static createErrorResponse(
    code: string,
    message: string,
    requestId: string = uuidv4(),
    details?: unknown
  ): ErrorResponse {
    const response: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        requestId,
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    };

    if (details && (process.env.NODE_ENV === 'development' || details)) {
      response.error.details = details;
    }

    return response;
  }
}

export const createSuccessResponse = ResponseUtil.createSuccessResponse;
export const createErrorResponse = ResponseUtil.createErrorResponse;
export type { SuccessResponse, ErrorResponse, ResponseMetadata };
