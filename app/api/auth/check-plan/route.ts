import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { corsHeaders } from "@/lib/cors"
import { ok, err } from "@/lib/response"

/**
 * POST /api/auth/check-plan
 * Body: { email: string }
 *
 * Returns the plan for the given email from pro_users table.
 * Defaults to "free" if not found.
 * No authentication required — used for email-only plan check flow.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""

    if (!email || !email.includes("@")) {
      return err("Valid email is required", 400)
    }

    const { data, error } = await supabaseAdmin
      .from("pro_users")
      .select("plan")
      .eq("email", email)
      .maybeSingle()

    if (error) {
      console.error("[POST /api/auth/check-plan]", error)
      return err("Failed to check plan", 500)
    }

    const plan = (data?.plan as "free" | "pro") ?? "free"
    return ok({ plan })
  } catch (e) {
    console.error("[POST /api/auth/check-plan]", e)
    return err("Failed to check plan", 500)
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}
