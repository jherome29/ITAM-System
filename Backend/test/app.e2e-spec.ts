import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { createTestApp } from './create-test-app';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = await createTestApp(moduleFixture);
  });

  it('returns 404 for the root path — all API routes live under /api', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });

  afterEach(async () => {
    await app.close();
  });
});
