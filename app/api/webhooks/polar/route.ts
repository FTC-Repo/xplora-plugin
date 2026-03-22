import { NextRequest, NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import { supabaseAdmin } from "@/lib/supabase"

/**
 * POST /api/webhooks/polar
 *
 * Handles subscription lifecycle events from Polar.sh (Standard Webhooks format).
 *
 * Verification:
 *   signed_content = `${webhook-id}.${webhook-timestamp}.${rawBody}`
 *   key = base64url_decode(secret)   ← full secret including polar_whs_ prefix
 *   expected_sig = base64(HMAC-SHA256(key, signed_content))
 *   compare against each v1,<sig> in webhook-signature header
 *
 * Events handled:
 *   subscription.created / subscription.updated → plan = "pro"
 *   subscription.canceled / subscription.revoked → plan = "free"
 */

type PolarPlan = "free" | "pro"

interface PolarWebhookEvent {
  type: string
  data: {
    // Polar.sh subscription object shape (minimal fields we need)
    subscription?: {
      customer?: {
        id?: string
        email?: string
      }
      user?: {
        id?: string
        email?: string
      }
      // Some versions use top-level customer_email
      customer_email?: string
    }
    // The data root may also directly contain customer info for some event types
    customer?: {
      id?: string
      email?: string
    }
    customer_email?: string
  }
}

function extractEmail(event: PolarWebhookEvent): string | null {
  const d = event.data
  return (
    d?.subscription?.customer?.email ??
    d?.subscription?.user?.email ??
    d?.subscription?.customer_email ??
    d?.customer?.email ??
    d?.customer_email ??
    null
  )
}


export async function POST(req: NextRequest) {
  try {
    const rawSecret = (process.env.POLAR_WEBHOOK_SECRET ?? "").trim()
    if (!rawSecret) {
      console.error("[webhooks/polar] POLAR_WEBHOOK_SECRET not configured")
      return new NextResponse("Server misconfiguration", { status: 500 })
    }

    const msgId = req.headers.get("webhook-id") ?? ""
    const timestamp = req.headers.get("webhook-timestamp") ?? ""
    const signatureHeader = req.headers.get("webhook-signature") ?? ""
    const rawBody = await req.text()

    if (!msgId || !timestamp || !signatureHeader) {
      return new NextResponse("Missing signature headers", { status: 400 })
    }

    // Polar signs with HMAC-SHA256 using the raw secret string as UTF-8 bytes (no base64 decoding).
    const keyBytes = Buffer.from(rawSecret, "utf8")
    const signedContent = `${msgId}.${timestamp}.${rawBody}`
    const expectedHmac = createHmac("sha256", keyBytes).update(signedContent).digest()
    const expectedB64 = expectedHmac.toString("base64")

    // webhook-signature header: space-separated list of "v1,<base64sig>"
    const signatures = signatureHeader
      .split(" ")
      .filter((s) => s.startsWith("v1,"))
      .map((s) => s.slice(3))

    let valid = false
    for (const sig of signatures) {
      try {
        const sigBytes = Buffer.from(sig, "base64")
        const expectedBytes = Buffer.from(expectedB64, "base64")
        if (sigBytes.length === expectedBytes.length && timingSafeEqual(sigBytes, expectedBytes)) {
          valid = true
          break
        }
      } catch {
        // skip malformed base64
      }
    }

    if (!valid) {
      console.warn("[webhooks/polar] Signature verification failed")
      return new NextResponse("Invalid signature", { status: 401 })
    }

    let event: PolarWebhookEvent
    try {
      event = JSON.parse(rawBody) as PolarWebhookEvent
    } catch {
      return new NextResponse("Invalid JSON body", { status: 400 })
    }
    const { type } = event

    console.log("[webhooks/polar] Received event:", type)

    // Only handle subscription lifecycle events
    const proEvents = ["subscription.created", "subscription.updated"]
    const freeEvents = ["subscription.canceled", "subscription.revoked"]

    if (!proEvents.includes(type) && !freeEvents.includes(type)) {
      // Acknowledge but ignore
      return new NextResponse(null, { status: 200 })
    }

    const newPlan: PolarPlan = proEvents.includes(type) ? "pro" : "free"
    const email = extractEmail(event)

    if (!email) {
      console.warn("[webhooks/polar] Could not extract email from event:", type)
      return new NextResponse(null, { status: 200 })
    }

    // Upsert directly into pro_users by email — no Supabase auth user lookup needed
    const { error: upsertError } = await supabaseAdmin
      .from("pro_users")
      .upsert(
        { email: email.toLowerCase(), plan: newPlan, updated_at: new Date().toISOString() },
        { onConflict: "email" },
      )

    if (upsertError) {
      console.error("[webhooks/polar] Failed to upsert plan:", upsertError)
      return new NextResponse("Database update failed", { status: 500 })
    }

    console.log(`[webhooks/polar] Upserted ${email} → plan=${newPlan}`)
    return new NextResponse(null, { status: 200 })
  } catch (e) {
    console.error("[webhooks/polar] Unexpected error:", e)
    return new NextResponse("Internal server error", { status: 500 })
  }
}
