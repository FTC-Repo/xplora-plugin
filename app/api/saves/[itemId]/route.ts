import { type NextRequest, NextResponse } from "next/server"
import { readSaves, writeSaves } from "@/lib/db"
import { corsHeaders } from "@/lib/cors"
import { ok, err } from "@/lib/response"

type RouteContext = { params: Promise<{ itemId: string }> }

function deviceIdFrom(req: NextRequest): string | null {
  const id = req.nextUrl.searchParams.get("deviceId")?.trim()
  return id || null
}

/**
 * POST /api/saves/[itemId]?deviceId=<id>
 *
 * Idempotent add — does nothing if itemId is already saved.
 * Returns { ok: true, data: string[] } — the full updated list.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { itemId } = await params
  const deviceId = deviceIdFrom(req)
  if (!deviceId) return err("deviceId query param is required", 400)

  try {
    const saves = await readSaves()
    const current = saves[deviceId] ?? []

    if (!current.includes(itemId)) {
      saves[deviceId] = [...current, itemId]
      await writeSaves(saves)
    }

    return ok(saves[deviceId])
  } catch (e) {
    console.error("[POST /api/saves/:itemId]", e)
    return err("Failed to save item", 500)
  }
}

/**
 * DELETE /api/saves/[itemId]?deviceId=<id>
 *
 * Idempotent remove — no-ops if itemId is not in the list.
 * Returns { ok: true, data: string[] } — the full updated list.
 */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { itemId } = await params
  const deviceId = deviceIdFrom(req)
  if (!deviceId) return err("deviceId query param is required", 400)

  try {
    const saves = await readSaves()
    saves[deviceId] = (saves[deviceId] ?? []).filter((id) => id !== itemId)
    await writeSaves(saves)

    return ok(saves[deviceId])
  } catch (e) {
    console.error("[DELETE /api/saves/:itemId]", e)
    return err("Failed to unsave item", 500)
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}
