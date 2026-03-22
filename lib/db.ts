import { promises as fs } from "fs"
import path from "path"
import { supabaseAdmin } from "./supabase"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Item {
  id: string
  title: string
  category: string
  tags: string[]
  imageUrl: string
}

/** Raw row shape returned by the Supabase `images` table */
interface ImageRow {
  id: string
  title: string
  image_url: string
  category: string | null
  is_pro: boolean
  tags: string[] | null
}

/** deviceId → array of saved itemIds */
export type SavesMap = Record<string, string[]>

// ---------------------------------------------------------------------------
// File paths (saves still on disk — only items moved to Supabase)
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data")
const SAVES_FILE = path.join(DATA_DIR, "saves.json")

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

/**
 * Fetch all images from Supabase and map them to the shared `Item` shape.
 *
 * Column mapping:
 *   image_url → imageUrl
 *   category  → exposed as-is; also appended to tags for searchability
 *   is_pro    → appended as "pro" tag so existing gating logic is unchanged
 */
export async function readItems(): Promise<Item[]> {
  const { data, error } = await supabaseAdmin
    .from("images")
    .select("id, title, image_url, category, is_pro, tags")
    .order("created_at", { ascending: false })

  if (error) throw new Error(`Supabase images fetch failed: ${error.message}`)

  return (data as ImageRow[]).map((row) => {
    const baseTags: string[] = row.tags ?? []
    const extraTags: string[] = [
      ...(row.is_pro ? ["pro"] : []),
      ...(row.category ? [row.category] : []),
    ]
    const tags = Array.from(new Set([...baseTags, ...extraTags]))

    return {
      id: row.id,
      title: row.title,
      category: row.category ?? "",
      tags,
      imageUrl: row.image_url,
    }
  })
}

export async function readSaves(): Promise<SavesMap> {
  try {
    const raw = await fs.readFile(SAVES_FILE, "utf-8")
    return JSON.parse(raw) as SavesMap
  } catch {
    // If the file is missing or malformed, return an empty map.
    return {}
  }
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

/**
 * Atomically write the saves map back to disk.
 * Uses a tmp-file + rename strategy so that a crash mid-write never leaves
 * saves.json in a truncated state.
 */
export async function writeSaves(saves: SavesMap): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true }) // create data/ if it doesn't exist
  const tmp = SAVES_FILE + ".tmp"
  await fs.writeFile(tmp, JSON.stringify(saves, null, 2), "utf-8")
  await fs.rename(tmp, SAVES_FILE)
}
