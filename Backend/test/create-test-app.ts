import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { App } from 'supertest/types';
import { applyRequestPipeline } from '../src/common/app-pipeline';

/**
 * An initialised app with main.ts's request pipeline — global prefix, the
 * strict ValidationPipe, the response envelope and the exception filter — so
 * every e2e spec tests DTO rules and error shapes exactly as production
 * serves them. Use this instead of createNestApplication() + init().
 */
export async function createTestApp(
  moduleFixture: TestingModule,
): Promise<INestApplication<App>> {
  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  applyRequestPipeline(app);
  await app.init();
  return app;
}
