import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const SERVICE_NAME = 'scheduling';
const DEFAULT_PORT = 3004;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  await app.listen(port, '0.0.0.0');
  console.log(`[${SERVICE_NAME}] listening on port ${port}`);
}

void bootstrap();
