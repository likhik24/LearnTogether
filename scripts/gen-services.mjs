#!/usr/bin/env node
/**
 * Generates the NestJS service skeletons under /services.
 * Each service is identical except for its name and port, so we template them
 * here to keep them consistent. Safe to re-run; it overwrites generated files.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const NEST_VERSION = '^10.4.15';

/** name -> external host port */
const SERVICES = {
  auth: 3001,
  teacher: 3002,
  search: 3003,
  scheduling: 3004,
  voice: 3005,
  meetings: 3006,
  payments: 3007,
};

function write(path, contents) {
  const full = join(ROOT, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents.endsWith('\n') ? contents : contents + '\n');
}

function packageJson(name) {
  return (
    JSON.stringify(
      {
        name: `@learn-and-build/${name}-service`,
        version: '0.0.0',
        private: true,
        main: 'dist/main.js',
        scripts: {
          build: 'tsc -p tsconfig.json',
          start: 'node dist/main.js',
          dev: 'ts-node-dev --respawn --transpile-only src/main.ts',
          lint: 'eslint src',
          test: 'jest --passWithNoTests',
        },
        dependencies: {
          '@learn-and-build/types': 'workspace:*',
          '@nestjs/common': NEST_VERSION,
          '@nestjs/core': NEST_VERSION,
          '@nestjs/platform-express': NEST_VERSION,
          'reflect-metadata': '^0.2.2',
          rxjs: '^7.8.1',
        },
        devDependencies: {
          '@learn-and-build/config': 'workspace:*',
          '@nestjs/testing': NEST_VERSION,
          '@types/express': '^5.0.0',
          '@types/jest': '^29.5.14',
          '@types/node': '^22.10.2',
          'eslint': '^9.17.0',
          jest: '^29.7.0',
          'ts-jest': '^29.2.5',
          'ts-node-dev': '^2.0.0',
          typescript: '^5.6.3',
        },
      },
      null,
      2,
    ) + '\n'
  );
}

const tsconfig = `{
  "extends": "@learn-and-build/config/tsconfig/nestjs.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
`;

const jestConfig = `const preset = require('@learn-and-build/config/jest/nestjs');

/** @type {import('jest').Config} */
module.exports = {
  ...preset,
  rootDir: 'src',
};
`;

function mainTs(name, port) {
  return `import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const SERVICE_NAME = '${name}';
const DEFAULT_PORT = ${port};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  await app.listen(port, '0.0.0.0');
  console.log(\`[\${SERVICE_NAME}] listening on port \${port}\`);
}

void bootstrap();
`;
}

function appModule() {
  return `import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';

@Module({
  controllers: [HealthController],
})
export class AppModule {}
`;
}

function healthController(name) {
  return `import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@learn-and-build/types';

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: '${name}',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
`;
}

function healthSpec(name) {
  return `import { Test, type TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController (${name})', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns status ok for the ${name} service', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('${name}');
    expect(typeof result.timestamp).toBe('string');
    expect(typeof result.uptime).toBe('number');
  });
});
`;
}

function dockerfile(name, port) {
  return `# Build context is the repository root (see docker-compose.yml).
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --no-frozen-lockfile
# Build this service together with its workspace dependencies, in order.
RUN pnpm --filter "@learn-and-build/${name}-service..." run build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=${port}
WORKDIR /repo
COPY --from=build /repo /repo
WORKDIR /repo/services/${name}
EXPOSE ${port}
CMD ["node", "dist/main.js"]
`;
}

for (const [name, port] of Object.entries(SERVICES)) {
  const dir = `services/${name}`;
  // Skip services that have been customized beyond the skeleton.
  if (existsSync(join(ROOT, dir, '.nogen'))) {
    // eslint-disable-next-line no-console
    console.log(`skipping customized service: ${name}`);
    continue;
  }
  write(`${dir}/package.json`, packageJson(name));
  write(`${dir}/tsconfig.json`, tsconfig);
  write(`${dir}/jest.config.cjs`, jestConfig);
  write(`${dir}/src/main.ts`, mainTs(name, port));
  write(`${dir}/src/app.module.ts`, appModule());
  write(`${dir}/src/health/health.controller.ts`, healthController(name));
  write(`${dir}/src/health/health.controller.spec.ts`, healthSpec(name));
  write(`${dir}/Dockerfile`, dockerfile(name, port));
  // eslint-disable-next-line no-console
  console.log(`generated service: ${name} (port ${port})`);
}
