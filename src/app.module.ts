import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ValidationPipe } from '@nestjs/common';
import configuration from './config/configuration';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CoursesModule } from './modules/courses/courses.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ExportModule } from './modules/export/export.module';
import { SyncModule } from './modules/sync/sync.module';

import { User } from './modules/users/entities/user.entity';
import { Course } from './modules/courses/entities/course.entity';
import { Enrollment } from './modules/courses/entities/enrollment.entity';
import { AttendanceSession } from './modules/sessions/entities/attendance-session.entity';
import { AttendanceRecord } from './modules/attendance/entities/attendance-record.entity';
import { LivenessModule } from './liveness/liveness.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        // database: config.get<string>('database.path'),
        // entities: [User, Course, Enrollment, AttendanceSession, AttendanceRecord],
        synchronize: false, // MVP: auto-sync schema. Swap for migrations before production.
        autoLoadEntities: true,
        logging: false,
        url: config.get<string>('DATABASE_URL'),
        ssl: { rejectUnauthorized: false },
        
      }),
    }),
    AuthModule,
    UsersModule,
    CoursesModule,
    SessionsModule,
    AttendanceModule,
    ExportModule,
    SyncModule,
    LivenessModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    },
  ],
})
export class AppModule {}
