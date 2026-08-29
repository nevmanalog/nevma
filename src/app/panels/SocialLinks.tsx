import { useT } from '@/i18n'

export const SOCIAL_LINKS = [
  { id: 'telegram', icon: '📨', label: 'Telegram', url: 'https://t.me/nevma_analog' },
  { id: 'instagram', icon: '📷', label: 'Instagram', url: 'https://www.instagram.com/nevma_analog' },
  { id: 'tiktok', icon: '🎵', label: 'TikTok', url: 'https://www.tiktok.com/@nevma_analog' },
] as const

/**
 * `variant="corner"` — a small permanent badge fixed to a corner of the app.
 * `variant="export"` — the same links with a thank-you line, for the bottom
 * of the export dialog.
 */
export function SocialLinks({ variant }: { variant: 'corner' | 'export' }) {
  const t = useT()

  if (variant === 'corner') {
    return (
      <div className="social-corner" aria-label="social links">
        {SOCIAL_LINKS.map((s) => (
          <a key={s.id} className="social-corner-link" href={s.url} target="_blank" rel="noopener noreferrer" data-tip={s.label}>
            {s.icon}
          </a>
        ))}
      </div>
    )
  }

  return (
    <div className="export-social">
      <p className="export-social-hint">{t('socialFollowHint')}</p>
      <div className="export-social-links">
        {SOCIAL_LINKS.map((s) => (
          <a key={s.id} className="export-social-link" href={s.url} target="_blank" rel="noopener noreferrer">
            <span className="export-social-icon">{s.icon}</span>
            <span>{s.label}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
