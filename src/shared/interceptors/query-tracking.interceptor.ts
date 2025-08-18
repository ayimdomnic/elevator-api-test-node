
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { QueryLoggerService } from '../../modules/logging';

@Injectable()
export class QueryTrackingInterceptor implements NestInterceptor {
  constructor(private readonly queryLogger: QueryLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(async () => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        await this.queryLogger.logQuery({
          method: request.method,
          url: request.url,
          userId: request.user?.id,
          ip: request.ip,
          userAgent: request.get('user-agent'),
          duration,
          timestamp: new Date(),
        });
      }),
    );
  }
}
