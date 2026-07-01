// =============================================================================
// AppModule — API Gateway root module
// =============================================================================
// The gateway is a *dynamic* reverse proxy: all real traffic under `/api/*` is
// handled by Express `http-proxy-middleware` registered in `main.ts`. The
// Swagger UI at `/docs` is an AGGREGATE that pulls each downstream service's
// REAL OpenAPI spec through the gateway (see the /docs/<service>-json proxies in
// main.ts), so the gateway no longer needs any documentation-only controllers.
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
