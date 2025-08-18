import {
  createSuccessResponse,
  createErrorResponse,
} from '../../../src/utils/response';

describe('ResponseUtil', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  it('should create a success response with data and metadata', () => {
    const data = { elevatorId: '123' };
    const requestId = 'req-123';
    const message = 'Success';
    const metadata = { operation: 'call' };

    const response = createSuccessResponse(data, requestId, message, metadata);

    expect(response).toEqual({
      success: true,
      data,
      requestId,
      message,
      metadata: {
        timestamp: expect.any(String),
        operation: 'call',
      },
    });
  });

  it('should create an error response with details in development', () => {
    const code = 'VALIDATION_ERROR';
    const message = 'Invalid floor';
    const requestId = 'req-123';
    const details = { field: 'fromFloor' };

    const response = createErrorResponse(code, message, requestId, details);

    expect(response).toEqual({
      success: false,
      error: {
        code,
        message,
        requestId,
        details,
      },
      metadata: {
        timestamp: expect.any(String),
      },
    });
  });

  it('should exclude error details in production', () => {
    process.env.NODE_ENV = 'production';
    const code = 'VALIDATION_ERROR';
    const message = 'Invalid floor';
    const requestId = 'req-123';
    const details = { field: 'fromFloor' };

    const response = createErrorResponse(code, message, requestId, details);

    expect(response.error).not.toHaveProperty('details');
  });
});
