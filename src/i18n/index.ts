import { create } from 'zustand'
import { DICT, type Lang, type TKey } from './dict'

interface I18nState {
  lang: Lang
  setLang: (l: Lang) => void
}

export const useI18n = create<I18nState>((set) => ({
  lang: (localStorage.getItem('lang') as Lang) || 'en',
  setLang: (l) => {
    localStorage.setItem('lang', l)
    set({ lang: l })
  },
}))

/** Hook returning a translate function bound to the current language. */
export function useT() {
  const lang = useI18n((s) => s.lang)
  return (key: TKey) => DICT[key][lang]
}

export type { Lang, TKey }
