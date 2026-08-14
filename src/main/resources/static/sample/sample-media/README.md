12문항 전용 미디어 폴더입니다.

- lottie: `public/sample-media/lottie/q01.lottie` ~ `q12.lottie`
- gif: `public/sample-media/gif/q01.gif` ~ `q12.gif`
- questions: 문항 번호별 최적화 메인·선택 이미지(`q01-main.webp`, `q01-option-1.webp` 등)
- 원본: `media-source/question-media/`에 재변환 가능한 원본 파일 보관

간이 문항 화면은 DB의 `media_url`보다 문항 번호별 `questions/` 매핑을 우선합니다.
10번과 12번은 기존 `gif/` 파일을 그대로 사용합니다.
