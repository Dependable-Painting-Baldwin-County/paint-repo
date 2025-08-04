import { Env } from '../types';

/**
 * Serves static assets from the configured `ASSETS` binding. This wrapper
 * simplifies fetching static files and ensures that all other non-API routes
 * fall back to asset serving.
 */
export async function serveStaticAsset(request: Request, env: Env): Promise<Response> {
  return env.ASSETS.fetch(request);
}