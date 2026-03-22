import { NextResponse } from "next/server"
import { corsHeaders } from "./cors"

// ---------------------------------------------------------------------------
// Envelope types
// ---------------------------------------------------------------------------

export type OkEnvelope<T> = { ok: true; data: T }
export type ErrEnvelope = { ok: false; error: { message: string } }
export type ApiEnvelope<T> = OkEnvelope<T> | ErrEnvelope

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

/** 200 (or custom status) success: { ok: true, data: T } */
export function ok<T>(data: T, status = 200): NextResponse<OkEnvelope<T>> {
  return NextResponse.json({ ok: true, data }, { status, headers: corsHeaders })
}

/** Error response: { ok: false, error: { message } } */
export function err(message: string, status: number): NextResponse<ErrEnvelope> {
  return NextResponse.json(
    { ok: false, error: { message } },
    { status, headers: corsHeaders },
  )
}
