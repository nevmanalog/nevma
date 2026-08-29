import { useT } from '@/i18n'
import { useAuth } from '@/state/auth'
import { useRoute } from '@/state/route'
import { isSupabaseConfigured } from '@/lib/supabase'
import { ProfileForm } from './ProfileForm'

/** Sign-in button when signed out, small profile chip + sign-out when
 *  signed in. Renders the "pick a nickname" onboarding modal itself right
 *  after a first-ever confirmed sign-up, since every screen that shows this
 *  widget needs that flow to complete before anything account-gated works.
 *  The sign-in/sign-up form itself lives in AuthModal — mounted once at the
 *  app level, not here — since it can be triggered from pages that don't
 *  render this widget (see state/auth.ts's authModalOpen). */
export function AuthWidget() {
  const t = useT()
  const { user, profile, needsOnboarding, signOut } = useAuth()
  const openAuthModal = useAuth((s) => s.openAuthModal)
  const openProfile = useRoute((s) => s.openProfile)

  if (!isSupabaseConfigured) {
    return <span className="auth-widget-disabled" title={t('authNotConfiguredHint')}>{t('authNotConfigured')}</span>
  }

  if (user && needsOnboarding) return <OnboardingModal />

  if (user && profile) {
    return (
      <div className="auth-widget-chip">
        <button className="auth-widget-identity" onClick={() => openProfile(user.id)}>
          {profile.avatarUrl && <img className="auth-widget-avatar" crossOrigin="anonymous" src={profile.avatarUrl} alt="" />}
          <span className="auth-widget-name">{profile.displayName}</span>
        </button>
        <button className="auth-widget-signout" onClick={() => signOut()}>{t('signOut')}</button>
      </div>
    )
  }

  return (
    <button className="auth-widget-signin" onClick={openAuthModal}>
      {t('signIn')}
    </button>
  )
}

function OnboardingModal() {
  const t = useT()
  const { user, saveProfile } = useAuth()

  return (
    <div className="welcome-overlay">
      <div className="np-card onboarding-card">
        <h2>{t('onboardingTitle')}</h2>
        <p className="onboarding-body">{t('onboardingBody')}</p>
        <ProfileForm
          userId={user?.id ?? ''}
          initialName=""
          initialAvatarUrl={null}
          submitLabel={t('onboardingContinue')}
          onSubmit={saveProfile}
        />
      </div>
    </div>
  )
}
