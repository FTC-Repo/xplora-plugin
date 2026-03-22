/**
 * CORS headers applied to every API response and OPTIONS preflight.
 * The Framer plugin panel may be served from any origin (file://, framer.com,
 * or localhost during dev), so we allow all origins for this local-dev server.
 */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}
