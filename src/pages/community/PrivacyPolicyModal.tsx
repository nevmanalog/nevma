import { useT } from '@/i18n'

/**
 * Read-only overlay showing the Privacy Policy text (see the `privacyPolicy*`
 * keys in i18n/dict.ts). Opened from the consent checkbox in AuthModal's
 * sign-up form; rendered on top of AuthModal (higher z-index — see
 * .privacy-policy-overlay in index.css) so both stay visible/dismissable
 * independently.
 */
export function PrivacyPolicyModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const paragraphs = t('privacyPolicyBody').split('\n\n')

  return (
    <div className="welcome-overlay privacy-policy-overlay" onClick={(e) => { e.stopPropagation(); onClose() }}>
      <div className="np-card privacy-policy-card" onClick={(e) => e.stopPropagation()}>
        <h2>{t('privacyPolicyTitle')}</h2>
        <p className="privacy-policy-updated">{t('privacyPolicyUpdated')}</p>
        <div className="privacy-policy-body">
          {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <div className="onboarding-actions">
          <button className="onboarding-submit" onClick={onClose}>{t('privacyPolicyClose')}</button>
        </div>
      </div>
    </div>
  )
}
