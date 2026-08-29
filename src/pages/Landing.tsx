import { WinTitleBar } from '@/app/panels/WinTitleBar'
import { StatusBar } from '@/app/panels/StatusBar'
import { SocialLinks } from '@/app/panels/SocialLinks'
import { useT } from '@/i18n'
import { useRoute } from '@/state/route'
import logoUrl from '@/assets/nevma-logo.png'

/** Public entry point. Styled as the same fake-OS window as the editor
 *  (WinTitleBar + xp-face chrome) so there's no jarring style switch when
 *  moving between Landing → Community → Editor — just different content
 *  inside the same window frame. Compact single-screen layout matching the
 *  reference design: logo/title, an "about" box, two choice cards, status
 *  bar. */
export function Landing() {
  const t = useT()
  const navigate = useRoute((s) => s.navigate)

  return (
    <div className="landing-window">
      <WinTitleBar />
      <div className="landing-scroll">
        <header className="landing-hero landing-hero-compact">
          <img className="landing-logo landing-logo-compact" src={logoUrl} alt="Nevma" />
          <h1 className="landing-title landing-title-compact">{t('landingHeroTitle')}</h1>
        </header>

        <section className="landing-about sunk-in">
          <h2 className="landing-section-title">{t('landingAboutTitle')}</h2>
          <p>{t('landingAboutBody1')}</p>
          <p>{t('landingAboutBody2')}</p>
          <p>{t('landingAboutBody3')}</p>
        </section>

        <section className="landing-choice">
          <button className="landing-choice-card landing-choice-card-primary raised-out" onClick={() => navigate('editor')}>
            <span className="landing-choice-badge">{t('landingRecommended')}</span>
            <span className="landing-choice-icon">✂</span>
            <span className="landing-choice-title">{t('landingChooseEditor')}</span>
            <span className="landing-choice-body">{t('landingChooseEditorBody')}</span>
            <span className="landing-choice-arrow">→</span>
          </button>
          <button className="landing-choice-card landing-choice-card-secondary raised-out" onClick={() => navigate('community')}>
            <span className="landing-choice-icon">🌐</span>
            <span className="landing-choice-title">{t('landingChooseCommunity')}</span>
            <span className="landing-choice-body">{t('landingChooseCommunityBody')}</span>
            <span className="landing-choice-arrow">→</span>
          </button>
        </section>

        <footer className="landing-footer">
          <SocialLinks variant="corner" />
        </footer>
      </div>
      <StatusBar />
    </div>
  )
}
