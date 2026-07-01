// Liveness endpoint for the Cloud Run startup probe (GET /health → 200).
// The frontend is a stateless Next.js server; "up" == able to serve HTTP.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ status: 'ok' });
}
