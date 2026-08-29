import { useT } from '@/i18n'

/** Decorative status bar completing the fake-OS window look — same idea as
 *  WinTitleBar but for the bottom edge. Purely cosmetic (no real presence
 *  tracking), so it only ever shows a static "online" state, never a
 *  fabricated user count. */
export function StatusBar({ label }: { label?: string }) {
  const t = useT()
  return (
    <div className="app-status-bar">
      <span className="app-status-bar-item">🌐 {label ?? t('statusOnline')}</span>
      <span className="app-status-bar-item app-status-bar-version">v1.0.0</span>
    </div>
  )
}
