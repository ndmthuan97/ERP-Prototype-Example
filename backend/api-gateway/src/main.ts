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
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response, NextFunction } from 'express';
import type { ClientRequest, IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { GoogleAuth, type IdTokenClient } from 'google-auth-library';
import { AppModule } from './app.module.js';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  fullName: string;
}

// Requests carry the minted Google ID token here so the (sync) onProxyReq hook
// can read it after the (async) service-auth middleware has fetched it.
interface GatewayRequest extends Request {
  __idToken?: string;
}

// ---------------------------------------------------------------------------
// Service-to-service auth — mint a Google ID token when proxying to a private
// Cloud Run service.
// ---------------------------------------------------------------------------
// On Cloud Run the downstream services are PRIVATE (ingress=internal, no
// allUsers invoker) so an unauthenticated proxied request gets a 403. Cloud Run
// authenticates callers with a Google-signed ID token whose `aud` claim equals
// the target service's origin (e.g. https://auth-service-xxxx.run.app). The
// gateway's runtime service account (erp-backend-<env>) is granted
// roles/run.invoker on each service, so a token minted from that SA is accepted.
//
// Gating (so local dev / docker-compose keeps working WITHOUT GCP creds):
//   - If SERVICE_AUTH_MODE=id-token  → always mint (explicit opt-in).
//   - Otherwise                      → mint ONLY when the target is a
//                                      *.run.app URL. localhost targets are
//                                      skipped, so no metadata-server / ADC
//                                      lookup happens outside GCP.
const serviceAuthMode = process.env.SERVICE_AUTH_MODE?.trim();

function shouldMintIdToken(target: string): boolean {
  if (serviceAuthMode === 'id-token') {
    return true;
  }
  try {
    const host = new URL(target).hostname;
    return host.endsWith('.run.app');
  } catch {
    return false;
  }
}

// One GoogleAuth instance is enough; it discovers credentials from the Cloud Run
// metadata server (or ADC locally). IdTokenClients are cached per audience — the
// client refreshes its own token automatically (tokens are valid ~1h), so we
// simply re-fetch on every request and let the library serve the cached token.
const googleAuth = new GoogleAuth();
const idTokenClientCache = new Map<string, Promise<IdTokenClient>>();

function getIdTokenClient(audience: string): Promise<IdTokenClient> {
  let client = idTokenClientCache.get(audience);
  if (!client) {
    client = googleAuth.getIdTokenClient(audience);
    idTokenClientCache.set(audience, client);
  }
  return client;
}

// The audience for a Cloud Run service is its ORIGIN (scheme + host), not the
// full request path.
function audienceOf(target: string): string {
  return new URL(target).origin;
}

async function fetchIdToken(target: string): Promise<string> {
  const audience = audienceOf(target);
  const client = await getIdTokenClient(audience);
  // v10 returns a Web `Headers` object with the freshly-refreshed token.
  const headers = await client.getRequestHeaders(audience);
  const raw = headers.get('authorization');
  if (!raw) {
    throw new Error('google-auth-library returned no Authorization header');
  }
  // Strip a leading "Bearer " so callers get the bare token.
  return raw.replace(/^Bearer\s+/i, '');
}

// Routes that bypass JWT verification
const PUBLIC_ROUTES: Array<{ method: string; path: RegExp }> = [
  { method: 'POST', path: /^\/api\/auth\/login$/ },
  { method: 'POST', path: /^\/api\/auth\/refresh$/ },
  { method: 'GET', path: /^\/health$/ },
];

function isPublicRoute(method: string, path: string): boolean {
  // Swagger UI + OpenAPI JSON must be reachable without a JWT so users can
  // browse the API docs. Covers /docs, /docs/, /docs-json, the aggregate
  // per-service spec proxies (/docs/<service>-json) and the Swagger static
  // assets (/docs/swagger-ui-bundle.js, etc.). `startsWith('/docs/')` already
  // matches every /docs/*-json proxy route below, so no extra entry is needed.
  if (
    path === '/docs' ||
    path.startsWith('/docs/') ||
    path.startsWith('/docs-json')
  ) {
    return true;
  }
  return PUBLIC_ROUTES.some(
    (route) => route.method === method.toUpperCase() && route.path.test(path),
  );
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('APIGateway');

  // Behind Cloud Run's proxy the real client IP is in X-Forwarded-For. Without
  // trusting the proxy hop, express-rate-limit keys on the proxy's socket IP —
  // a single shared bucket for ALL clients (5 failed logins would lock out
  // everyone). Trust exactly one hop (Cloud Run's front end).
  app.set('trust proxy', 1);

  // Health check endpoint (Cloud Run startup/liveness probe). Registered FIRST,
  // before helmet / CORS / rate limiting, so probes are cheap and never consume
  // the rate-limit budget (which would cause false-unhealthy restarts).
  app.use('/health', (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET') {
      return res.status(200).json({ status: 'ok' });
    }
    next();
  });

  // Log the service-to-service auth mode once at boot so operators can see
  // whether ID-token minting is active.
  if (serviceAuthMode === 'id-token') {
    logger.log(
      '🔑 Service-to-service auth: id-token (forced via SERVICE_AUTH_MODE)',
    );
  } else {
    logger.log(
      '🔑 Service-to-service auth: id-token for *.run.app targets only',
    );
  }

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
      // Pin the algorithm: with only an HMAC secret configured, accepting any
      // alg the token declares invites algorithm-confusion attacks.
      const payload = jwt.verify(token, jwtSecret, {
        algorithms: ['HS256'],
      }) as JwtPayload;
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
      on: {
        proxyReq: attachIdTokenHeader,
      },
    });

  // onProxyReq is SYNCHRONOUS, so it cannot mint a token itself. Instead the
  // async `serviceAuth` middleware (registered just before each proxy) has
  // already fetched the (cached) token and stashed it on req.__idToken. Here we
  // just copy it onto the outgoing request, OVERWRITING the user's Authorization
  // header — downstream services trust the x-user-* headers the gateway sets,
  // not the user JWT, so replacing Authorization with the service ID token is
  // exactly what Cloud Run needs to authorize the call.
  function attachIdTokenHeader(
    proxyReq: ClientRequest,
    req: IncomingMessage,
  ): void {
    const token = (req as GatewayRequest).__idToken;
    if (token) {
      proxyReq.setHeader('Authorization', `Bearer ${token}`);
    }
  }

  // Express middleware (async) placed IN FRONT OF a proxy. It resolves the
  // (cached) Google ID token for `target` and stores it on the request so the
  // sync onProxyReq hook above can attach it. For localhost / non-run.app
  // targets it is a no-op, so local dev never touches GCP credentials.
  const serviceAuth =
    (target: string) =>
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      if (!shouldMintIdToken(target)) {
        return next();
      }
      try {
        (req as GatewayRequest).__idToken = await fetchIdToken(target);
        next();
      } catch (err) {
        logger.error(
          `Failed to mint ID token for ${audienceOf(target)}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        next(err as Error);
      }
    };

  // ---------------------------------------------------------------------------
  // Aggregate OpenAPI spec proxies  →  /docs/<service>-json
  // ---------------------------------------------------------------------------
  // The Swagger UI at /docs is an AGGREGATE: a single page whose dropdown
  // (swaggerOptions.urls, configured below) lets you pick a downstream service's
  // REAL spec. So the browser can fetch every spec from the gateway's own origin
  // (no CORS, and works on Cloud Run where the downstream services are NOT public
  // — only the gateway is), we proxy each service's `/docs-json` through the
  // gateway. The mount prefix (e.g. `/docs/auth-json`) is stripped by app.use(),
  // so pathRewrite always rewrites the remainder ('/') back to '/docs-json' on
  // the target service. These routes live under /docs/* and are therefore public
  // (see isPublicRoute) — no JWT required. Registered BEFORE SwaggerModule.setup
  // so they intercept the request instead of hitting the Nest 404 handler, and
  // they never collide with the /api/* proxies above (different path prefix).
  const createDocsProxy = (target: string) =>
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: () => '/docs-json',
      on: {
        proxyReq: attachIdTokenHeader,
      },
    });

  // Each proxy is preceded by `serviceAuth(target)` so that, on Cloud Run, the
  // gateway mints an ID token (aud = target origin) BEFORE the sync proxy hook
  // runs. This covers BOTH the /docs/<service>-json spec proxies AND the
  // /api/* proxies — the downstream services are private on prod, so even the
  // (public, JWT-free) docs proxies need the service ID token to fetch specs.
  app.use(
    '/docs/auth-json',
    serviceAuth(serviceUrls.auth),
    createDocsProxy(serviceUrls.auth),
  );
  app.use(
    '/docs/customers-json',
    serviceAuth(serviceUrls.customer),
    createDocsProxy(serviceUrls.customer),
  );
  app.use(
    '/docs/orders-json',
    serviceAuth(serviceUrls.order),
    createDocsProxy(serviceUrls.order),
  );
  app.use(
    '/docs/inventory-json',
    serviceAuth(serviceUrls.inventory),
    createDocsProxy(serviceUrls.inventory),
  );
  app.use(
    '/docs/catalog-json',
    serviceAuth(serviceUrls.catalog),
    createDocsProxy(serviceUrls.catalog),
  );
  app.use(
    '/docs/purchasing-json',
    serviceAuth(serviceUrls.purchasing),
    createDocsProxy(serviceUrls.purchasing),
  );

  app.use(
    '/api/auth',
    serviceAuth(serviceUrls.auth),
    createProxy(serviceUrls.auth, '/v1/auth'),
  );
  app.use(
    '/api/customers',
    serviceAuth(serviceUrls.customer),
    createProxy(serviceUrls.customer, '/v1/customers'),
  );
  app.use(
    '/api/orders',
    serviceAuth(serviceUrls.order),
    createProxy(serviceUrls.order, '/v1/orders'),
  );
  app.use(
    '/api/inventory',
    serviceAuth(serviceUrls.inventory),
    createProxy(serviceUrls.inventory, '/v1/inventory'),
  );
  app.use(
    '/api/catalog',
    serviceAuth(serviceUrls.catalog),
    createProxy(serviceUrls.catalog, '/v1/catalog'),
  );
  app.use(
    '/api/purchasing',
    serviceAuth(serviceUrls.purchasing),
    createProxy(serviceUrls.purchasing, '/v1/purchasing'),
  );
  app.use(
    '/api/suppliers',
    serviceAuth(serviceUrls.purchasing),
    createProxy(serviceUrls.purchasing, '/v1/suppliers'),
  );

  // ---------------------------------------------------------------------------
  // Aggregate Swagger UI  →  http://localhost:<port>/docs
  // ---------------------------------------------------------------------------
  // ONE Swagger UI page with a service-picker dropdown. `swaggerOptions.urls`
  // points at the /docs/<service>-json proxies above, so each entry loads that
  // service's REAL OpenAPI spec (fetched same-origin through the gateway). The
  // `document` passed to setup is a minimal gateway spec used only as the base
  // shell; `spec: null` in swaggerOptions drops that inline spec so the dropdown
  // (urls) is the single source of truth for what the UI renders. The /docs path
  // is exempt from the JWT middleware above (see isPublicRoute), so the UI and
  // the spec proxies load without a token.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ERP API Gateway (Aggregate)')
    .setDescription(
      [
        'Single entry point for the ERP frontend. Pick a service from the ' +
          '**dropdown at the top** to browse its live OpenAPI spec (fetched ' +
          'through the gateway):',
        '',
        '- **Auth**       → `/api/auth/*`       → Auth Service',
        '- **Customers**  → `/api/customers/*`  → Customer Service',
        '- **Orders**     → `/api/orders/*`     → Order (Sales) Service',
        '- **Inventory**  → `/api/inventory/*`  → Inventory Service',
        '- **Catalog**    → `/api/catalog/*`    → Catalog Service',
        '- **Purchasing** → `/api/purchasing/*` & `/api/suppliers/*` → Purchasing Service',
        '',
        'The gateway verifies a JWT Bearer token and reverse-proxies each ' +
          'request to the matching microservice. All routes require a Bearer ' +
          'token EXCEPT `POST /api/auth/login` and `POST /api/auth/refresh`. ' +
          'Click **Authorize** and paste your access token to try protected ' +
          'endpoints.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addServer('/', 'API Gateway (paths already include the /api prefix)')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
      // Drop the inline gateway spec so the `urls` dropdown is authoritative
      // (swagger-ui prefers an inline `spec` over `urls` otherwise).
      spec: null,
      urls: [
        { url: '/docs/auth-json', name: 'Auth' },
        { url: '/docs/customers-json', name: 'Customers' },
        { url: '/docs/orders-json', name: 'Orders' },
        { url: '/docs/inventory-json', name: 'Inventory' },
        { url: '/docs/catalog-json', name: 'Catalog' },
        { url: '/docs/purchasing-json', name: 'Purchasing' },
      ],
    },
  });

  const port = parseInt(
    process.env.PORT || process.env.API_GATEWAY_PORT || '3010',
    10,
  );
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 API Gateway running at http://localhost:${port}`);
  logger.log(`🔒 JWT verification enabled for protected routes`);
  logger.log(`📋 Routing:`);
  logger.log(`   /api/auth/*       → Auth Service     (${serviceUrls.auth})`);
  logger.log(
    `   /api/customers/*  → Customer Service  (${serviceUrls.customer})`,
  );
  logger.log(`   /api/orders/*     → Order Service     (${serviceUrls.order})`);
  logger.log(
    `   /api/inventory/*  → Inventory Service (${serviceUrls.inventory})`,
  );
  logger.log(
    `   /api/catalog/*    → Catalog Service   (${serviceUrls.catalog})`,
  );
  logger.log(
    `   /api/purchasing/* → Purchasing Service (${serviceUrls.purchasing})`,
  );
  logger.log(
    `   /api/suppliers/*  → Purchasing Service (${serviceUrls.purchasing})`,
  );
}

bootstrap().catch((err) => {
  new Logger('APIGateway').error(err);
  process.exit(1);
});
