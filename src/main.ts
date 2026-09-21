import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AttendX API')
    .setDescription(
      'Secure university attendance system backend — auth, courses, live QR attendance sessions, records, exports and offline sync.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('auth')
    .addTag('users')
    .addTag('courses')
    .addTag('sessions')
    .addTag('attendance')
    .addTag('export')
    .addTag('sync')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`AttendX API running on http://localhost:${port}/api`);
  logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
