/** Placeholder feed content. Replace with real `posts`/`comments` table
 *  queries once Supabase is configured — see AGENTS/README note near
 *  Community.tsx for the schema this shape is meant to match. */
export interface MockPost {
  id: string
  author: string
  avatarUrl: string | null
  title: string
  previewUrl: string | null
  likes: number
  commentCount: number
  createdAt: string
}

export const MOCK_POSTS: MockPost[] = [
  {
    id: 'p1',
    author: 'analog_maria',
    avatarUrl: null,
    title: 'Полароид-пресет для летних фото',
    previewUrl: null,
    likes: 24,
    commentCount: 5,
    createdAt: '2026-08-20',
  },
  {
    id: 'p2',
    author: 'oldpaper_dan',
    avatarUrl: null,
    title: 'Пожелтевшая бумага + подпалины по краям',
    previewUrl: null,
    likes: 11,
    commentCount: 2,
    createdAt: '2026-08-22',
  },
  {
    id: 'p3',
    author: 'nevma_fan',
    avatarUrl: null,
    title: 'Мой первый пресет — царапины и пыль',
    previewUrl: null,
    likes: 3,
    commentCount: 0,
    createdAt: '2026-08-24',
  },
]
