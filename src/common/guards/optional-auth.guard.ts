import { ExecutionContext, Injectable } from '@nestjs/common';
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
}
