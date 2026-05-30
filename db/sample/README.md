# MEBODY 샘플 설문 Supabase 마이그레이션

Supabase SQL Editor에서 **순서대로** 실행하세요.

| 파일 | 내용 |
|------|------|
| `001_add_question_set.sql` | `questions.question_set`, `media_type`, `media_url` |
| `002_add_response_mode.sql` | `questionnaire_responses.response_mode` |
| `003_seed_sample_questions.sql` | 12문항 시드 (`sample_subjective_v1`) |
| `004_sample_completion_content.sql` | (선택) 완료 CTA 테이블 — 후속 |

앱 53문항(`v3_full`)에는 영향 없도록 `question_set`으로 분리합니다.

RLS: `questionnaire_responses`에 `response_mode = 'sample'` anon insert 정책이 필요할 수 있습니다.
