import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { corsHeaders } from "@/lib/cors"
import { ok, err } from "@/lib/response"
import { supabaseAdmin } from "@/lib/supabase"

type Plan = "free" | "pro"

export interface RefreshResponse {
  accessToken:  string
  refreshToken: string
  expiresAt:    number   // Unix timestamp (seconds)
  userId:       string
  email:        string
  plan:         Plan
}

/**
 * POST /api/auth/refresh
 * Body: { refreshToken: string }
 *
 * Exchanges a refresh token for a fresh access token.
 * Also returns email, userId, and the latest plan so the plugin can:
 *   - complete the Google OAuth flow (email/userId not yet known by plugin)
 *   - auto-pick up plan changes after Polar payments (via visibilitychange)
 *
 * Plan resolution: same dual-source logic as /api/auth/verify.
 */
export async function POST(req: NextRequest) {
  try {
    const body         = await req.json()
    const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken.trim() : ""

    if (!refreshToken) {
      return err("refreshToken is required", 400)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    )

    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })

    if (error || !data.session || !data.user) {
      console.error("[POST /api/auth/refresh]", error)
      return err(error?.message ?? "Invalid or expired refresh token", 401)
    }

    const session = data.session
    const userId  = data.user.id
    const email   = (data.user.email ?? "").toLowerCase()

    // Dual-source plan resolution (parallel fetch)
    const [profileResult, proUserResult] = await Promise.all([
      supabaseAdmin.from("profiles").select("plan").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("pro_users").select("plan").eq("email", email).maybeSingle(),
    ])

    const plan: Plan =
      profileResult.data?.plan === "pro" || proUserResult.data?.plan === "pro"
        ? "pro"
        : "free"

    // Sync: if Polar has pro but profiles hasn't caught up, write it back
    if (proUserResult.data?.plan === "pro" && profileResult.data?.plan !== "pro") {
      await supabaseAdmin
        .from("profiles")
        .upsert({ id: userId, email, plan: "pro" })
    }

    const response: RefreshResponse = {
      accessToken:  session.access_token,
      refreshToken: session.refresh_token,
      expiresAt:    session.expires_at ?? Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
      userId,
      email,
      plan,
    }

    return ok(response)
  } catch (e) {
    console.error("[POST /api/auth/refresh]", e)
    return err("Failed to refresh session", 500)
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}
