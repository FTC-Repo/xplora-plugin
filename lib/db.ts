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

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/**
 * Fetch all images from Supabase and map them to the shared `Item` shape.
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

// ---------------------------------------------------------------------------
// Saves — stored in Supabase `saves` table (user_id, item_id)
// ---------------------------------------------------------------------------

export async function getSavesForUser(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("saves")
    .select("item_id")
    .eq("user_id", userId)

  if (error) throw new Error(`Failed to fetch saves: ${error.message}`)
  return (data ?? []).map((row: { item_id: string }) => row.item_id)
}

export async function addSave(userId: string, itemId: string): Promise<string[]> {
  const { error } = await supabaseAdmin
    .from("saves")
    .upsert({ user_id: userId, item_id: itemId }, { onConflict: "user_id,item_id" })

  if (error) throw new Error(`Failed to save item: ${error.message}`)
  return getSavesForUser(userId)
}

export async function removeSave(userId: string, itemId: string): Promise<string[]> {
  const { error } = await supabaseAdmin
    .from("saves")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", itemId)

  if (error) throw new Error(`Failed to unsave item: ${error.message}`)
  return getSavesForUser(userId)
}
