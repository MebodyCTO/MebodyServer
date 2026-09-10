# Confirm email + SMTP 설정 체크리스트

홈페이지·앱(jjh) 회원가입은 **Supabase Auth**가 인증 메일을 보냅니다. 서버 Spring Boot가 메일을 보내지 않습니다.

## 1. Supabase Auth 기본

Dashboard → **Authentication** → **Providers** → Email

- **Confirm email**: **ON** (유지)
- **Secure email change**: 권장 ON

## 2. Custom SMTP (필수에 가깝음)

기본 내장 메일은 한도·스팸 이슈가 많습니다. **Authentication → Emails → SMTP Settings**에서 Custom SMTP를 켭니다.

준비할 값:

| 항목 | 예시 | 비고 |
|------|------|------|
| Sender email | `noreply@yourdomain.com` | 도메인 메일 권장 |
| Sender name | `MEBODY` | |
| Host | `smtp.resend.com` / `smtp.sendgrid.net` / Gmail SMTP 등 | 제공사 문서 확인 |
| Port | `465` (SSL) 또는 `587` (STARTTLS) | |
| Username | SMTP 계정 | |
| Password | SMTP API 키 / 앱 비밀번호 | `.env`에 넣지 말고 Supabase에만 |

추천 제공사: **Resend**, **SendGrid**, **Amazon SES**, **Mailgun**.  
Gmail 개인 계정은 한도·보안 때문에 운영용으로 비추천입니다.

DNS(도메인 메일일 때):

- SPF, DKIM (제공사 안내대로)
- 가능하면 DMARC

## 3. Redirect / Site URL

**Authentication → URL Configuration**

- **Site URL**: 사용자가 메일 링크를 눌렀을 때 기본으로 갈 주소  
  - 앱 우선이면 `https://mebody-jjh.vercel.app`  
  - 홈 우선이면 Railway 홈 URL
- **Redirect URLs**에 모두 추가:
  - `https://mebody-jjh.vercel.app/**`
  - `https://<railway-host>/**` (홈페이지)
  - `http://localhost:8080/**` (로컬 홈)
  - `http://localhost:5173/**` (로컬 Vite, 쓰는 경우)

홈페이지 회원가입은 `email_redirect_to`로 **현재 origin**(`/`)을 넣습니다. Redirect URLs에 그 origin이 없으면 메일 링크가 실패합니다.

## 4. 메일 템플릿 (선택)

**Authentication → Email Templates**

- Confirm signup / Reset password 제목·본문을 한국어로 다듬을 수 있습니다.
- `{{ .ConfirmationURL }}` 링크는 그대로 둡니다.

## 5. 앱·홈 동작 정리

| 경로 | 회원가입 | Confirm email ON일 때 |
|------|----------|------------------------|
| mebody-jjh | `supabase.auth.signUp` | 세션 없음 → 「이메일 인증 후 로그인」 |
| 홈페이지 (`web.js`) | anon `POST /auth/v1/signup` (동일) | 동일 메시지 |
| `POST /api/public/auth/signup` | Admin API + `email_confirm: true` | **인증 메일 없이 바로 확정** (내부/레거시용) |

운영 회원가입은 **홈·앱만** 쓰고, 서버 public signup API는 관리/특수 용도로만 쓰세요.

## 6. 동작 확인

1. Confirm email ON + SMTP 저장
2. Redirect URLs 등록
3. 홈 또는 앱에서 **새 이메일**로 가입
4. 받은편지함(스팸함 포함)에서 Confirm 메일 확인
5. 링크 클릭 → 사이트로 복귀 → 로그인

메일이 안 오면: SMTP 자격 증명, Sender 도메인 DNS, Supabase Auth Logs, 스팸함을 순서대로 확인하세요.
