import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // In certain situations `httpAdapter` might not be available in the
    // constructor method, thus we should resolve it here.
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
        const response = exception.getResponse();
        if (typeof response === 'object' && response !== null && 'message' in response) {
            message = (response as any).message;
        } else if (typeof response === 'string') {
            message = response;
        }
    } else {
        // Log unknown errors
        this.logger.error(exception);
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
