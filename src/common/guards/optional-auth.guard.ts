import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // If no token is provided, proceed as guest (allow access)
    if (!authHeader) {
      return true;
    }

    // If token is provided, use standard JWT validation
    // This will throw 401 if the token is invalid
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: any) {
    // If no token provided, just return null user, don't throw error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const req = context.switchToHttp().getRequest();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return null;
    }
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return user;
  }
}
