import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import dotenv from 'dotenv';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

import path from 'node:path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Central product name placeholder
export const PRODUCT_NAME = '{{APP_NAME}}';

// Startup environment validation
function validateEnv() {
  const required = ['DATABASE_URL', 'API_PORT', 'WEB_PORT'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // CORS limited to WEB_PORT origin from env
  const webPort = process.env.WEB_PORT || '3000';
  app.enableCors({
    origin: [`http://localhost:${webPort}`, `http://127.0.0.1:${webPort}`],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global ValidationPipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Swagger OpenAPI documentation at /api/docs
  const config = new DocumentBuilder()
    .setTitle(`${PRODUCT_NAME} Core API`)
    .setDescription('Authoritative database-first rental infrastructure REST API specifications')
    .setVersion('0.1.0')
    .addTag('health')
    .addTag('auth')
    .addTag('users')
    .addTag('assets')
    .addTag('categories')
    .addTag('listings')
    .addTag('bookings')
    .addTag('inspections')
    .addTag('handover')
    .addTag('returns')
    .addTag('maintenance')
    .addTag('disputes')
    .addTag('trust')
    .addTag('health-score')
    .addTag('payments')
    .addTag('ledger')
    .addTag('audit')
    .addTag('admin-db')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();

  const port = process.env.API_PORT || 4000;
  await app.listen(port);
  console.log(`[${PRODUCT_NAME} API] Server listening on http://localhost:${port}/api/v1`);
  console.log(`[${PRODUCT_NAME} API] OpenAPI documentation available at http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap failure:', err);
  process.exit(1);
});
