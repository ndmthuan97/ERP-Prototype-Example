/**
 * Entry point — API Gateway
 *
 * The gateway is the SINGLE ENTRY POINT for the frontend:
 * - Frontend only knows one URL: http://localhost:3010
 * - Gateway receives requests → verifies JWT → forwards to correct service
 * - Public routes (login, refresh): forwarded without JWT verification
 * - Protected routes: JWT verified first, user info attached as headers
 *
 * Routing:
 *   /api/auth/*       → Auth Service     :3004
 *   /api/customers/*  → Customer Service  :3001
 *   /api/orders/*     → Order Service     :3002
 *   /api/inventory/*  → Inventory Service :3003
 *   /api/catalog/*    → Catalog Service   :3005
 *   /api/purchasing/* → Purchasing Service :3006
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../.env') });

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { AppModule } from './app.module.js';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  fullName: string;
}

// Routes that bypass JWT verification
const PUBLIC_ROUTES: Array<{ method: string; path: RegExp }> = [
  { method: 'POST', path: /^\/api\/auth\/login$/ },
  { method: 'POST', path: /^\/api\/auth\/refresh$/ },
];

function isPublicRoute(method: string, path: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => route.method === method.toUpperCase() && route.path.test(path),
  );
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('APIGateway');

  // CORS for frontend — restrict to allowed origins (fix: was `origin: true`)
  const corsOrigins = process.env.CORS_ORIGINS?.trim();
  app.enableCors({
    origin: corsOrigins
      ? corsOrigins.split(',').map((o) => o.trim())
      : ['http://localhost:3000'],
    credentials: true,
  });

  // Security headers
  app.use(helmet());

  // Global rate limit: configurable via env (default: 100 req / 15 min)
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: parseInt(process.env.GLOBAL_RATE_LIMIT || '100', 10),
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Strict rate limit for auth login: configurable via env (default: 5 / 15 min)
  app.use(
    '/api/auth/login',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: parseInt(process.env.LOGIN_RATE_LIMIT || '5', 10),
      message: {
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Too many login attempts, please try again later',
      },
    }),
  );

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is required. Gateway cannot start without it.',
    );
  }

  // JWT verification middleware — runs BEFORE proxy forwarding
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Skip JWT check for public routes
    if (isPublicRoute(req.method, req.path)) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
      });
    }

    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, jwtSecret) as JwtPayload;
      // Attach user info as headers for downstream services
      req.headers['x-user-id'] = payload.sub;
      req.headers['x-user-role'] = payload.role;
      req.headers['x-user-email'] = payload.email;
      req.headers['x-user-fullname'] = payload.fullName;
      next();
    } catch {
      return res.status(401).json({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }
  });

  // Service URLs from environment
  const serviceUrls = {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3004',
    customer: process.env.CUSTOMER_SERVICE_URL || 'http://localhost:3001',
    order: process.env.ORDER_SERVICE_URL || 'http://localhost:3002',
    inventory: process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003',
    catalog: process.env.CATALOG_SERVICE_URL || 'http://localhost:3005',
    purchasing: process.env.PURCHASING_SERVICE_URL || 'http://localhost:3006',
  };

  // Proxy middleware factory
  // NestJS app.use('/api/auth', proxy) strips the mount prefix, so proxy sees
  // only the remainder (e.g. '/login'). Each service needs its controller prefix
  // prepended back (e.g. '/auth/login' for auth-service).
  const createProxy = (target: string, servicePrefix: string) =>
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: (path) => `${servicePrefix}${path}`,
    });

  app.use('/api/auth', createProxy(serviceUrls.auth, '/v1/auth'));
  app.use('/api/customers', createProxy(serviceUrls.customer, '/v1/customers'));
  app.use('/api/orders', createProxy(serviceUrls.order, '/v1/orders'));
  app.use('/api/inventory', createProxy(serviceUrls.inventory, '/v1/inventory'));
  app.use('/api/catalog', createProxy(serviceUrls.catalog, '/v1/catalog'));
  app.use('/api/purchasing', createProxy(serviceUrls.purchasing, '/v1/purchasing'));
  app.use('/api/suppliers', createProxy(serviceUrls.purchasing, '/v1/suppliers'));

  const port = parseInt(process.env.API_GATEWAY_PORT || '3010', 10);
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 API Gateway running at http://localhost:${port}`);
  logger.log(`🔒 JWT verification enabled for protected routes`);
  logger.log(`📋 Routing:`);
  logger.log(`   /api/auth/*       → Auth Service     (${serviceUrls.auth})`);
  logger.log(`   /api/customers/*  → Customer Service  (${serviceUrls.customer})`);
  logger.log(`   /api/orders/*     → Order Service     (${serviceUrls.order})`);
  logger.log(`   /api/inventory/*  → Inventory Service (${serviceUrls.inventory})`);
  logger.log(`   /api/catalog/*    → Catalog Service   (${serviceUrls.catalog})`);
  logger.log(`   /api/purchasing/* → Purchasing Service (${serviceUrls.purchasing})`);
  logger.log(`   /api/suppliers/*  → Purchasing Service (${serviceUrls.purchasing})`);
}

bootstrap();
