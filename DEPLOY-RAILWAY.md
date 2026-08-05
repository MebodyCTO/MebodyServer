# Railway 배포 — /sample 이 안 열릴 때

## 진단 (2026-05-30 확인)

| 위치 | 푸터 「샘플 코드」 | `/sample` | `data-app-url` |
|------|-------------------|-----------|----------------|
| **GitHub main** | ✅ 있음 | ✅ static 포함 | `mebody-jjh.vercel.app` |
| **프로덕션 Railway** | ❌ 없음 | ❌ **401 Bearer** | `127.0.0.1:3000` (구버전) |

→ **Git push는 됐지만 Railway가 예전 JAR(약 3주 전 `port modify`)을 계속 서빙 중**입니다.

## Railway에서 할 일

### 0. Free 플랜: Serverless 필수

에러:

```text
Free plan deployments must be serverless. Please go to your service settings and turn on the serverless flag.
```

해결:

1. Railway → **mebody-server** 서비스 → **Settings**
2. **Deploy** / **Scale** 섹션에서 **Serverless** 켜기
3. 일반 Redeploy가 아니라 **Cmd/Ctrl + K** → **Deploy latest commit**
4. 이미 켜져 있는데도 실패하면: Serverless **끄기 → 배포 1회(실패 가능) → 다시 켜기 → Deploy latest commit**

참고: Free 플랜은 리전 로컬 시간 **08:00–20:00 peak**에 배포가 막힐 수 있습니다. 그때는 peak 밖 시간에 재배포하거나 Hobby로 올리면 됩니다.

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
SUPABASE_JWKS_URL=https://YOUR_PROJECT.supabase.co/auth/v1/.well-known/jwks.json
# Direct(db.*)는 IPv6-only인 경우가 많음 → Session/Transaction pooler 사용
SUPABASE_DB_URL=jdbc:postgresql://aws-1-REGION.pooler.supabase.com:6543/postgres?sslmode=require
SUPABASE_DB_USERNAME=postgres.YOUR_PROJECT_REF
SUPABASE_DB_PASSWORD=...
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`MEBODY_APP_URL`이 비어 있으면 예전 코드에서 앱 링크가 `127.0.0.1:3000`으로 나갈 수 있습니다.

- JWT 검증을 위해 `SUPABASE_JWKS_URL` 또는 `SUPABASE_JWT_SECRET` 중 하나는 반드시 설정합니다.
- DB URL은 Railway에서 접근 가능한 Supabase Session/Transaction pooler 주소와 SSL 옵션을 사용합니다.

### 5. Healthcheck failure

증상: Build/Deploy 성공 후 **Network → Healthcheck failure**.  
엣지 응답이 `Application not found` / `x-railway-fallback: true` 이면 **앱이 살아 있지 않은 상태**입니다.

확인 순서:

1. **Deploy Logs**(Build Logs 아님)에서 `Started MebodyApplication` / JDBC `FATAL` / `Connection` 에러 여부
2. Variables의 `SUPABASE_DB_URL`이 **pooler**인지 (Direct `db.*.supabase.co`면 실패하기 쉬움)
3. `railway.toml`의 `healthcheckPath = "/health"`를 유지하고 `/health`가 HTTP 200을 반환하는지 확인
4. 임시로 Healthcheck를 비활성화해야 하면 TOML에서 `healthcheckPath` 항목 자체를 삭제 (`null`은 TOML 문법이 아님)
5. `PORT`는 Railway가 주입 — 코드는 `server.port=${PORT:...}`, `server.address=0.0.0.0` 사용

대시보드 즉시 우회:

1. Service → **Settings** → Healthcheck path가 Config as Code의 `/health`와 일치하는지 확인
2. **Cmd+K → Deploy latest commit**
3. Deploy Logs에 `Started MebodyApplication` 나오는지 확인

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
