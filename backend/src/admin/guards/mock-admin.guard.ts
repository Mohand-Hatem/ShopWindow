import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

export const ADMIN_AUTH_HEADER = 'x-admin-auth';
export const DEFAULT_ADMIN_SECRET = 'mock-secret';

@Injectable()
export class MockAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers[ADMIN_AUTH_HEADER];

    const expectedSecret = process.env.ADMIN_SECRET || DEFAULT_ADMIN_SECRET;

    if (!authHeader || authHeader !== expectedSecret) {
      throw new UnauthorizedException(
        'Invalid or missing admin authorization header (x-admin-auth)',
      );
    }

    return true;
  }
}
