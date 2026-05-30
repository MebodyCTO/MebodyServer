-- 001: questions 테이블 확장 (additive)
-- Supabase SQL Editor에서 001 → 002 → 003 순서로 실행

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS question_set text DEFAULT 'v3_full';

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS media_type text;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS media_url text;

CREATE INDEX IF NOT EXISTS questions_set_active_idx
  ON public.questions (question_set, is_active, sort_order);

COMMENT ON COLUMN public.questions.question_set IS 'v3_full | sample_subjective_v1 등 문항 세트 구분';
COMMENT ON COLUMN public.questions.media_type IS 'lottie | image | none';
COMMENT ON COLUMN public.questions.media_url IS '문항 상단 미디어 경로';
