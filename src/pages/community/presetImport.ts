import { useStore } from '@/state/store'
import { useRoute } from '@/state/route'
import { useUi } from '@/state/ui'
import type { CommunityPost } from '@/lib/community'

/** Saves a post's attached processing preset (paper/printer/damage/scanner
 *  settings, captured when the author published from the editor's Final
 *  tab) into the local editor's own saved-presets list, named after the
 *  work and its author, so it's ready to apply from the Final tab's "load
 *  saved" dropdown. No-op if the post has no preset attached (e.g. it was
 *  published from the Community page instead of the editor).
 *
 *  Deliberately does NOT navigate — PostPresetChip shows a confirmation
 *  modal first (people clicking a preset chip mid-scroll through the feed
 *  don't expect to be yanked into the editor instantly) and only jumps via
 *  goToPresetInEditor() once they've confirmed. */
export function importPostPreset(post: CommunityPost): void {
  if (!post.presetData) return
  const name = `${post.title} — @${post.authorName}`
  useStore.getState().importPreset(name, post.presetData.effects, post.presetData.seed)
}

/** Navigates to the editor and lands directly on the Final tab, where the
 *  just-imported preset can be applied from the "load saved" dropdown. Used
 *  by the "Go" button in PostPresetChip's confirmation modal. */
export function goToPresetInEditor(): void {
  useUi.getState().setTopStage('final')
  useRoute.getState().navigate('editor')
}
