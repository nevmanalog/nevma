/** Classic XP indeterminate progress bar — a block of green segments that
 *  slides back and forth. Used wherever we're doing real work (export,
 *  publish) but have no real percentage to report, so it never pretends to
 *  show progress it doesn't have. */
export function XpProgressBar() {
  return (
    <div className="xp-progress-track">
      <div className="xp-progress-fill" />
    </div>
  )
}
