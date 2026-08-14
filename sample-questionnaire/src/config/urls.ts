/** MEBODY 홈페이지 — 같은 오리진 `/` (로컬·커스텀 도메인·Railway 공통) */
export const HOMEPAGE_URL = import.meta.env.VITE_HOMEPAGE_URL?.trim() || '/'

/** MEBODY 앱 서비스 (mebody-jjh) */
export const APP_URL =
  import.meta.env.VITE_APP_URL?.trim() || 'https://mebody-jjh.vercel.app'

/** 샘플 완료 CTA → Auth 회원가입 탭 직행 */
export const APP_SIGNUP_URL = `${APP_URL.replace(/\/$/, '')}/?ui=auth&mode=signup`

/**
 * 샘플 완료 CTA → 구글 폼 유도
 * 폼 URL이 바뀌면 이 값만 교체하면 된다 (또는 VITE_SAMPLE_RESULT_FORM_URL 환경변수로 배포 시 덮어쓰기 가능).
 */
export const SAMPLE_RESULT_FORM_URL =
  import.meta.env.VITE_SAMPLE_RESULT_FORM_URL?.trim() ||
  'https://docs.google.com/forms/d/e/1FAIpQLSfQyJ5UwkOYICfq-HPGR0f6CqbaDjmmu6nPgWsfz6XFb_0Vsg/viewform'
