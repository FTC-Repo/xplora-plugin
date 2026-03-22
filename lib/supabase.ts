import { createClient } from "@supabase/supabase-js"

/**
 * Admin client — uses the service-role key which bypasses Row Level Security.
 * Only import this on the server (API routes / server actions).
 * Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)
