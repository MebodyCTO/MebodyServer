/** MEBODY 홈페이지 (mebody-server) */
export const HOMEPAGE_URL =
  import.meta.env.VITE_HOMEPAGE_URL?.trim() ||
  'https://mebody-server-production.up.railway.app'

/** MEBODY 앱 서비스 (mebody-jjh) */
export const APP_URL =
  import.meta.env.VITE_APP_URL?.trim() || 'https://mebody-jjh.vercel.app'
