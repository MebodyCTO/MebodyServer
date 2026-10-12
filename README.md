# MEBODY Server

MEBODY Server는 웹 홈페이지, 웹 관리자, 운영 API를 담당하는 Spring Boot 서버입니다. 고객용 모바일 앱은 `../mebody-jjh` 에서 별도로 실행하고, 웹은 Vercel·안드로이드는 APK/AAB 로 나갑니다.

- 로컬 서버: http://localhost:8080
- 배포 서버: https://mebodyserver-production.up.railway.app
- 모바일 앱 배포: https://mebody-jjh.vercel.app/

## Repositories

- Server (this repo): https://github.com/MebodyCTO/MebodyServer
- Mobile (Vite app): https://github.com/chldngur89/mebody-jjh

## Responsibilities

- 웹 홈페이지 제공: `GET /`
- 웹 관리자 제공: `GET /admin`
- **앱의 회원가입·로그인·비밀번호 재설정·탈퇴** — 앱은 이 경로 없이는 계정 기능이 전부 막힙니다
- 관리자 회원 관리 API · 운영 지표(퍼널)
- 회원 프로필/요약 API
- 상품·판매자·주문·배송 API
- 전문가 콘솔과 전문가 API (초대·고객 결과·몸 기록·미션 배정)
- AdMob 보상형 서버 검증(SSV) 콜백
- Supabase Auth JWT 검증
- Supabase Postgres 직접 연결

정상 진단, 문항 로딩, 결과 계산은 모바일 앱과 Supabase가 담당합니다. 서버 장애가 고객 진단 흐름을 막으면 안 됩니다.

## Stack

- Java 17
- Spring Boot 3.3
- Spring Security OAuth2 Resource Server
- Spring Data JPA
- PostgreSQL / Supabase Postgres
- springdoc-openapi Swagger UI
- Maven

## Database Migration

Supabase SQL Editor에서 먼저 실행합니다.

```text
Server/db/supabase_v1_foundation.sql
```

이 migration은 기존 `user_profiles`를 `ALTER TABLE`로 확장합니다. 신규 테이블은 아래입니다.

- `body_bti_results`
- `missions`
- `user_mission_progress`
- `products`
- `admin_audit_logs`

회원 기본값:

- `role = MEMBER`
- `status = ACTIVE`
- `grade = BASIC`

## Environment Variables

```bash
cp .env.example .env
```

필수 값:

```env
SERVER_PORT=8080
FRONTEND_ORIGIN=https://mebody-jjh.vercel.app,http://localhost:3000,http://127.0.0.1:3000
MEBODY_APP_URL=https://mebody-jjh.vercel.app

SUPABASE_DB_URL=jdbc:postgresql://...
SUPABASE_DB_USERNAME=...
SUPABASE_DB_PASSWORD=...

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret
# 또는 SUPABASE_JWKS_URL=https://your-project-ref.supabase.co/auth/v1/.well-known/jwks.json

# 서버 전용. 프론트/Vite에 절대 넣지 않습니다.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Run

```bash
mvn spring-boot:run
```

접속:

- http://localhost:8080
- http://localhost:8080/admin
- http://localhost:8080/swagger-ui.html
- http://localhost:8080/api-docs

## Build

```bash
# 샘플 12문항 (/sample) — Railway는 Maven만 돌릴 수 있으므로 빌드 산출물 커밋 또는 배포 전 실행
npm run build:sample

mvn -DskipTests package
git diff --check
```

- `GET /sample` — 12문항 샘플 설문 (정적 `static/sample/`, `SecurityConfig`에서 `/sample/**` permitAll 필요)

## Main APIs

엔드포인트 62개입니다. 아래는 역할별 요약이고, 정본은 `src/main/java/**/*Controller.java` 입니다.

### Public — 토큰 없이 부를 수 있는 것

- `GET /api/public/health` · `GET /api/public/config`
- `GET /api/public/auth/config` — 이메일 확인 필요 여부 등 가입 정책
- `POST /api/public/auth/signup` · `POST /api/public/auth/login` · `POST /api/public/auth/reset`
- `POST /api/public/auth/approve` — 승인 대기 계정 해제. **확인 절차를 우회시키면 안 됩니다**(`verify:approve-guard`)
- `GET /api/public/professional/invite/{token}` — 초대 미리보기. 로그인 전에 "누가 불렀는지"만 보여줍니다
- `GET /api/products` · `GET /api/products/{id}`
- `GET /api/ads/admob/ssv` — AdMob 콜백. 인증 대신 **ECDSA 서명**으로 신뢰합니다

### Member

- `GET /api/me` · `PATCH /api/me` · `GET /api/me/summary` · `GET /api/me/missions` · `GET /api/me/body-bti`
- `DELETE /api/account` — 탈퇴. 주문·결제는 남기고 구매자 연결만 끊습니다(`db/journey/046`)
- `GET /api/ads/config` · `GET /api/billing/config`
- `POST /api/billing/subscription/verify` · `/cancel`
- `POST /api/billing/orders/{orderId}/confirm` · `/cancel`
- `GET /api/invites/relations` · `DELETE /api/invites/relations/{relationId}` — 연결된 전문가 조회·동의 철회
- `POST /api/invites/{token}/accept` — 초대 수락. **로그인한 본인만** 자기를 묶습니다

### Professional

전문가 본인과 **동의한 고객**만 보입니다. 동의를 거두면 그 순간부터 404 입니다.

- `GET /api/professional/me` · `/clients` · `/contents` · `/attention`
- `POST /api/professional/clients/invite` · `DELETE /api/professional/clients/{relationId}`
- `GET /api/professional/clients/{id}` · `/journey` · `/plan-input`
- `GET /api/professional/clients/{id}/body-notes` — 고객 몸 기록 **읽기만**
- `POST /api/professional/clients/{id}/body-notes/guidance` — 안내 남기기(고객 기록을 고치지 않습니다)
- `POST /api/professional/clients/{id}/missions` · `DELETE /api/professional/missions/{missionId}`

### Admin / Seller

- `GET /api/admin/me` · `/dashboard/summary` · `/users` · `/users/{id}` · `/storage/images`
- `GET /api/admin/metrics/funnels` — 퍼널. **칸마다 조건을 이어 붙입니다**(뒤 칸이 앞 칸의 부분집합이 아닙니다)
- `GET /api/admin/orders` · `POST /api/admin/orders/{id}/fulfillment` — 배송 단계
- `POST /api/admin/professionals` — 전문가 계정 발급
- `GET|POST|DELETE /api/admin/products` · `/api/seller/products` · `GET /api/seller/dashboard`

회원 삭제는 hard delete 가 아니라 `status=DELETED`, `deleted_at=now()` 처리합니다.

## CORS — 앱 웹뷰 주소를 빠뜨리지 마세요

허용 목록은 `SecurityConfig.corsConfigurationSource()` 가 만듭니다.

```
FRONTEND_ORIGIN (환경변수)
  + http://localhost:3000, http://127.0.0.1:3000   (개발 브라우저)
  + https://localhost                              (안드로이드 웹뷰 — 코드에 고정)
```

`https://localhost` 는 **환경변수가 아니라 코드**에 둡니다. 기기 안에서만 나오는 고정값이라
배포 설정에 맡기면 다음 환경에서 또 빠집니다. 실제로 빠져 있어서 **APK 안에서 회원가입·로그인·
비밀번호 재설정·탈퇴·전문가 초대가 전부 403** 이었습니다(2026-10-12). 웹에서는 멀쩡했습니다.

배포한 뒤 **운영 주소로 한 번 확인**하세요.

```bash
cd ../mebody-jjh && MEBODY_SERVER_BASE=https://mebodyserver-production.up.railway.app npm run verify:app-origin
```

iOS 를 내게 되면 `capacitor://localhost` 를 `APP_WEBVIEW_ORIGINS` 에 더합니다.

## Admin Latest Code Rule

관리자 회원 목록은 가능하면 `questionnaire_responses`의 최신 `completed` 결과를 우선 표시합니다. `user_profiles.body_bti_code`는 빠른 표시용 캐시이며, 두 값이 다르면 최신 완료 결과가 정본입니다.

## Operational Notes

- Railway 환경에서는 `PORT`가 주입되면 `SERVER_PORT`보다 우선합니다.
- `/api/public/config`의 `appUrl`은 `MEBODY_APP_URL=https://mebody-jjh.vercel.app` 기준으로 반환되어야 합니다.
- 홈페이지 CTA는 Vercel 모바일 앱으로 이동해야 합니다.
- 정적 페이지(`/`, `/privacy`, `/terms`, `sitemap.xml`, `robots.txt`)의 검색 노출 문자열은
  **손으로 고치지 않습니다.** `node scripts/build-seo.js` 가 한 곳에서 만듭니다.
- `SUPABASE_SERVICE_ROLE_KEY`는 서버에서만 사용합니다.
