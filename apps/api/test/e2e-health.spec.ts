import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

describe('E2E Health and Readiness Flow', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.setGlobalPrefix('api/v1', {
      exclude: ['health', 'ready', 'api/v1/health', 'api/v1/ready'],
    });

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('initializes app without throwing', () => {
    expect(app).toBeDefined();
  });

  it('GET /health returns 200 ok', async () => {
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const response = await fetch(`http://127.0.0.1:${port}/health`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.environment).toBeDefined();
  });

  it('GET /api/v1/health returns 200 ok', async () => {
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  it('GET /ready returns readiness structure', async () => {
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const response = await fetch(`http://127.0.0.1:${port}/ready`);
    expect([200, 503]).toContain(response.status);
    const body = await response.json();
    expect(body.checks).toBeDefined();
    expect(body.checks.database.status).toBe('up');
    expect(body.checks.redis).toBeDefined();
  });
});
