-- 002: questionnaire_responses 확장 (additive)

ALTER TABLE public.questionnaire_responses
  ADD COLUMN IF NOT EXISTS response_mode text DEFAULT 'full';

COMMENT ON COLUMN public.questionnaire_responses.response_mode IS 'full | sample';

CREATE INDEX IF NOT EXISTS questionnaire_responses_mode_idx
  ON public.questionnaire_responses (response_mode, completed_at DESC);
