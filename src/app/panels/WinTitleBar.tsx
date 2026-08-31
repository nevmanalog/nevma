import { useT, useI18n } from '@/i18n'

/** Windows-XP-style title bar for the whole app window.
 *  The min button is purely cosmetic. The max (□) and close (×) buttons
 *  are real, but not via a prop/handler here — Desktop.tsx delegates clicks
 *  on `.win-max`/`.win-close` from the floating window that wraps whichever
 *  page rendered this title bar (see Desktop.tsx), so they only do
 *  anything (maximize/close that window) when the page is being shown as
 *  a Desktop window (Community, Profile). On pages that aren't wrapped
 *  that way (Editor), there's no listener above them, so the clicks are
 *  inert — same as min always is. The language switch lives here (rather
 *  than only in the editor's TopBar) because WinTitleBar is the one thing
 *  every page mounts — Landing, Community, Profile, and Editor — so
 *  putting it here means the language can be changed from anywhere, not
 *  just inside the editor. */
export function WinTitleBar() {
  const t = useT()
  const lang = useI18n((s) => s.lang)
  const setLang = useI18n((s) => s.setLang)
  return (
    <div className="win-titlebar">
      <span className="win-titlebar-icon">🖨</span>
      <span className="win-titlebar-title">{t('appTitle')} — {t('appSubtitle')}</span>
      <div className="win-titlebar-lang lang-switch">
        <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
        <button className={lang === 'ru' ? 'active' : ''} onClick={() => setLang('ru')}>RU</button>
      </div>
      <div className="win-titlebar-btns">
        <button type="button" tabIndex={-1} aria-hidden="true" title="_"><span className="win-ico win-ico-min" /></button>
        <button type="button" tabIndex={-1} aria-hidden="true" className="win-max" title="□"><span className="win-ico win-ico-max" /></button>
        <button type="button" tabIndex={-1} aria-hidden="true" className="win-close" title="×"><span className="win-ico win-ico-close" /></button>
      </div>
    </div>
  )
}
