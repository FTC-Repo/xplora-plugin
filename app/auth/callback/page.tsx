"use client"
import { useEffect } from "react"

/**
 * /auth/callback
 *
 * Supabase redirects here after Google OAuth completes.
 * The access and refresh tokens arrive in the URL hash fragment.
 * We extract them and post them back to the plugin window, then close.
 */
export default function AuthCallbackPage() {
  useEffect(() => {
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)

    const accessToken  = params.get("access_token")
    const refreshToken = params.get("refresh_token")
    const expiresIn    = Number(params.get("expires_in") ?? 0)

    if (accessToken && window.opener) {
      window.opener.postMessage(
        { type: "XPLORA_GOOGLE_AUTH", accessToken, refreshToken, expiresIn },
        "*",
      )
      window.close()
    }
  }, [])

  return (
    <p style={{ fontFamily: "sans-serif", padding: 24, color: "#555" }}>
      Signing you in… you can close this window if it doesn&apos;t close automatically.
    </p>
  )
}
