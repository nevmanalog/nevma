import { useRoute } from '@/state/route'
import { useT } from '@/i18n'

export type CommunityTab = 'feed' | 'presets' | 'collections' | 'users' | 'activity'

const TABS: { id: CommunityTab; icon: string; labelKey: 'navFeed' | 'navPresets' | 'navCollections' | 'navUsers' | 'navActivity' }[] = [
  { id: 'feed', icon: '🏠', labelKey: 'navFeed' },
  { id: 'presets', icon: '🗂', labelKey: 'navPresets' },
  { id: 'collections', icon: '📁', labelKey: 'navCollections' },
  { id: 'users', icon: '👥', labelKey: 'navUsers' },
  { id: 'activity', icon: '🔔', labelKey: 'navActivity' },
]

/** Top toolbar shared by every community page — matches the reference
 *  design's tab strip + search box. Only "Feed" is wired to a real page;
 *  the rest are shown for the full picture but aren't built yet, so they're
 *  inert (title="Coming soon") instead of pretending to work. */
export function CommunityNav({
  active, search, onSearch,
}: {
  active: CommunityTab
  search?: string
  onSearch?: (v: string) => void
}) {
  const t = useT()
  const navigate = useRoute((s) => s.navigate)

  return (
    <div className="community-nav">
      <div className="community-nav-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`community-nav-tab${active === tab.id ? ' community-nav-tab-active' : ''}${tab.id === 'feed' ? '' : ' community-nav-tab-locked'}`}
            title={tab.id === 'feed' ? undefined : t('navComingSoon')}
            onClick={() => { if (tab.id === 'feed') navigate('community') }}
          >
            <span className="community-nav-tab-icon">{tab.icon}</span>
            <span>{t(tab.labelKey)}</span>
            {tab.id !== 'feed' && <span className="community-nav-tab-lock">🔒</span>}
          </button>
        ))}
      </div>
      {onSearch && (
        <input
          className="community-nav-search"
          type="text"
          value={search ?? ''}
          onChange={(ev) => onSearch(ev.target.value)}
          placeholder={`🔍 ${t('searchPlaceholder')}`}
        />
      )}
    </div>
  )
}
