import { useEffect, useState } from 'react'
import { useUi, type TopStage } from '@/state/ui'
import { useT } from '@/i18n'
import type { TKey } from '@/i18n/dict'

/** Content for each stage's one-time intro card. Adding a new stage or a new
 *  card elsewhere in the app is just another entry here + a `titleKey` /
 *  `bodyKey` / `buttonKey` pair in the dictionary — no new logic needed. */
export const STAGE_INTRO: Record<TopStage, { titleKey: TKey; bodyKey: TKey; buttonKey: TKey }> = {
  upload: { titleKey: 'stageUpload', bodyKey: 'introUploadBody', buttonKey: 'introUploadButton' },
  print: { titleKey: 'stagePrint', bodyKey: 'introPrintBody', buttonKey: 'introPrintButton' },
  workshop: { titleKey: 'stageWorkshop', bodyKey: 'introWorkshopBody', buttonKey: 'introWorkshopButton' },
  scan: { titleKey: 'stageScan', bodyKey: 'introScanBody', buttonKey: 'introScanButton' },
  final: { titleKey: 'stageFinal', bodyKey: 'introFinalBody', buttonKey: 'introFinalButton' },
}

/** Small card shown the first time the user opens a given top-stage.
 *  Purely informational — it never blocks the interface underneath and
 *  closing it (either way, "×" or the primary button) always lets work
 *  continue immediately. Without the checkbox it stays closed for the rest
 *  of this session (any stage, in any order) but comes back after a page
 *  reload; with it, `markIntroSeen` silences it for good. */
export function StageIntro() {
  const topStage = useUi((s) => s.topStage)
  const introSeen = useUi((s) => s.introSeen)
  const markIntroSeen = useUi((s) => s.markIntroSeen)
  const t = useT()
  const [dontShow, setDontShow] = useState(false)
  // Stages dismissed-for-now without checking the box, kept for the whole
  // session (not persisted) so switching between several stages doesn't
  // bring earlier cards back.
  const [dismissed, setDismissed] = useState<Partial<Record<TopStage, true>>>({})

  useEffect(() => { setDontShow(false) }, [topStage])

  const visible = !introSeen[topStage] && !dismissed[topStage]
  if (!visible) return null

  const info = STAGE_INTRO[topStage]

  const close = () => {
    if (dontShow) markIntroSeen(topStage)
    else setDismissed((d) => ({ ...d, [topStage]: true }))
  }

  return (
    <div className="stage-intro-overlay">
      <div className="stage-intro-card">
        <button className="stage-intro-close" onClick={close} aria-label="Close">✕</button>
        <h2 className="stage-intro-title">{t(info.titleKey)}</h2>
        <div className="stage-intro-body">
          {t(info.bodyKey).split('\n\n').map((para, i) => <p key={i}>{para}</p>)}
        </div>
        <div className="stage-intro-actions">
          <label className="welcome-dontshow">
            <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
            {t('introDontShow')}
          </label>
          <button className="welcome-start" onClick={close}>{t(info.buttonKey)}</button>
        </div>
      </div>
    </div>
  )
}

