import { supabase } from './supabase'
import { newId } from '@/shared/id'
import { fileToAvatarBlob, AvatarImageError } from '@/shared/avatarImage'

export { AvatarImageError }

const BUCKET = 'avatars'

async function uploadAvatarBlob(userId: string, blob: Blob): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured')
  const path = `${userId}/${newId()}.jpg`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
  if (uploadError) throw uploadError
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Upload a blob the person has already framed themselves — via
 * AvatarCropModal's drag-to-position/zoom cropper — as the given user's
 * avatar, returning the public URL to store on their profile row.
 *
 * Storage path is `${userId}/${newId()}.jpg` — namespaced by user id because
 * the bucket's RLS policies (see supabase/schema.sql) key off the first path
 * segment matching auth.uid(), the same convention Supabase's own docs use.
 * A fresh random filename per upload (rather than overwriting a fixed name)
 * means old avatars are simply orphaned, not raced against — no upsert
 * conflicts if someone changes their avatar from two tabs at once.
 */
export async function uploadCroppedAvatar(userId: string, croppedBlob: Blob): Promise<string> {
  return uploadAvatarBlob(userId, croppedBlob)
}

/**
 * Auto-center-crop/compress `file` and upload it as the given user's
 * avatar. Kept for any caller that doesn't go through the interactive
 * cropper (AvatarCropModal, wired into ProfileForm) — the app's own avatar
 * picker no longer calls this directly.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const blob = await fileToAvatarBlob(file) // throws AvatarImageError on bad input
  return uploadAvatarBlob(userId, blob)
}
