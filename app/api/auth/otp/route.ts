import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { corsHeaders } from "@/lib/cors"
import { ok, err } from "@/lib/response"

/**
 * POST /api/auth/otp
 * Body: { email: string }
 *
 * Sends a 6-digit OTP email to the user via Supabase.
 * Creates the account automatically if it doesn't exist.
 * Returns { ok: true, data: null } on success.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""

    if (!email || !email.includes("@")) {
      return err("Valid email is required", 400)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    )

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    })

    if (error) {
      console.error("[POST /api/auth/otp]", error)
      return err(error.message, 400)
    }

    return ok(null)
  } catch (e) {
    console.error("[POST /api/auth/otp]", e)
    return err("Failed to send OTP", 500)
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}
