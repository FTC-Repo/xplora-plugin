import { type NextRequest, NextResponse } from "next/server"
import { readItems } from "@/lib/db"
import { corsHeaders } from "@/lib/cors"
import { ok, err } from "@/lib/response"

/**
 * GET /api/items?q=<query>
 *
 * Returns { ok: true, data: Item[] }.
 * All items are returned regardless of plan — pro items are tagged with "pro"
 * so the plugin can show the Pro badge and lock overlay on the client side.
 *
 * Filters case-insensitively across title, category, and every tag when q is
 * provided.  Returns the full catalogue when q is absent or blank.
 */
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase()

    const allItems = await readItems()

    const data = q
      ? allItems.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.category.toLowerCase().includes(q) ||
            item.tags.some((t) => t.toLowerCase().includes(q)),
        )
      : allItems

    return ok(data)
  } catch (e) {
    console.error("[GET /api/items]", e)
    return err("Failed to read items", 500)
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}
