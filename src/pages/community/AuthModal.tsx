import { useState } from 'react'
import { useT, type TKey } from '@/i18n'
import { useAuth } from '@/state/auth'
import { PrivacyPolicyModal } from './PrivacyPolicyModal'

/** Rendered once, globally, near the top of the app (see App.tsx) — not
 *  inside AuthWidget — because it can be triggered from any page (e.g. the
 *  Profile page's "Follow" button) whether or not AuthWidget itself is
 *  mounted there. Visibility is entirely store-driven (authModalOpen). */
export function AuthModal() {
  const t = useT()
  const open = useAuth((s) => s.authModalOpen)
  const close = useAuth((s) => s.closeAuthModal)
  const signInWithPassword = useAuth((s) => s.signInWithPassword)
  const signUpWithPassword = useAuth((s) => s.signUpWithPassword)

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)
  // Only required/shown for sign-up — signing back in doesn't ask for fresh
  // consent, since it was already given the one time the account was created.
  const [agreed, setAgreed] = useState(false)
  const [policyOpen, setPolicyOpen] = useState(false)

  if (!open) return null

  const reset = () => { setEmail(''); setPassword(''); setError(null); setCheckEmail(false); setBusy(false); setAgreed(false) }
  const switchMode = (m: 'signin' | 'signup') => { setMode(m); setError(null); setCheckEmail(false) }
  const handleClose = () => { close(); reset() }

  const submit = async () => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) { setError(t('authFillBothFields')); return }
    if (mode === 'signup' && password.length < 6) { setError(t('authPasswordTooShort')); return }
    if (mode === 'signup' && !agreed) { setError(t('authMustAgree')); return }

    setBusy(true)
    setError(null)
    try {
      if (mode === 'signin') {
        await signInWithPassword(trimmedEmail, password)
        // On success the store closes the modal itself (session lands via
        // onAuthStateChange); nothing else to do here.
      } else {
        const { needsEmailConfirmation } = await signUpWithPassword(trimmedEmail, password)
        if (needsEmailConfirmation) setCheckEmail(true)
        // else: Confirm-email is off on this project, session arrives
        // immediately via onAuthStateChange and the modal closes on its own.
      }
    } catch (err) {
      setError(mapAuthError(err, t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="welcome-overlay" onClick={handleClose}>
      <div className="np-card onboarding-card" onClick={(e) => e.stopPropagation()}>
        {checkEmail ? (
          <>
            <h2>{t('authCheckEmailTitle')}</h2>
            <p className="onboarding-body">{t('authCheckEmailBody')}</p>
            <div className="onboarding-actions">
              <button className="onboarding-submit" onClick={handleClose}>{t('ok')}</button>
            </div>
          </>
        ) : (
          <>
            <div className="auth-modal-tabs">
              <button
                type="button"
                className={mode === 'signin' ? 'auth-modal-tab auth-modal-tab-active' : 'auth-modal-tab'}
                onClick={() => switchMode('signin')}
              >
                {t('authTabSignIn')}
              </button>
              <button
                type="button"
                className={mode === 'signup' ? 'auth-modal-tab auth-modal-tab-active' : 'auth-modal-tab'}
                onClick={() => switchMode('signup')}
              >
                {t('authTabSignUp')}
              </button>
            </div>

            <input
              className="onboarding-input auth-modal-field"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('authEmailPlaceholder')}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            <input
              className="onboarding-input auth-modal-field"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('authPasswordPlaceholder')}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />

            {error && <p className="onboarding-error">{error}</p>}

            {mode === 'signup' && (
              <label className="auth-consent">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span>
                  {t('authAgreePrefix')}
                  <button type="button" className="auth-consent-link" onClick={() => setPolicyOpen(true)}>
                    {t('authAgreePolicyLink')}
                  </button>
                  {t('authAgreeSuffix')}
                </span>
              </label>
            )}

            <div className="onboarding-actions">
              <button className="onboarding-cancel" disabled={busy} onClick={handleClose}>{t('cancel')}</button>
              <button className="onboarding-submit" disabled={busy || (mode === 'signup' && !agreed)} onClick={submit}>
                {busy ? t('saving') : mode === 'signin' ? t('authTabSignIn') : t('authTabSignUp')}
              </button>
            </div>
          </>
        )}
      </div>

      {policyOpen && <PrivacyPolicyModal onClose={() => setPolicyOpen(false)} />}
    </div>
  )
}

/** Supabase's error messages are plain English and meant for developers, not
 *  end users — translate the common ones, fall back to a generic message for
 *  anything else rather than showing raw API text. */
function mapAuthError(err: unknown, t: (key: TKey) => string): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/invalid login credentials/i.test(msg)) return t('authInvalidCredentials')
  if (/user already registered/i.test(msg)) return t('authUserAlreadyRegistered')
  if (/password should be at least/i.test(msg)) return t('authPasswordTooShort')
  if (/rate limit/i.test(msg)) return t('authRateLimited')
  return t('authGenericError')
}
