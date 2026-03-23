import { type NextRequest, NextResponse } from "next/server"
import { addSave, removeSave } from "@/lib/db"
import { corsHeaders } from "@/lib/cors"
import { ok, err } from "@/lib/response"

type RouteContext = { params: Promise<{ itemId: string }> }

function deviceIdFrom(req: NextRequest): string | null {
  const id = req.nextUrl.searchParams.get("deviceId")?.trim()
  return id || null
}

/**
 * POST /api/saves/[itemId]?deviceId=<userId>
 *
 * Idempotent add — upserts the save in Supabase.
 * Returns { ok: true, data: string[] } — the full updated list.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { itemId } = await params
  const deviceId = deviceIdFrom(req)
  if (!deviceId) return err("deviceId query param is required", 400)

  try {
    const saves = await addSave(deviceId, itemId)
    return ok(saves)
  } catch (e) {
    console.error("[POST /api/saves/:itemId]", e)
    return err("Failed to save item", 500)
  }
}

/**
 * DELETE /api/saves/[itemId]?deviceId=<userId>
 *
 * Idempotent remove — deletes the save from Supabase.
 * Returns { ok: true, data: string[] } — the full updated list.
 */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { itemId } = await params
  const deviceId = deviceIdFrom(req)
  if (!deviceId) return err("deviceId query param is required", 400)

  try {
    const saves = await removeSave(deviceId, itemId)
    return ok(saves)
  } catch (e) {
    console.error("[DELETE /api/saves/:itemId]", e)
    return err("Failed to unsave item", 500)
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}
