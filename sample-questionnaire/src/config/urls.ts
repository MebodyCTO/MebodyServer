/** MEBODY 홈페이지 — 실제 배포 도메인으로 고정 (커스텀 도메인 연결 시 VITE_HOMEPAGE_URL로 덮어쓰기) */
export const HOMEPAGE_URL =
  import.meta.env.VITE_HOMEPAGE_URL?.trim() || 'https://mebodyserver-production.up.railway.app/'

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
  'https://docs.google.com/forms/d/e/1FAIpQLSdAkJJEhkheh5577K_0SqHVQZtpEtD5ILNDIlIt02hv_5AHTg/viewform'
