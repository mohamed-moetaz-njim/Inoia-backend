import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();

    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const responseBody = exception.getResponse();

      const messageObj: any = responseBody;

      message =
        typeof responseBody === 'object' &&
        responseBody !== null &&
        'message' in responseBody
          ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            messageObj.message
          : exception.message;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    } else if ((exception as any).code === 'P2002') {
      httpStatus = HttpStatus.CONFLICT;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const meta: any = (exception as any).meta;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const target = meta?.target;
      message = `Unique constraint failed on the ${Array.isArray(target) ? target.join(', ') : target}`;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const err = exception as any;

      // Safe logging for production
      if (process.env.NODE_ENV === 'production') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        this.logger.error(`Unexpected Error: ${err.name || 'Unknown'}`);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        this.logger.error(`Error: ${err.message}`, err.stack);
      }
    }

    const responseBody = {
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      message,
    };

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development' && exception instanceof Error) {
      Object.assign(responseBody, { stack: exception.stack });
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
