import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { TransformableInfo } from 'logform';
import { format } from 'winston';
import { v4 as uuidv4 } from 'uuid';

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  verbose: 5,
};

interface LogConfig {
  level: string;
  service: string;
  environment: string;
  logDirectory: string;
  maxSize: string;
  maxFiles: number;
  enableConsole: boolean;
  enableFile: boolean;
}

interface LogMetadata {
  [key: string]: any;
  requestId?: string;
  correlationId?: string;
  endpoint?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  error?: Error | string;
}

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  service: string;
  environment: string;
  correlationId?: string;
  metadata?: LogMetadata;
}

export class Logger {
  private logger: winston.Logger;
  private config: LogConfig;

  constructor(config: Partial<LogConfig> = {}) {
    this.config = {
      level: process.env.LOG_LEVEL || 'info',
      service: process.env.SERVICE_NAME || 'elevator-system',
      environment: process.env.NODE_ENV || 'development',
      logDirectory: process.env.LOG_DIRECTORY || 'logs',
      maxSize: process.env.LOG_MAX_SIZE || '10m',
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '10', 10),
      enableConsole: process.env.LOG_CONSOLE !== 'false',
      enableFile: process.env.LOG_FILE !== 'false',
    };

    this.config = { ...this.config, ...config };

    const customFormat = format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      format.errors({ stack: true }),
      format.metadata(),
      format.json(),
      this.correlationIdFormat(),
      this.sanitizeMetadata()
    );

    const consoleFormat = format.combine(
      format.colorize(),
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.printf(this.formatConsole.bind(this))
    );

    const transports: winston.transport[] = [];

    if (this.config.enableFile) {
      transports.push(
        new DailyRotateFile({
          filename: `${this.config.logDirectory}/%DATE%-error.log`,
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: this.config.maxSize,
          maxFiles: this.config.maxFiles,
          level: 'error',
          format: customFormat,
        }),
        new DailyRotateFile({
          filename: `${this.config.logDirectory}/%DATE%-combined.log`,
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: this.config.maxSize,
          maxFiles: this.config.maxFiles,
          format: customFormat,
        })
      );
    }

    if (this.config.enableConsole && this.config.environment !== 'production') {
      transports.push(
        new winston.transports.Console({
          format: consoleFormat,
        })
      );
    }

    this.logger = winston.createLogger({
      levels: logLevels,
      level: this.config.level,
      format: customFormat,
      defaultMeta: {
        service: this.config.service,
        environment: this.config.environment,
      },
      transports,
    });

    this.logger.on('data', this.handleExternalMonitoring.bind(this));
  }

  private correlationIdFormat() {
    return format((info: TransformableInfo) => {
      if (!info.correlationId) {
        info.correlationId = uuidv4();
      }
      return info;
    })();
  }

  private sanitizeMetadata() {
    return format((info: TransformableInfo) => {
      if (info.metadata) {
        const sensitiveFields = ['password', 'token', 'apiKey'];
        info.metadata = this.removeSensitiveFields(
          info.metadata,
          sensitiveFields
        );
      }
      return info;
    })();
  }

  private removeSensitiveFields(obj: any, sensitiveFields: string[]): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    const result = { ...obj };
    for (const key of Object.keys(result)) {
      if (sensitiveFields.includes(key)) {
        result[key] = '[REDACTED]';
      } else if (typeof result[key] === 'object') {
        result[key] = this.removeSensitiveFields(result[key], sensitiveFields);
      }
    }
    return result;
  }

  private formatConsole(info: TransformableInfo): string {
    const {
      timestamp,
      level,
      message,
      correlationId,
      service,
      environment,
      metadata,
    } = info;
    const metaString =
      metadata && Object.keys(metadata).length > 0
        ? JSON.stringify(metadata, null, 2)
        : '';
    return `[${timestamp}] ${level}: [${service}/${environment}] ${message} (correlationId: ${correlationId})${metaString ? `\n${metaString}` : ''}`;
  }

  private handleExternalMonitoring(info: LogEntry) {
    if (info.level === 'error' && process.env.EXTERNAL_MONITORING_URL) {
      console.log(`Sending to external monitoring: ${JSON.stringify(info)}`);
    }
  }

  public error(message: string, metadata: LogMetadata = {}): void {
    this.logger.error(message, { ...metadata });
  }

  public warn(message: string, metadata: LogMetadata = {}): void {
    this.logger.warn(message, { ...metadata });
  }

  public info(message: string, metadata: LogMetadata = {}): void {
    this.logger.info(message, { ...metadata });
  }

  public http(message: string, metadata: LogMetadata = {}): void {
    this.logger.http(message, { ...metadata });
  }

  public debug(message: string, metadata: LogMetadata = {}): void {
    this.logger.debug(message, { ...metadata });
  }

  public verbose(message: string, metadata: LogMetadata = {}): void {
    this.logger.verbose(message, { ...metadata });
  }

  public child(context: Partial<LogMetadata>): Logger {
    const childLogger = new Logger(this.config);
    childLogger.logger = this.logger.child({
      ...context,
      service: this.config.service,
      environment: this.config.environment,
    });
    return childLogger;
  }

  public addTransport(transport: winston.transport): void {
    this.logger.add(transport);
  }

  public getConfig(): LogConfig {
    return { ...this.config };
  }

  public setLogLevel(level: string): void {
    if (Object.keys(logLevels).includes(level)) {
      this.config.level = level;
      this.logger.level = level;
      this.info('Log level updated', { newLevel: level });
    } else {
      this.error('Invalid log level', { attemptedLevel: level });
    }
  }

  public async close(): Promise<void> {
    await new Promise<void>(resolve => {
      this.logger.on('finish', () => resolve());
      this.logger.end();
    });
  }
}

export { LogMetadata, LogEntry };
