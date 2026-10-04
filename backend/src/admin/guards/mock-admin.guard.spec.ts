import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import {
  MockAdminGuard,
  ADMIN_AUTH_HEADER,
  DEFAULT_ADMIN_SECRET,
} from './mock-admin.guard';

describe('MockAdminGuard', () => {
  let guard: MockAdminGuard;
  let mockRequest: any;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    guard = new MockAdminGuard();
    mockRequest = {
      headers: {},
    };
    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;
  });

  it('should allow access when x-admin-auth header matches secret', () => {
    mockRequest.headers[ADMIN_AUTH_HEADER] = DEFAULT_ADMIN_SECRET;
    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should throw UnauthorizedException when header is missing', () => {
    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when header value is incorrect', () => {
    mockRequest.headers[ADMIN_AUTH_HEADER] = 'wrong-password';
    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
  });
});
