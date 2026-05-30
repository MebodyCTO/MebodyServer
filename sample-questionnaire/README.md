# MEBODY 샘플 12문항 (홈페이지)

홈페이지 `/sample` 에서 제공하는 12문항 주관적 체크 UI입니다.

## 로컬 개발

```bash
cd sample-questionnaire
npm install
npm run dev            # http://localhost:5174/sample/
```

캐릭터는 `src/assets/character.gif` + `character.lottie` 를 **Vite 번들**로 즉시 표시합니다 (DB 불필요).

DB 연동 시 `.env`에 추가:

```
VITE_USE_SUPABASE_QUESTIONS=true
VITE_USE_SUPABASE_SUBMIT=true
```

## 빌드 (static 출력)

```bash
npm run build
# → ../src/main/resources/static/sample/
```

루트에서: `npm run build:sample`

## Supabase

`../db/sample/` 의 SQL을 001 → 003 순으로 실행하세요.

## 앱 이식

- `LottieCharacter.tsx` + `QuestionMediaLayout.tsx` → mebody-jjh `QuestionnaireScreen` 상단 미디어 영역
