-- 004: (후속) 샘플 완료 페이지 코드별 CTA — 이번 UI 범위外, 테이블만 준비

CREATE TABLE IF NOT EXISTS public.sample_completion_content (
  body_code text PRIMARY KEY,
  headline text NOT NULL,
  description text NOT NULL,
  app_cta_label text DEFAULT '앱에서 전체 진단 시작하기',
  app_cta_url text DEFAULT 'https://mebody-jjh.vercel.app',
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.sample_completion_content IS '홈페이지 샘플 설문 완료 후 코드별 안내 문구 (후속 적용)';
