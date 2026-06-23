// =============================================================================
// AppModule — API Gateway root module (simplified)
// =============================================================================
// Gateway uses Express middleware for proxy routing.
// No controllers or services needed — all routing is handled in main.ts.
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
