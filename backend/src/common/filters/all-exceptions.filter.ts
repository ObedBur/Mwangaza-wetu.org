import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const parserStatus =
      exception && typeof exception === 'object' && 'status' in exception
        ? Number((exception as { status?: unknown }).status)
        : undefined;
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : parserStatus === HttpStatus.PAYLOAD_TOO_LARGE
        ? HttpStatus.PAYLOAD_TOO_LARGE
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let userMessage = "Une erreur inattendue est survenue.";
    let rawErrors: string[] = [];

    if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
      userMessage = 'Le corps de la requête dépasse la taille maximale autorisée.';
      rawErrors = [userMessage];
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const res = exceptionResponse as Record<string, any>;
      if (Array.isArray(res.message)) {
        rawErrors = res.message.map((m) => String(m));
        if (status === HttpStatus.BAD_REQUEST) {
          userMessage = 'Les informations fournies sont invalides ou incomplètes.';
        } else {
          userMessage = rawErrors[0] || userMessage;
        }
      } else if (typeof res.message === 'string') {
        userMessage = res.message;
        rawErrors = [res.message];
      }
    } else if (typeof exceptionResponse === 'string') {
      userMessage = exceptionResponse;
      rawErrors = [exceptionResponse];
    } else if (exception instanceof Error) {
      userMessage =
        status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Une erreur interne est survenue.'
          : exception.message;
    }

    // Journalisation ciblée dans les logs serveur (Render / terminal)
    const logPrefix = `[${request.method}] ${request.url} - Status: ${status}`;
    if (status >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`${logPrefix} - Erreur interne: ${userMessage}`, stack);
    } else if (status === HttpStatus.BAD_REQUEST) {
      this.logger.warn(
        `${logPrefix} - Validation échouée: ${JSON.stringify(rawErrors.length > 0 ? rawErrors : userMessage)}`,
      );
    } else {
      this.logger.warn(`${logPrefix} - ${userMessage}`);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: userMessage,
      errors: rawErrors.length > 0 ? rawErrors : undefined,
    });
  }
}
