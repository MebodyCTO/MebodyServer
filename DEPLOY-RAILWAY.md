# Railway 배포 — /sample 이 안 열릴 때

## 진단 (2026-05-30 확인)

| 위치 | 푸터 「샘플 코드」 | `/sample` | `data-app-url` |
|------|-------------------|-----------|----------------|
| **GitHub main** | ✅ 있음 | ✅ static 포함 | `mebody-jjh.vercel.app` |
| **프로덕션 Railway** | ❌ 없음 | ❌ **401 Bearer** | `127.0.0.1:3000` (구버전) |

→ **Git push는 됐지만 Railway가 예전 JAR(약 3주 전 `port modify`)을 계속 서빙 중**입니다.

## Railway에서 할 일

### 1. GitHub 연결 확인

**Settings → Source**

- Repository: `chldngur89/mebody-server`
- Branch: **`main`**
- **Wait for CI** / Auto deploy: **켜기**

### 2. 수동 재배포

**Deployments → Deploy** (또는 ⋯ → Redeploy)

- 커밋 메시지가 **`server`** 또는 **`fix:`** 등 **최신**인지 확인
- ACTIVE가 `port modify` (3 weeks ago)면 **아직 예전 버전**

### 3. 빌드 로그 확인

성공 시 대략:

```text
mvn -DskipTests package
java -jar target/mebody-server-0.1.0.jar
```

`BUILD SUCCESS` 후 서비스 시작.

### 4. 환경 변수 (Variables)

필수:

```env
MEBODY_APP_URL=https://mebody-jjh.vercel.app
FRONTEND_ORIGIN=https://mebody-jjh.vercel.app,http://localhost:3000
SUPABASE_JWT_SECRET=...  (또는 SUPABASE_JWKS_URL)
SUPABASE_DB_URL=...
SUPABASE_DB_USERNAME=...
SUPABASE_DB_PASSWORD=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

`MEBODY_APP_URL`이 비어 있으면 예전 코드에서 앱 링크가 `127.0.0.1:3000`으로 나갈 수 있습니다.

## 배포 성공 확인

```bash
# 1) 푸터에 샘플 코드
curl -sL https://mebody-server-production.up.railway.app/ | grep "샘플 코드"

# 2) /sample 200 (401 아님)
curl -sI https://mebody-server-production.up.railway.app/sample | head -1
# HTTP/2 200

# 3) 샘플 HTML
curl -sI https://mebody-server-production.up.railway.app/sample/index.html | head -1
```

## 로컬에서 Spring Boot 없이 static만

```bash
./scripts/local-verify-static.sh
# http://127.0.0.1:8080/sample/
```

## 로컬 Spring Boot

```bash
cp .env.example .env   # 값 채우기
mvn spring-boot:run
# http://localhost:8080/sample
```

## 코드 구조 (참고)

- 샘플 **소스**: `sample-questionnaire/` (React)
- 샘플 **배포 파일**: `src/main/resources/static/sample/` (Git에 포함, Maven JAR에 포함)
- Security: `/api/**`만 JWT, **그 외(`/sample` 포함) 공개**

샘플 소스 수정 후:

```bash
npm run build:sample
git add src/main/resources/static/sample/
git commit && git push
```
