import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Property roles (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests to /api/v1/assets with 401', () => {
    return request(app.getHttpServer()).get('/api/v1/assets').expect(401);
  });

  it('rejects unauthenticated requests to /api/v1/requisitions with 401', () => {
    return request(app.getHttpServer()).get('/api/v1/requisitions').expect(401);
  });
});
