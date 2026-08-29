import { useT, useI18n } from '@/i18n'

/** Decorative Windows-XP-style title bar for the whole app window.
 *  The min/max/close buttons are purely cosmetic and don't do anything —
 *  they just complete the classic "program window" look the app is themed
 *  as. The language switch lives here (rather than only in the editor's
 *  TopBar) because WinTitleBar is the one thing every page mounts —
 *  Landing, Community, Profile, and Editor — so putting it here means
 *  the language can be changed from anywhere, not just inside the editor. */
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
        <button type="button" tabIndex={-1} aria-hidden="true" title="□"><span className="win-ico win-ico-max" /></button>
        <button type="button" tabIndex={-1} aria-hidden="true" className="win-close" title="×"><span className="win-ico win-ico-close" /></button>
      </div>
    </div>
  )
}
