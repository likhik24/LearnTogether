import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const SERVICE_NAME = 'voice';
const DEFAULT_PORT = 3005;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  await app.listen(port, '0.0.0.0');
  console.log(`[${SERVICE_NAME}] listening on port ${port}`);
}

void bootstrap();
