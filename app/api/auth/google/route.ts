import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { corsHeaders } from "@/lib/cors"
import { ok, err } from "@/lib/response"

/**
 * GET /api/auth/google
 *
 * Returns a Google OAuth URL from Supabase.
 * The plugin opens this URL in a popup; after the user authenticates,
 * Supabase redirects to /auth/callback which posts tokens back via postMessage.
 */
export async function GET() {
  try {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001").replace(/\/$/, "")

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    )

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${appUrl}/auth/callback`,
        skipBrowserRedirect: true,
      },
    })

    if (error || !data.url) {
      console.error("[GET /api/auth/google]", error)
      return err(error?.message ?? "Failed to generate Google OAuth URL", 500)
    }

    return ok({ url: data.url })
  } catch (e) {
    console.error("[GET /api/auth/google]", e)
    return err("Failed to initiate Google sign-in", 500)
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}
