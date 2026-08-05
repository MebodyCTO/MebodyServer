/** MEBODY 홈페이지 — 같은 오리진 `/` (로컬·커스텀 도메인·Railway 공통) */
export const HOMEPAGE_URL = import.meta.env.VITE_HOMEPAGE_URL?.trim() || '/'

/** MEBODY 앱 서비스 (mebody-jjh) */
export const APP_URL =
  import.meta.env.VITE_APP_URL?.trim() || 'https://mebody-jjh.vercel.app'

/** 샘플 완료 CTA → Auth 회원가입 탭 직행 */
export const APP_SIGNUP_URL = `${APP_URL.replace(/\/$/, '')}/?ui=auth&mode=signup`
