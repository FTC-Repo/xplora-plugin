import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { corsHeaders } from "@/lib/cors"
import { ok, err } from "@/lib/response"
import { supabaseAdmin } from "@/lib/supabase"

type Plan = "free" | "pro"

export interface VerifyResponse {
  accessToken:  string
  refreshToken: string
  expiresAt:    number   // Unix timestamp (seconds)
  userId:       string
  email:        string
  plan:         Plan
}

/**
 * POST /api/auth/verify
 * Body: { email: string; token: string }
 *
 * Verifies the 6-digit OTP code sent via /api/auth/otp.
 * On success returns JWT tokens and the user's current plan.
 *
 * Plan resolution: takes the highest plan from two sources —
 *   profiles (userId-linked, main auth record)
 *   pro_users (email-linked, updated by Polar webhook)
 * This ensures users who paid via Polar before signing in get Pro immediately.
 */
export async function POST(req: NextRequest) {
  try {
    const body  = await req.json()
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
    const token = typeof body?.token === "string" ? body.token.trim() : ""

    if (!email || !token) {
      return err("email and token are required", 400)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    )

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    })

    if (error || !data.session || !data.user) {
      console.error("[POST /api/auth/verify]", error)
      return err(error?.message ?? "Invalid or expired code", 400)
    }

    const session   = data.session
    const userId    = data.user.id
    const userEmail = (data.user.email ?? email).toLowerCase()

    // Dual-source plan resolution (parallel fetch)
    const [profileResult, proUserResult] = await Promise.all([
      supabaseAdmin.from("profiles").select("plan").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("pro_users").select("plan").eq("email", userEmail).maybeSingle(),
    ])

    const plan: Plan =
      profileResult.data?.plan === "pro" || proUserResult.data?.plan === "pro"
        ? "pro"
        : "free"

    // Sync: if Polar already granted pro but profiles hasn't caught up yet, write it back
    if (proUserResult.data?.plan === "pro" && profileResult.data?.plan !== "pro") {
      await supabaseAdmin
        .from("profiles")
        .upsert({ id: userId, email: userEmail, plan: "pro" })
    }

    const response: VerifyResponse = {
      accessToken:  session.access_token,
      refreshToken: session.refresh_token,
      expiresAt:    session.expires_at ?? Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
      userId,
      email:        userEmail,
      plan,
    }

    return ok(response)
  } catch (e) {
    console.error("[POST /api/auth/verify]", e)
    return err("Failed to verify OTP", 500)
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}
