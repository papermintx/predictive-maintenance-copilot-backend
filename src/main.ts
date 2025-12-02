import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Global exception filter for better error messages
  app.useGlobalFilters(new AllExceptionsFilter());

  // Serve static files from public directory
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/',
  });

  // Enable CORS for HTTP and WebSocket
  app.enableCors({
    origin: '*', // Update di production dengan frontend URL
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`📝 Auth endpoints:`);
  logger.log(`   POST /auth/signup`);
  logger.log(`   POST /auth/signin`);
  logger.log(`   POST /auth/refresh`);
  logger.log(`   POST /auth/reset-password`);
  logger.log(`   POST /auth/signout`);
  logger.log(`   GET  /auth/me`);
  logger.log(`🔌 WebSocket Test Page: http://localhost:${port}/admin.html`);
  logger.log(`📡 WebSocket namespace: ws://localhost:${port}/sensors`);
}
bootstrap();
