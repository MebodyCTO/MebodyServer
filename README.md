# MEBODY Server

MEBODY Server는 웹 홈페이지, 웹 관리자, 운영 API를 담당하는 Spring Boot 서버입니다. 고객용 모바일 진단 앱은 `../mebody`에서 별도로 실행하고 Vercel에 배포합니다.

- 로컬 서버: http://localhost:8080
- 배포 서버: https://mebody-server-production.up.railway.app
- 모바일 앱 배포: https://mebody-jjh.vercel.app/

## Repositories

- Server (this repo): https://github.com/chldngur89/mebody-server
- Mobile (Vite app): https://github.com/chldngur89/mebody-jjh

## Responsibilities

- 웹 홈페이지 제공: `GET /`
- 웹 관리자 제공: `GET /admin`
- 관리자 회원 관리 API
- 회원 프로필/요약 API
- 상품/판매자 shell API
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

### Public

- `GET /api/public/config`
- `POST /api/public/auth/signup`

### Member

- `GET /api/me`
- `PATCH /api/me`
- `GET /api/me/body-bti`
- `GET /api/me/missions`
- `GET /api/me/summary`

### Admin

모두 `ADMIN`만 접근 가능합니다.

- `GET /api/admin/me`
- `GET /api/admin/dashboard/summary`
- `GET /api/admin/users`
- `GET /api/admin/users/{id}`
- `POST /api/admin/users`
- `PATCH /api/admin/users/{id}`
- `DELETE /api/admin/users/{id}`
- `GET /api/admin/storage/images`

회원 삭제는 hard delete가 아니라 `status=DELETED`, `deleted_at=now()` 처리합니다.

### Products / Seller

- `GET /api/products`
- `GET /api/products/{id}`
- `GET /api/seller/dashboard`

판매/결제/주문은 현재 shell입니다.

## Admin Latest Code Rule

관리자 회원 목록은 가능하면 `questionnaire_responses`의 최신 `completed` 결과를 우선 표시합니다. `user_profiles.body_bti_code`는 빠른 표시용 캐시이며, 두 값이 다르면 최신 완료 결과가 정본입니다.

## Operational Notes

- Railway 환경에서는 `PORT`가 주입되면 `SERVER_PORT`보다 우선합니다.
- `/api/public/config`의 `appUrl`은 `MEBODY_APP_URL=https://mebody-jjh.vercel.app` 기준으로 반환되어야 합니다.
- 홈페이지 CTA는 Vercel 모바일 앱으로 이동해야 합니다.
- `SUPABASE_SERVICE_ROLE_KEY`는 서버에서만 사용합니다.
