import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { QueryLogEntity } from "./entities";
import { QueryLoggerService } from "./query-logger.service";

@Module({
    imports: [
        TypeOrmModule.forFeature([QueryLogEntity]),
    ],
    providers: [QueryLoggerService],
    exports: [QueryLoggerService],
})
export class LoggingModule {}