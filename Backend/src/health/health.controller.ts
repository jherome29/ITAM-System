import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SkipThrottle } from '@nestjs/throttler';

// Liveness + DB-readiness probe. Consumed by the container healthchecks
// (docker-compose*.yml) and CICC IT's reverse proxy. No auth guard (none is
// global; controllers opt in) and deliberately outside the /v1 API surface.
// Returns 503 when the DB is unreachable so `depends_on: service_healthy`
// holds back the frontend until the backend can actually serve.
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({ status: 'degraded', db: false });
    }
    return {
      status: 'ok',
      db: true,
      uptime: Math.round(process.uptime()),
    };
  }
}
