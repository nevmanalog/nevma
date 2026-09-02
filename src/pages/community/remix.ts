import { useStore } from '@/state/store'
import { useRoute } from '@/state/route'
import { useUi } from '@/state/ui'
import { loadImageFromUrl } from '@/shared/loadImage'
import type { CommunityPost } from '@/lib/community'

/**
 * Loads a post's image as a fresh layer to build your own version on top of
 * — cut it up, tape it, run it through a different paper/printer, whatever.
 * Unlike PostPresetChip (which copies the processing *settings* onto the
 * viewer's own photo), this brings in the *photo itself* — the community
 * equivalent of a duet/stitch.
 *
 * Mirrors "Import image" on the New Project screen (see
 * NewProjectModal.tsx's doImport): if there's no project open yet, a fresh
 * document is created sized to the image; if one's already open, the image
 * is simply added as a new layer inside it rather than replacing anything,
 * so remixing never silently discards work already in progress.
 *
 * Deliberately synchronous-looking but not: image fetch/decode is async, so
 * callers (RemixButton) drive their own loading state off onSuccess/onError
 * rather than this returning a Promise — keeps it consistent with the rest
 * of loadImage.ts's callback style.
 */
export function remixPost(post: CommunityPost, onSuccess: () => void, onError: (err: unknown) => void): void {
  const url = post.fullUrl ?? post.previewUrl
  if (!url) { onError(new Error('This post has no image to remix.')); return }
  loadImageFromUrl(
    url,
    (source, w, h) => {
      if (!useStore.getState().doc) {
        useStore.getState().createDocument({ name: post.title || 'Remix', width: w, height: h })
      }
      useStore.getState().addImageLayer(source, w, h)
      useUi.getState().setTopStage('workshop')
      useRoute.getState().navigate('editor')
      onSuccess()
    },
    onError,
  )
}
