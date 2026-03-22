import { type NextRequest, NextResponse } from "next/server"
import { readSaves } from "@/lib/db"
import { corsHeaders } from "@/lib/cors"
import { ok, err } from "@/lib/response"

/**
 * GET /api/saves?deviceId=<id>
 *
 * Returns { ok: true, data: string[] } — the saved itemIds for the device.
 */
export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get("deviceId")?.trim()

  if (!deviceId) {
    return err("deviceId query param is required", 400)
  }

  try {
    const saves = await readSaves()
    return ok(saves[deviceId] ?? [])
  } catch (e) {
    console.error("[GET /api/saves]", e)
    return err("Failed to read saves", 500)
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}
