import { createClient } from "@supabase/supabase-js"
import { supabaseAdmin } from "./supabase"

export type Plan = "free" | "pro"

export interface AuthUser {
  userId: string
  email: string
  plan: Plan
}

/**
 * Verifies the Bearer JWT from the Authorization header and returns the user's
 * id, email, and plan.  Returns null for missing / invalid tokens.
 *
 * Uses a per-request anon client to verify the JWT (so we don't trust the
 * token blindly) and the admin client to fetch the plan (bypasses RLS).
 */
export async function getUserFromRequest(
  authHeader: string | null,
): Promise<AuthUser | null> {
  if (!authHeader?.startsWith("Bearer ")) return null
  const token = authHeader.slice(7)

  // Verify JWT with a throw-away anon client (this validates signature + expiry)
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
  const { data: { user }, error } = await anon.auth.getUser(token)
  if (error || !user) return null

  // Fetch plan from profiles via the admin client (no RLS restriction)
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single()

  return {
    userId: user.id,
    email: user.email ?? "",
    plan: (profile?.plan ?? "free") as Plan,
  }
}
