const state = {
  editingProductId: null,
  products: [],
  orders: [],
  config: null,
  mode: 'signin',
  token: localStorage.getItem('mebody.server.accessToken') || '',
  me: null,
  selectedUser: null,
  currentTab: 'me',
};

/** bindHome() 이 이미 실행됐는지 — 이벤트 중복 바인드 방지 */
let homeBound = false;

function apiOrigin() {
  const b = typeof window !== 'undefined' && window.__MEBODY_API_BASE__;
  return typeof b === 'string' ? b.trim().replace(/\/$/, '') : '';
}

/** Same-origin (`''`) when running on Spring Boot; absolute when set via api-base.js (e.g. Vercel → API host). */
function apiUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const origin = apiOrigin();
  const p = path.startsWith('/') ? path : `/${path}`;
  return origin ? `${origin}${p}` : p;
}

const $ = (selector) => document.querySelector(selector);

/**
 * OS 의 "동작 줄이기" 설정을 존중하는 스크롤.
 * 앱(mebody-jjh)의 lib/viewport.ts `preferredScrollBehavior()` 와 같은 규칙이다.
 */
const preferredScrollBehavior = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

/** `scrollToEl('#authPanel')` — 요소가 없으면 조용히 무시한다. */
const scrollToEl = (selector, block = 'center') =>
  document.querySelector(selector)?.scrollIntoView({ behavior: preferredScrollBehavior(), block });

/**
 * 네이티브 confirm() 대체.
 * confirm() 은 버튼이 늘 "확인/취소" 라서 (1) 무슨 일이 일어나는지 버튼에 안 적히고
 * (2) 기본 포커스가 확인으로 간다. 파괴적 동작에는 둘 다 위험하다.
 * <dialog>.showModal() 을 쓰므로 포커스 트랩·Esc 닫기는 브라우저가 처리한다.
 *
 * @returns {Promise<boolean>} 확인 버튼을 누르면 true
 */
function confirmAction({ title, body = '', confirmLabel, cancelLabel = '취소', destructive = true }) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = destructive ? 'mb-confirm mb-confirm-danger' : 'mb-confirm';

    const heading = document.createElement('h2');
    heading.className = 'mb-confirm-title';
    heading.textContent = title;

    const detail = document.createElement('p');
    detail.className = 'mb-confirm-body';
    detail.textContent = body;

    const actions = document.createElement('div');
    actions.className = 'mb-confirm-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'mb-confirm-cancel';
    cancel.textContent = cancelLabel;
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'mb-confirm-ok';
    ok.textContent = confirmLabel;
    actions.append(cancel, ok);

    dialog.append(heading, detail, actions);
    document.body.appendChild(dialog);

    let answer = false;
    const finish = (value) => {
      answer = value;
      dialog.close();
    };
    cancel.addEventListener('click', () => finish(false));
    ok.addEventListener('click', () => finish(true));
    // Esc · 배경 클릭 → 취소
    dialog.addEventListener('cancel', () => finish(false));
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) finish(false);
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(answer);
    });

    dialog.showModal();
    // 파괴적 동작에서 기본 포커스는 취소에 둔다.
    (destructive ? cancel : ok).focus();
  });
}
const isAdminPath = () => window.location.pathname === '/admin';
/** `/me` — 로그인한 회원 전용 화면. 랜딩과 배타적으로 표시된다. */
const isMemberPath = () => window.location.pathname === '/me';
const isAdmin = () => state.me?.role === 'ADMIN';
const isSeller = () => state.me?.role === 'SELLER';
/** 상품을 올릴 수 있는 역할 — 관리자는 전부, 판매자는 자기 것만. */
const isManager = () => isAdmin() || isSeller();
/** 전문가(트레이너·물리치료사). 관리자도 화면을 볼 수 있게 두면 확인이 쉽습니다. */
const isProfessional = () => state.me?.role === 'PROFESSIONAL';
/**
 * 콘솔에 들어왔을 때 처음 열 탭. 역할마다 하는 일이 달라서 시작점도 달라야 합니다.
 * 전에는 누구나 'users' 로 보냈는데, 관리자가 아니면 그 탭이 막혀 'me' 로 떨어졌습니다.
 * 판매자·전문가는 자기 일이 있는 탭을 한 번 더 눌러야 했습니다.
 */
const defaultConsoleTab = () => (isAdmin() ? 'users' : isProfessional() ? 'clients' : isSeller() ? 'products' : 'me');
/** 판매자는 /api/seller/products, 관리자는 /api/admin/products 로 나갑니다. */
const productBase = () => (isAdmin() ? '/api/admin/products' : '/api/seller/products');

function visibleMessageElement() {
  return [...document.querySelectorAll('[data-message]')]
    .find((candidate) => !candidate.closest('.hidden')) || $('#authMessage');
}

function setMessage(message, ok = true) {
  const el = visibleMessageElement();
  if (!el) return;
  el.textContent = message;
  el.className = `message show ${ok ? 'ok' : 'err'}`;
}

function clearMessage() {
  document.querySelectorAll('.message').forEach((el) => {
    el.textContent = '';
    el.className = 'message';
  });
}

async function loadConfig() {
  const response = await fetch(apiUrl('/api/public/config'));
  if (!response.ok) {
    throw new Error(`공개 설정 요청 실패 (${response.status})`);
  }
  const payload = await response.json();
  state.config = payload.data;
}

/**
 * 실제 진단 앱(jjh)으로 가는 링크를 서버 설정값으로 채운다.
 * 출처는 MEBODY_APP_URL 환경변수 → /api/public/config 의 appUrl.
 * HTML 에는 폴백 href 가 박혀 있고, 설정을 못 받으면 그 값이 그대로 쓰인다.
 * 앱 주소를 HTML 여러 곳에 하드코딩하지 않으려는 배선이다.
 */
function applyAppUrl() {
  const appUrl = state.config?.appUrl?.trim();
  if (!appUrl) return;
  const base = appUrl.replace(/\/$/, '');
  document.querySelectorAll('[data-app-url]').forEach((el) => {
    const suffix = el.getAttribute('data-app-url') || '';
    el.setAttribute('href', `${base}${suffix}`);
  });
}

/**
 * 서버의 가입 조건. 화면이 조건을 말할 때는 박아 둔 문구가 아니라 이 값을 씁니다.
 *
 * 2026-09-22 감사에서 이 문구가 **실제 설정과 반대**였습니다. "가입하면 확인 메일이 갑니다" 인데
 * 확인은 꺼져 있었고, "휴대폰 번호로 가입하면 바로 이용" 인데 이 폼에는 이메일 칸 하나뿐입니다.
 * 문구가 코드에 박혀 있어서 설정을 바꿀 때 아무도 같이 못 바꿨습니다.
 *
 * 못 읽으면 보수적인 쪽(확인 ON · 8자)으로 둡니다 — 실제보다 느슨하게 안내해서 거부당하는 것보다 낫습니다.
 */
const AUTH_CONFIG_FALLBACK = {
  emailVerificationRequired: true, minPasswordLength: 8,
  phoneSignupEnabled: false, phoneRecoveryEmailRequired: true,
};
let authConfigCache = null;

async function loadAuthConfig() {
  if (authConfigCache) return authConfigCache;
  try {
    const r = await fetch('/api/public/auth/config');
    const body = await r.json();
    const d = body?.data;
    authConfigCache = (d && typeof d.minPasswordLength === 'number') ? d : AUTH_CONFIG_FALLBACK;
  } catch {
    authConfigCache = AUTH_CONFIG_FALLBACK;
  }
  return authConfigCache;
}

/**
 * 가입 안내 문구를 설정에서 만듭니다.
 *
 * 이 폼은 **이메일 전용**입니다(입력칸이 type=email 하나). 그래서 휴대폰 이야기를 하지 않습니다.
 * 휴대폰으로 가입하려면 앱을 쓰게 안내합니다.
 */
function signupHintText(cfg) {
  const parts = [];
  parts.push(cfg.emailVerificationRequired
    ? '가입하면 확인 메일이 갑니다. 메일함의 링크를 열면 로그인할 수 있어요.'
    : '확인 절차 없이 바로 가입됩니다.');
  parts.push(`비밀번호는 ${cfg.minPasswordLength}자 이상으로 만들어주세요.`);
  return parts.join(' ');
}

async function applyAuthConfigToForm() {
  const cfg = await loadAuthConfig();
  const hint = $('#signupHint');
  if (hint) hint.textContent = signupHintText(cfg);
  const pw = $('#password');
  if (pw) {
    pw.setAttribute('minlength', String(cfg.minPasswordLength));
    if (state.mode === 'signup') pw.placeholder = `${cfg.minPasswordLength}자 이상 비밀번호`;
  }
}

function setAuthMode(mode) {
  state.mode = mode;
  $('#authTitle').textContent = mode === 'signin' ? '로그인' : '회원가입';
  $('#authSubmit').textContent = mode === 'signin' ? '로그인하고 시작' : '회원가입하고 시작';
  $('#name').classList.toggle('hidden', mode === 'signin');
  $('#password').setAttribute('autocomplete', mode === 'signin' ? 'current-password' : 'new-password');
  // 로그인 칸에 "원하는 비밀번호" 는 새로 만드는 칸처럼 보입니다(2026-09-22 감사 P0-4).
  $('#password').placeholder = mode === 'signin'
    ? '비밀번호 입력'
    : `${(authConfigCache ?? AUTH_CONFIG_FALLBACK).minPasswordLength}자 이상 비밀번호`;
  $('#signupOnlyFields')?.classList.toggle('hidden', mode === 'signin');
  $('#forgotPassword')?.classList.toggle('hidden', mode !== 'signin');
  $('#signupHint')?.classList.toggle('hidden', mode !== 'signup');
  if (mode === 'signin') {
    const privacy = $('#consentPrivacy');
    if (privacy) privacy.checked = false;
    const terms = $('#consentTerms');
    if (terms) terms.checked = false;
  }
  document.querySelectorAll('[data-auth-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.authTab === mode);
  });
  // 설정은 한 번만 읽고 캐시합니다. 실패해도 폼은 그대로 씁니다.
  applyAuthConfigToForm().catch(() => {});
}

function showLanding() {
  $('.nav')?.classList.remove('hidden');
  $('main')?.classList.remove('hidden');
  $('.footer')?.classList.remove('hidden');
  $('#dashboardView')?.classList.add('hidden');
  $('#landingView')?.classList.remove('hidden');
  $('#memberHome')?.classList.add('hidden');
  $('.mb-nav')?.classList.remove('hidden');
  $('.mb-mobilenav')?.classList.remove('hidden');
  updateAccountSection();
}

/**
 * `/me` 회원 화면. 랜딩(#landingView)을 통째로 숨기고 #memberHome 만 남긴다.
 * 섹션을 하나씩 숨기지 않는 이유: 랜딩에 섹션이 추가될 때 빠뜨리지 않도록.
 * 상단 섹션 네비게이션도 숨긴다 — 가리킬 섹션이 화면에 없기 때문.
 */
function showMemberHome() {
  $('.nav')?.classList.remove('hidden');
  $('main')?.classList.remove('hidden');
  $('.footer')?.classList.remove('hidden');
  $('#dashboardView')?.classList.add('hidden');
  $('#landingView')?.classList.add('hidden');
  $('#memberHome')?.classList.remove('hidden');
  $('.mb-nav')?.classList.add('hidden');
  $('.mb-mobilenav')?.classList.add('hidden');
  document.title = '내 페이지 | mebody';
  updateAccountSection();

  const name = state.me?.name || state.me?.nickname || state.me?.email?.split('@')[0];
  const title = $('#memberHomeTitle');
  if (title && name) {
    title.innerHTML = `${escapeHtml(name)}님의 <span class="mb-thin">mebody</span>`;
  }
}

function updateAccountSection() {
  const loggedIn = Boolean(state.me && state.token);
  const displayName = state.me?.name || state.me?.nickname || state.me?.email?.split('@')[0] || 'mebody';

  const kicker = $('#accountKicker');
  const title = $('#accountTitle');
  const lead = $('#accountLead');
  if (kicker && title) {
    if (loggedIn) {
      kicker.textContent = 'MY ACCOUNT';
      title.textContent = `${displayName}님, 다시 오신 것을 환영합니다.`;
      if (lead) lead.textContent = '아래 내 mebody에서 mebody Code와 미션을 확인하고, 웹 진단을 이어서 진행할 수 있습니다.';
    } else {
      kicker.textContent = 'ACCOUNT';
      title.textContent = '결과를 저장하고 다음 방문에서 바로 이어보세요.';
      if (lead) lead.textContent = '회원가입 후 mebody Code, 코드 플랜, 오늘의 액션과 루틴을 계정 기준으로 관리할 수 있습니다. 일반 회원은 자동으로 BASIC 등급으로 시작합니다.';
    }
  }
  $('#accountTags')?.classList.toggle('hidden', loggedIn);

  $('#guestAuth')?.classList.toggle('hidden', loggedIn);
  $('#sessionAuth')?.classList.toggle('hidden', !loggedIn);
  // #memberHome 은 여기서 건드리지 않는다. 가시성은 경로(showLanding/showMemberHome)가 결정한다.

  $('#navGuest')?.classList.toggle('hidden', loggedIn);
  $('#navMember')?.classList.toggle('hidden', !loggedIn);

  // 콘솔에 볼 것이 있는 사람 모두에게 링크를 보입니다.
  //
  // 예전에는 관리자에게만 보였습니다. 그래서 판매자는 상품 관리를, 전문가는 고객 관리를
  // 쓰려면 주소창에 /admin 을 직접 쳐야 했습니다 — 알려주지 않으면 있는 줄도 모르는 기능입니다.
  // 콘솔 안에서 무엇을 볼 수 있는지는 setDashboardTab 이 역할별로 다시 거릅니다.
  const hasConsole = isAdmin() || isSeller() || isProfessional();
  $('#navAdmin')?.classList.toggle('hidden', !hasConsole);
  $('#sessionAdmin')?.classList.toggle('hidden', !hasConsole);

  const memberHref = loggedIn ? '/me' : '/#authPanel';
  const memberLabel = loggedIn ? '내 페이지' : '회원';
  ['#navMemberLink', '#navMemberLinkMobile'].forEach((selector) => {
    const link = $(selector);
    if (!link) return;
    link.setAttribute('href', memberHref);
    link.textContent = memberLabel;
  });

  if (loggedIn) {
    $('#sessionName').textContent = displayName;
    $('#sessionEmail').textContent = state.me?.email || '';
    $('#sessionRole').textContent = state.me?.role || 'MEMBER';
    $('#sessionGrade').textContent = state.me?.grade || 'BASIC';
  }
}

function showDashboard() {
  $('.nav')?.classList.add('hidden');
  $('main')?.classList.add('hidden');
  $('.footer')?.classList.add('hidden');
  $('#dashboardView')?.classList.remove('hidden');
}

function requireSupabaseConfig() {
  if (!state.config?.supabaseUrl || !state.config?.supabaseAnonKey) {
    throw new Error('Server .env에 SUPABASE_URL과 SUPABASE_ANON_KEY가 필요합니다.');
  }
}

function authRedirectTo() {
  return `${window.location.origin}/`;
}

async function supabasePasswordLogin(email, password) {
  requireSupabaseConfig();
  const response = await fetch(`${state.config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: state.config.supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error_description || payload.msg || payload.message || '로그인에 실패했습니다.');
  return payload;
}

/**
 * 서버를 거친 가입. 확인 절차 없이 그 자리에서 승인된 계정이 만들어집니다.
 * 앱(jjh)의 /api/public/auth/signup 과 같은 경로입니다.
 */
async function serverSignUp(identifier, password, displayName) {
  const response = await fetch('/api/public/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier, password, displayName: displayName || null,
      // 동의한 사실을 남기기 위해 함께 보냅니다(체크박스는 위에서 이미 검사했습니다).
      agreedTerms: Boolean($('#consentTerms')?.checked),
      agreedPrivacy: Boolean($('#consentPrivacy')?.checked),
      agreedMarketing: false,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || '회원가입에 실패했습니다.');
  return payload.data ?? payload;
}

/** 승인 대기로 남은 계정 풀기. 승인만 할 뿐 로그인은 따로 합니다. */
async function serverApprove(identifier) {
  try {
    const response = await fetch('/api/public/auth/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    if (!response.ok) return false;
    const payload = await response.json().catch(() => ({}));
    return Boolean((payload.data ?? payload)?.approved);
  } catch {
    return false;
  }
}

/** 로그인. 승인 대기로 막히면 자동으로 풀고 한 번만 다시 시도합니다. */
async function loginAllowingPending(email, password, identifier) {
  try {
    return await supabasePasswordLogin(email, password);
  } catch (error) {
    const text = String(error?.message ?? '').toLowerCase();
    if (!text.includes('not confirmed')) throw error;
    if (!(await serverApprove(identifier ?? email))) throw error;
    return await supabasePasswordLogin(email, password);
  }
}

/** 예전 경로. 서버에 못 붙었을 때만 씁니다(Confirm email ON이면 인증 메일). */
async function supabaseSignUp(email, password, displayName) {
  requireSupabaseConfig();
  const response = await fetch(`${state.config.supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: state.config.supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      data: { display_name: displayName || '' },
      email_redirect_to: authRedirectTo(),
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.msg || payload.message || '회원가입에 실패했습니다.');
  }
  return payload;
}

async function supabaseRequestPasswordReset(email) {
  requireSupabaseConfig();
  const redirectTo = encodeURIComponent(authRedirectTo());
  const response = await fetch(`${state.config.supabaseUrl}/auth/v1/recover?redirect_to=${redirectTo}`, {
    method: 'POST',
    headers: {
      apikey: state.config.supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.msg || payload.message || '비밀번호 재설정 메일 발송에 실패했습니다.');
  }
}

/** 이메일 인증/재설정 링크의 #access_token=... 로 돌아온 경우 세션 저장 */
function consumeAuthHash() {
  const raw = window.location.hash?.replace(/^#/, '');
  if (!raw || !raw.includes('access_token')) return null;
  const params = new URLSearchParams(raw);
  const accessToken = params.get('access_token');
  if (!accessToken) return null;
  const type = params.get('type') || '';
  history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  return { access_token: accessToken, type };
}

async function applySessionAndEnter(auth, successMessage) {
  localStorage.setItem('mebody.server.accessToken', auth.access_token);
  state.token = auth.access_token;
  if (isAdminPath()) {
    await enterDashboard();
  } else if (isMemberPath()) {
    await loadMeDashboard();
    // 역할별 메뉴(판매자·전문가·관리자)는 state.me 를 읽어 켭니다. loadMeDashboard() 뒤에
    // 불러야 합니다 — 먼저 부르면 role 을 모르는 채로 전부 숨긴 채 굳어집니다.
    configureDashboardAccess();
    showMemberHome();
    if (successMessage) setMessage(successMessage, true);
  } else {
    // 랜딩에서 로그인했으면 /me 로 실제 이동한다. 주소가 상태를 반영해야
    // 새로고침·뒤로가기·북마크가 어긋나지 않는다.
    window.location.assign('/me');
  }
}

async function api(path, options = {}) {
  if (!state.token) throw new Error('로그인이 필요합니다.');
  const headers = { Authorization: `Bearer ${state.token}`, ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(apiUrl(path), { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    const error = new Error(
      response.status === 401
        ? '로그인이 필요합니다.'
        : response.status === 403
          ? '권한이 필요합니다.'
          : payload?.message || `API 요청 실패 (${response.status})`
    );
    error.status = response.status;
    throw error;
  }
  return payload?.data;
}

function setText(id, value) {
  const el = typeof id === 'string' ? $(id) : id;
  if (el) el.textContent = value ?? '';
}

function renderMemberSummary(summary) {
  const profile = summary?.profile || state.me || {};
  const displayName = profile.name || profile.nickname || 'mebody 회원';
  const bodyCode = summary?.bodyBtiCode || profile.bodyBtiCode || '';
  const bodyTitle = summary?.bodyBtiTitle || profile.bodyBtiTitle || '';
  const bodyDescription = profile.bodyBtiDescription || '';
  const missionRate = Number(summary?.missionAchievementRate ?? profile.missionAchievementRate ?? 0);
  const activeCount = Number(summary?.activeMissionCount ?? 0);
  const completedCount = Number(summary?.completedMissionCount ?? 0);
  const missionSummaryText = `진행 중 미션 ${activeCount}개 · 완료 미션 ${completedCount}개`;
  const progressWidth = `${Math.max(0, Math.min(100, missionRate))}%`;

  let bodyDescText = '아직 진단 결과가 없습니다. 웹에서 mebody Code 분석을 시작해보세요.';
  if (bodyCode) {
    if (bodyTitle && bodyDescription) bodyDescText = `${bodyTitle} — ${bodyDescription}`;
    else if (bodyTitle) bodyDescText = bodyTitle;
    else if (bodyDescription) bodyDescText = bodyDescription;
    else bodyDescText = '최근 진단 결과가 계정에 저장되어 있습니다. 코드 플랜과 오늘의 미션을 이어서 확인할 수 있습니다.';
  }

  const memberKicker = document.querySelector('#meSection .member-hero-card .kicker');
  if (memberKicker) {
    memberKicker.textContent = profile.role === 'ADMIN' ? 'ADMIN ACCOUNT' : 'MY ACCOUNT';
  }
  setText('#homeAccountKicker', profile.role === 'ADMIN' ? 'ADMIN ACCOUNT' : 'ACCOUNT');

  setText('#dashboardEmail', profile.email || '');
  setText('#memberName', displayName);
  setText('#memberEmail', profile.email || '');
  setText('#memberRole', profile.role || 'MEMBER');
  if ($('#memberRole')) $('#memberRole').className = `pill ${profile.role || ''}`;
  setText('#memberStatus', profile.status || 'ACTIVE');
  if ($('#memberStatus')) $('#memberStatus').className = `pill ${profile.status || ''}`;
  setText('#memberGrade', profile.grade || 'BASIC');

  setText('#homeMemberName', displayName);
  setText('#homeMemberEmail', profile.email || '');
  setText('#homeMemberRole', profile.role || 'MEMBER');
  setText('#homeMemberStatus', profile.status || 'ACTIVE');
  setText('#homeMemberGrade', profile.grade || 'BASIC');

  setText('#bodyBtiCode', bodyCode || '아직 결과 없음');
  setText('#bodyBtiDescription', bodyDescText);
  setText('#homeBodyBtiCode', bodyCode || '아직 결과 없음');
  setText('#homeBodyBtiDescription', bodyDescText);

  setText('#missionRate', String(missionRate));
  setText('#homeMissionRate', String(missionRate));
  setText('#missionSummary', missionSummaryText);
  setText('#homeMissionSummary', missionSummaryText);
  if ($('#missionProgressBar')) $('#missionProgressBar').style.width = progressWidth;
  if ($('#homeMissionProgressBar')) $('#homeMissionProgressBar').style.width = progressWidth;

  updateAccountSection();
}

function renderMissionList(missionSummary) {
  const list = $('#homeMissionList');
  if (!list) return;
  const items = missionSummary?.progress || [];
  if (!items.length) {
    list.innerHTML = '<li class="mb-mission-empty">아직 등록된 미션 진행이 없습니다. 진단을 완료하면 미션이 연결됩니다.</li>';
    return;
  }
  list.innerHTML = items.map((item, index) => {
    const rate = Number(item.achievementRate ?? 0);
    const done = item.completedAt ? '완료' : '진행 중';
    // 한 줄은 "미션 하나" 가 아니라 **14일 루틴의 하루** 입니다.
    // 예전 데이터(user_mission_progress)를 그리던 때의 "미션 N" 라벨이 남아 있었습니다.
    const label = item.dayNo ? `DAY ${item.dayNo}` : `미션 ${index + 1}`;
    return `
      <li>
        <div>
          <div class="mb-mission-title">${escapeHtml(label)}</div>
          <div class="mb-mission-meta">${done} · ${Number(item.currentCount ?? 0)} / ${Number(item.targetCount ?? 0)}</div>
        </div>
        <div class="mb-mission-rate">${rate}%</div>
      </li>
    `;
  }).join('');
}

async function loadMissions() {
  if (!state.token) return;
  try {
    const missions = await api('/api/me/missions');
    renderMissionList(missions);
  } catch (error) {
    const list = $('#homeMissionList');
    if (list) {
      list.innerHTML = `<li class="mb-mission-empty">${escapeHtml(error.message || '미션을 불러오지 못했습니다.')}</li>`;
    }
  }
}

async function loadMeDashboard() {
  try {
    const summary = await api('/api/me/summary');
    state.me = summary.profile;
    renderMemberSummary(summary);
  } catch (error) {
    const profile = await api('/api/me');
    state.me = profile;
    renderMemberSummary({ profile });
  }
  await loadMissions();
}

function configureDashboardAccess() {
  document.querySelectorAll('[data-admin-only]').forEach((element) => {
    element.classList.toggle('hidden', !isAdmin());
  });
  document.querySelectorAll('[data-manager-only]').forEach((element) => {
    element.classList.toggle('hidden', !isManager());
  });
  document.querySelectorAll('[data-professional-only]').forEach((element) => {
    element.classList.toggle('hidden', !isProfessional());
  });
  // 판매자는 자기 상품만 올리므로 판매자 선택 칸이 필요 없습니다(서버가 본인으로 강제).
  $('#productSellerRow')?.classList.toggle('hidden', !isAdmin());
}

function setDashboardTab(tab) {
  const requestedTab = tab || 'me';
  const managerTabs = ['products', 'orders'];
  const allowed = requestedTab === 'me'
    || (requestedTab === 'clients' ? isProfessional()
      : managerTabs.includes(requestedTab) ? isManager() : isAdmin());
  const nextTab = allowed ? requestedTab : 'me';
  state.currentTab = nextTab;

  document.querySelectorAll('[data-dashboard-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.dashboardTab === nextTab);
  });
  $('#meSection').classList.toggle('hidden', nextTab !== 'me');
  $('#usersSection').classList.toggle('hidden', nextTab !== 'users');
  $('#productsSection').classList.toggle('hidden', nextTab !== 'products');
  $('#ordersSection').classList.toggle('hidden', nextTab !== 'orders');
  $('#storageSection').classList.toggle('hidden', nextTab !== 'storage');
  $('#clientsSection').classList.toggle('hidden', nextTab !== 'clients');
  $('#metricsSection').classList.toggle('hidden', nextTab !== 'metrics');
  // 고객 상세는 목록에서 눌렀을 때만 열립니다. 탭을 옮기면 무조건 닫습니다 —
  // 열어둔 채 다른 탭에 갔다 오면 남의 결과가 화면에 남아 있게 됩니다.
  $('#clientDetailSection')?.classList.add('hidden');
  // 초안도 비웁니다. 남겨 두면 다른 탭에 갔다 온 뒤 옛 고객의 초안이 그대로 보입니다.
  const draftHost = $('#clientDraftBlock');
  if (draftHost) draftHost.innerHTML = '';

  const meta = {
    me: ['MY PAGE', '내 mebody', '계정 정보와 최근 mebody Code, 미션 상태를 확인합니다.'],
    users: ['OPERATIONS', '회원·권한 관리', '회원 프로필과 권한, 등급, mebody Code를 관리합니다.'],
    products: ['MARKET', '상품 관리', '사진과 함께 상품을 등록합니다. 사진 없이는 등록되지 않고, 등록 즉시 앱 마켓 탭에 반영됩니다.'],
    orders: ['ORDERS', '주문 · 배송', '결제된 주문의 배송 상태를 관리합니다. 발송 처리에는 송장번호가 필요합니다.'],
    storage: ['STORAGE', '이미지 관리', '상품 이미지를 서버 권한으로 안전하게 관리합니다.'],
    metrics: ['METRICS', '운영 지표', '퍼널 각 칸의 비율은 바로 앞 칸 대비입니다. 어디서 떨어지는지 보려면 이웃과 비교해야 합니다.'],
    clients: ['CLIENTS', '고객 관리', '초대 링크를 만들어 보내고, 동의한 고객의 체형 결과를 확인합니다. 동의 전에는 아무것도 보이지 않습니다.'],
  }[nextTab];
  $('#dashboardKicker').textContent = meta[0];
  $('#dashboardTitle').textContent = meta[1];
  $('#dashboardLead').textContent = meta[2];

  if (nextTab === 'users') Promise.all([loadSummary(), loadUsers()]).catch((error) => setMessage(error.message, false));
  if (nextTab === 'products') loadProducts().catch((error) => setMessage(error.message, false));
  if (nextTab === 'orders') loadOrders().catch((error) => setMessage(error.message, false));
  if (nextTab === 'storage') loadImages().catch((error) => setMessage(error.message, false));
  if (nextTab === 'clients') loadClients().catch((error) => setMessage(error.message, false));
  if (nextTab === 'metrics') loadMetrics().catch((error) => setMessage(error.message, false));
}

async function enterDashboard(preferredTab) {
  clearMessage();
  updateAccountSection();
  await loadMeDashboard();
  configureDashboardAccess();
  showDashboard();
  // 역할을 알아야 시작 탭을 고를 수 있으므로 loadMeDashboard() 뒤에서 정합니다.
  setDashboardTab(preferredTab ?? defaultConsoleTab());
}

async function bootstrap() {
  // 공개 설정을 못 받아도 UI 바인드는 반드시 진행한다.
  // 이전에는 loadConfig() 가 throw 하면 bootstrap 이 여기서 중단되어
  // bindHome() 이 실행되지 않았고, 그 결과 로그인·회원가입·탭 등
  // 모든 버튼이 아무 반응도 하지 않는 페이지가 되었다.
  let configError = null;
  try {
    await loadConfig();
  } catch (error) {
    configError = error;
    console.error('공개 설정 로드 실패:', error);
  }

  applyAppUrl();
  bindHome();
  setAuthMode('signin');

  const hashAuth = consumeAuthHash();
  if (hashAuth?.access_token) {
    try {
      const msg = hashAuth.type === 'recovery'
        ? '비밀번호 재설정 링크가 확인되었습니다. 로그인 후 비밀번호를 변경해주세요.'
        : '이메일 인증이 완료되었습니다.';
      await applySessionAndEnter(hashAuth, msg);
      return;
    } catch (error) {
      localStorage.removeItem('mebody.server.accessToken');
      state.token = '';
      state.me = null;
      showLanding();
      setMessage(error.message || '이메일 인증 후 로그인에 실패했습니다.', false);
      return;
    }
  }

  if (!state.token) {
    showLanding();
    if (configError) {
      setMessage('서버에 연결하지 못해 로그인·회원가입은 지금 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.', false);
    } else if (isMemberPath()) {
      setMessage('내 페이지는 로그인 후 이용할 수 있습니다.', true);
      scrollToEl('#authPanel');
    } else if (isAdminPath()) {
      setMessage('로그인하면 권한에 따라 내 페이지 또는 관리자 화면으로 이동합니다.', true);
      scrollToEl('#authPanel');
    }
    return;
  }

  try {
    // `/admin` 콘솔, `/me` 회원 화면, `/` 는 로그인 상태여도 랜딩.
    if (isAdminPath()) {
      await enterDashboard();
    } else if (isMemberPath()) {
      await loadMeDashboard();
      configureDashboardAccess();
      showMemberHome();
    } else {
      await loadMeDashboard();
      showLanding();
    }
  } catch (error) {
    localStorage.removeItem('mebody.server.accessToken');
    state.token = '';
    state.me = null;
    showLanding();
    setMessage(error.message || '로그인이 필요합니다.', false);
    if (isAdminPath()) scrollToEl('#authPanel');
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const email = $('#email').value.trim();
  const password = $('#password').value;
  const name = $('#name').value.trim();
  if (!email || !password) {
    setMessage('이메일과 비밀번호를 입력해주세요.', false);
    return;
  }

  if (state.mode === 'signup') {
    // 길이·확인 조건은 걸지 않습니다. 서버 설정(mebody.auth.min-password-length)이 정합니다.
    if (!($('#consentPrivacy')?.checked && $('#consentTerms')?.checked)) {
      setMessage('개인정보처리방침과 이용약관에 동의해주세요.', false);
      return;
    }
  }

  $('#authSubmit').disabled = true;
  clearMessage();
  try {
    if (state.mode === 'signin') {
      const auth = await loginAllowingPending(email, password, email);
      await applySessionAndEnter(auth, '로그인되었습니다.');
      return;
    }

    // 회원가입: 서버를 거칩니다. 확인 절차가 꺼져 있으면 그 자리에서 승인되고,
    // 켜져 있으면(2026-09-21 부터 이메일은 ON) 확인 메일을 보내고 여기서 멈춥니다.
    try {
      const result = await serverSignUp(email, password, name);

      // 확인 메일을 열기 전에는 로그인이 막힙니다. 그대로 로그인을 시도하면
      // "확인되지 않았다" 오류가 나서, 가입이 된 건지 만 건지 알 수 없게 됩니다.
      if (result.verificationRequired) {
        setAuthMode('signin');
        if ($('#password')) $('#password').value = '';
        setMessage(result.verificationHint || '확인 메일을 보냈습니다. 메일함에서 링크를 열면 로그인할 수 있어요.', true);
        return;
      }

      const auth = await loginAllowingPending(result.loginEmail || email, password, email);
      await applySessionAndEnter(auth, result.alreadyRegistered
        ? '이미 가입된 계정으로 로그인되었습니다.'
        : '회원가입과 로그인이 완료되었습니다.');
      return;
    } catch (serverError) {
      // 서버에 못 붙는 경우에만 예전 경로로 되돌아갑니다.
      if (!String(serverError?.message ?? '').includes('Failed to fetch')) throw serverError;
    }

    const signupPayload = await supabaseSignUp(email, password, name);
    if (signupPayload?.access_token) {
      await applySessionAndEnter(signupPayload, '회원가입과 로그인이 완료되었습니다.');
      return;
    }
    const auth = await loginAllowingPending(email, password, email);
    await applySessionAndEnter(auth, '회원가입 후 로그인되었습니다.');
  } catch (error) {
    setMessage(error.message || '처리 중 오류가 발생했습니다.', false);
  } finally {
    $('#authSubmit').disabled = false;
  }
}

async function handlePasswordReset() {
  const email = $('#email')?.value.trim() || '';
  if (!email) {
    setMessage('비밀번호를 재설정할 이메일을 먼저 입력해주세요.', false);
    return;
  }
  const btn = $('#forgotPassword');
  if (btn) btn.disabled = true;
  clearMessage();
  try {
    await supabaseRequestPasswordReset(email);
    setMessage('비밀번호 재설정 메일을 보냈습니다. 메일함에서 링크를 확인해주세요.', true);
  } catch (error) {
    setMessage(error.message || '비밀번호 재설정 메일 발송에 실패했습니다.', false);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function loadSummary() {
  const summary = await api('/api/admin/dashboard/summary');
  const items = [
    ['전체 회원', summary.totalUsers, '누적 프로필'],
    ['활성 회원', summary.activeUsers, 'ACTIVE'],
    ['정지 회원', summary.suspendedUsers, 'SUSPENDED'],
    ['판매자', summary.sellerUsers, 'SELLER'],
    ['관리자', summary.adminUsers, 'ADMIN'],
    ['오늘 가입', summary.todaySignups, 'UTC 기준'],
  ];
  $('#summaryGrid').innerHTML = items.map(([label, value, hint]) => `
    <article class="panel summary-card"><span>${label}</span><strong>${value ?? 0}</strong><span>${hint}</span></article>
  `).join('');
}

async function loadUsers() {
  const params = new URLSearchParams();
  const search = $('#search').value.trim();
  const status = $('#statusFilter').value;
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if ($('#includeDeleted').checked) params.set('includeDeleted', 'true');
  params.set('size', '50');
  const page = await api(`/api/admin/users?${params.toString()}`);
  const users = page.content || [];
  $('#userRows').innerHTML = users.map((user) => `
    <tr data-user-id="${user.id}">
      <td><strong>${escapeHtml(user.email || '')}</strong><br><span style="color:#64748b">${escapeHtml(user.name || user.nickname || '-')}</span></td>
      <td><span class="pill ${user.role}">${user.role}</span></td>
      <td><span class="pill ${user.status}">${user.status}</span></td>
      <td><span class="pill">${user.grade}</span></td>
      <td>${renderLatestCodeCell(user)}</td>
      <td>${Number(user.missionAchievementRate || 0)}%</td>
      <td>${formatDate(user.createdAt)}</td>
    </tr>
  `).join('') || '<tr><td colspan="7" style="color:#64748b">회원이 없습니다.</td></tr>';
  document.querySelectorAll('[data-user-id]').forEach((row) => {
    const user = users.find((item) => item.id === row.dataset.userId);
    row.addEventListener('click', () => selectUser(user));
  });
}

function selectUser(user) {
  state.selectedUser = user;
  $('#detailEmpty').classList.add('hidden');
  $('#detailForm').classList.remove('hidden');
  $('#detailEmail').textContent = user.email || '';
  $('#detailLatestResult').innerHTML = renderLatestResultDetail(user);
  ['name', 'nickname', 'phone', 'role', 'status', 'grade', 'bodyBtiCode', 'bodyBtiTitle', 'bodyBtiDescription', 'missionAchievementRate'].forEach((key) => {
    const input = $(`#edit-${key}`);
    if (input) input.value = user[key] ?? '';
  });
}

async function saveUser() {
  if (!state.selectedUser) return;
  const payload = {
    name: $('#edit-name').value || null,
    nickname: $('#edit-nickname').value || null,
    phone: $('#edit-phone').value || null,
    role: $('#edit-role').value,
    status: $('#edit-status').value,
    grade: $('#edit-grade').value,
    bodyBtiCode: $('#edit-bodyBtiCode').value || null,
    bodyBtiTitle: $('#edit-bodyBtiTitle').value || null,
    bodyBtiDescription: $('#edit-bodyBtiDescription').value || null,
    missionAchievementRate: Number($('#edit-missionAchievementRate').value || 0),
  };
  const updated = await api(`/api/admin/users/${state.selectedUser.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  state.selectedUser = updated;
  setMessage('회원 정보가 저장되었습니다.', true);
  await Promise.all([loadSummary(), loadUsers()]);
}

async function softDeleteUser() {
  if (!state.selectedUser) return;
  const confirmed = await confirmAction({
    title: '이 회원을 삭제 처리할까요?',
    body: `${state.selectedUser.email} 계정이 삭제 처리됩니다.`,
    confirmLabel: '회원 삭제',
  });
  if (!confirmed) return;
  await api(`/api/admin/users/${state.selectedUser.id}`, { method: 'DELETE' });
  state.selectedUser = null;
  $('#detailForm').classList.add('hidden');
  $('#detailEmpty').classList.remove('hidden');
  setMessage('회원이 삭제 처리되었습니다.', true);
  await Promise.all([loadSummary(), loadUsers()]);
}

async function loadImages() {
  const prefix = $('#imagePrefix').value.trim() || 'characters';
  const images = await api(`/api/admin/storage/images?${new URLSearchParams({ prefix })}`);
  $('#storageGrid').innerHTML = (images || []).map((image) => `
    <article class="image-card">
      <img src="${image.publicUrl}" alt="${escapeHtml(image.path)}" />
      <div>${escapeHtml(image.path)}<br><button class="btn btn-ghost" type="button" data-delete-image="${escapeAttr(image.path)}" style="margin-top:10px;min-height:36px">삭제</button></div>
    </article>
  `).join('') || '<div style="padding:20px;color:#64748b">이미지가 없습니다.</div>';
  document.querySelectorAll('[data-delete-image]').forEach((button) => {
    button.addEventListener('click', async () => {
      const confirmed = await confirmAction({
        title: '이 이미지를 삭제할까요?',
        body: `${button.dataset.deleteImage} — 삭제하면 되돌릴 수 없습니다.`,
        confirmLabel: '이미지 삭제',
      });
      if (!confirmed) return;
      await api(`/api/admin/storage/images?${new URLSearchParams({ path: button.dataset.deleteImage })}`, { method: 'DELETE' });
      await loadImages();
    });
  });
}

async function uploadImage() {
  const file = $('#uploadFile').files?.[0];
  const path = $('#uploadPath').value.trim();
  if (!file || !path) {
    setMessage('업로드 경로와 파일을 선택해주세요.', false);
    return;
  }
  const form = new FormData();
  form.append('path', path);
  form.append('file', file);
  await api('/api/admin/storage/images', { method: 'POST', body: form });
  setMessage('이미지가 업로드되었습니다.', true);
  await loadImages();
}


// ---------------------------------------------------------------- 상품 관리
//
// 사진 필수 규칙은 세 겹입니다. 여기(화면)는 그중 가장 바깥이고, 편의를 위한 겁니다 —
//   · 등록 모드에서는 파일을 고르기 전까지 등록 버튼이 disabled
//   · 서버(ProductAdminService)가 파일 없는 요청을 400 으로 거절
//   · DB의 products_image_required CHECK 가 사진 없는 ACTIVE 행을 거절
// 화면만 믿지 않는 이유는, 화면은 우회할 수 있기 때문입니다.

const PRODUCT_CATEGORY_LABEL = {
  release: '셀프 이완',
  strength: '근력 운동',
  stretch: '스트레칭',
  support: '보조 용품',
  food: '보조 식품',
};
const MAX_PRODUCT_IMAGE_BYTES = 8 * 1024 * 1024;

function selectedProductImage() {
  return $('#productImageFile')?.files?.[0] || null;
}

/** 등록은 사진이 있어야만, 수정은 이미 사진이 있으면 사진 없이도 저장 가능. */
function refreshProductImageState() {
  const file = selectedProductImage();
  const editing = state.products.find((product) => product.id === state.editingProductId) || null;
  const hasExisting = Boolean(editing?.imageUrl);
  const stateLabel = $('#productImageState');
  const preview = $('#productImagePreview');
  const box = $('#productImageBox');

  if (preview?.dataset.objectUrl) {
    URL.revokeObjectURL(preview.dataset.objectUrl);
    delete preview.dataset.objectUrl;
  }

  if (file) {
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.dataset.objectUrl = url;
    preview.classList.remove('hidden');
    stateLabel.textContent = `${file.name} (${Math.ceil(file.size / 1024)}KB)`;
    stateLabel.style.color = '#047857';
    box.style.borderColor = 'rgba(4,120,87,.5)';
  } else if (hasExisting) {
    preview.src = editing.imageUrl;
    preview.classList.remove('hidden');
    stateLabel.textContent = '기존 사진 유지';
    stateLabel.style.color = '#047857';
    box.style.borderColor = 'rgba(4,120,87,.5)';
  } else {
    preview.classList.add('hidden');
    preview.removeAttribute('src');
    stateLabel.textContent = state.editingProductId ? '이 상품은 사진이 없습니다 — 사진을 올려야 저장됩니다' : '아직 선택 안 됨';
    stateLabel.style.color = '#8E3A32';
    box.style.borderColor = 'rgba(1,71,37,.28)';
  }

  $('#saveProduct').disabled = !(file || hasExisting);
}

function resetProductForm() {
  state.editingProductId = null;
  $('#productFormTitle').textContent = '상품 등록';
  $('#productFormLead').textContent = '사진은 필수입니다. 사진을 고르기 전에는 등록 버튼이 열리지 않고, 서버와 DB에서도 사진 없는 판매 상품은 거절합니다.';
  $('#saveProduct').textContent = '등록';
  $('#cancelProductEdit').classList.add('hidden');
  $('#deleteProduct').classList.add('hidden');
  $('#productImageFile').value = '';
  $('#productName').value = '';
  $('#productPrice').value = '';
  $('#productDescription').value = '';
  $('#productCategory').value = 'release';
  $('#productStatus').value = 'ACTIVE';
  refreshProductImageState();
}

function editProduct(product) {
  state.editingProductId = product.id;
  $('#productFormTitle').textContent = '상품 수정';
  $('#productFormLead').textContent = product.imageUrl
    ? '사진을 새로 고르면 교체되고, 비워두면 기존 사진을 그대로 씁니다.'
    : '이 상품은 사진이 없습니다. 판매 중(ACTIVE)으로 두려면 사진을 올려야 저장됩니다.';
  $('#saveProduct').textContent = '수정 저장';
  $('#cancelProductEdit').classList.remove('hidden');
  $('#deleteProduct').classList.remove('hidden');
  $('#productImageFile').value = '';
  $('#productName').value = product.name || '';
  $('#productPrice').value = product.price ?? '';
  $('#productDescription').value = product.description || '';
  $('#productCategory').value = product.category || 'release';
  $('#productStatus').value = product.status || 'ACTIVE';
  if (isAdmin() && product.sellerId) $('#productSeller').value = product.sellerId;
  refreshProductImageState();
  scrollToEl('#productsSection', 'start');
}

/** 관리자만 판매자를 고릅니다. 판매자·관리자 프로필을 모아 옵니다. */
async function loadSellerOptions() {
  if (!isAdmin()) return;
  const select = $('#productSeller');
  if (select.dataset.loaded === '1') return;
  const [sellers, admins] = await Promise.all([
    api('/api/admin/users?' + new URLSearchParams({ role: 'SELLER', size: '100' })),
    api('/api/admin/users?' + new URLSearchParams({ role: 'ADMIN', size: '100' })),
  ]);
  const rows = [...(sellers?.content || []), ...(admins?.content || [])];
  select.innerHTML = rows
    .map((user) => `<option value="${escapeAttr(user.id)}">${escapeHtml(user.name || user.nickname || user.email || user.id)} · ${escapeHtml(user.role)}</option>`)
    .join('') || '<option value="">판매자 계정이 없습니다</option>';
  select.dataset.loaded = '1';
}

async function loadProducts() {
  await loadSellerOptions();
  const filter = $('#productStatusFilter').value;
  const products = await api(productBase());
  state.products = products || [];
  const visible = state.products.filter((product) => !filter || product.status === filter);

  const missing = state.products.filter((product) => !product.imageUrl).length;
  const notice = $('#productPhotoNotice');
  notice.classList.toggle('hidden', missing === 0);
  notice.textContent = missing === 0 ? '' : `사진 없는 상품 ${missing}개 — 카드를 눌러 사진을 채워주세요`;

  $('#productGrid').innerHTML = visible.map((product) => `
    <article class="image-card">
      ${product.imageUrl
        ? `<img src="${escapeAttr(product.imageUrl)}" alt="${escapeAttr(product.name)}" loading="lazy" />`
        : '<div style="height:132px;display:grid;place-items:center;background:#fff7ed;color:#b45309;font-weight:950;font-size:12px;padding:0;">사진 없음</div>'}
      <div>
        <strong style="display:block;color:#0f172a;font-size:13px;">${escapeHtml(product.name)}</strong>
        <span style="display:block;margin-top:4px;color:#014725;">${Number(product.price ?? 0).toLocaleString('ko-KR')}원</span>
        <span style="display:block;margin-top:4px;color:#64748b;">${escapeHtml(PRODUCT_CATEGORY_LABEL[product.category] || product.category || '미분류')}</span>
        <span class="pill ${escapeAttr(product.status)}" style="margin-top:8px;">${escapeHtml(product.status)}</span>
        <button class="btn btn-ghost" type="button" data-edit-product="${escapeAttr(product.id)}" style="margin-top:10px;min-height:36px;width:100%;">
          ${product.imageUrl ? '수정' : '사진 등록'}
        </button>
      </div>
    </article>
  `).join('') || '<div style="padding:20px;color:#64748b">상품이 없습니다.</div>';

  document.querySelectorAll('[data-edit-product]').forEach((button) => {
    button.addEventListener('click', () => {
      const product = state.products.find((item) => item.id === button.dataset.editProduct);
      if (product) editProduct(product);
    });
  });
}

async function deleteProduct() {
  const editing = state.editingProductId;
  if (!editing) return;
  const product = state.products.find((item) => item.id === editing);
  const confirmed = await confirmAction({
    title: `${product?.name || '이 상품'}을(를) 삭제할까요?`,
    body: '등록된 사진도 함께 지워집니다. 되돌릴 수 없습니다.',
    confirmLabel: '상품 삭제',
  });
  if (!confirmed) return;
  await api(`${productBase()}/${encodeURIComponent(editing)}`, { method: 'DELETE' });
  setMessage('상품이 삭제되었습니다.', true);
  resetProductForm();
  await loadProducts();
}

async function saveProduct() {
  const file = selectedProductImage();
  const editing = state.editingProductId;

  if (!editing && !file) {
    setMessage('상품 사진은 필수입니다. 사진 파일을 먼저 선택해주세요.', false);
    return;
  }
  if (file) {
    if (!/^image\//.test(file.type)) {
      setMessage('이미지 파일만 올릴 수 있습니다.', false);
      return;
    }
    if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
      setMessage('상품 사진은 8MB 이하만 올릴 수 있습니다.', false);
      return;
    }
  }

  const name = $('#productName').value.trim();
  const price = $('#productPrice').value.trim();
  if (!name) { setMessage('상품명을 입력해주세요.', false); return; }
  if (price === '' || Number(price) < 0) { setMessage('가격을 0원 이상으로 입력해주세요.', false); return; }

  const form = new FormData();
  form.append('name', name);
  form.append('price', price);
  form.append('category', $('#productCategory').value);
  form.append('status', $('#productStatus').value);
  const description = $('#productDescription').value.trim();
  if (description) form.append('description', description);
  if (isAdmin()) {
    const sellerId = $('#productSeller').value;
    if (!sellerId) { setMessage('판매자를 선택해주세요.', false); return; }
    form.append('sellerId', sellerId);
  }
  if (file) form.append('image', file);

  const path = editing ? `${productBase()}/${encodeURIComponent(editing)}` : productBase();
  await api(path, { method: editing ? 'PATCH' : 'POST', body: form });
  setMessage(editing ? '상품이 수정되었습니다. 앱 마켓 탭에 바로 반영됩니다.' : '상품이 사진과 함께 등록되었습니다. 앱 마켓 탭에 바로 반영됩니다.', true);
  resetProductForm();
  await loadProducts();
}


// ---------------------------------------------------------------- 주문 · 배송
//
// 배송 상태는 앱이 바꿀 수 없습니다(042 에서 authenticated 의 EXECUTE 를 회수했습니다).
// 여기가 유일한 통로이고, 판매자는 자기 상품이 든 주문만 봅니다.

const FULFILLMENT_LABEL = {
  NONE: '준비 전',
  PREPARING: '준비 중',
  SHIPPED: '배송 중',
  DELIVERED: '배송 완료',
};
/** 되돌릴 수 없으므로 다음 단계만 제시합니다. */
const FULFILLMENT_NEXT = {
  NONE: ['PREPARING', 'SHIPPED'],
  PREPARING: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
};

function orderNotice(text, ok = true) {
  const el = $('#orderNotice');
  if (!el) return;
  el.textContent = text || '';
  el.style.color = ok ? '#014725' : '#8E3A32';
}

async function loadOrders() {
  const filter = $('#orderFulfillmentFilter').value;
  let orders;
  try {
    orders = await api('/api/admin/orders' + (filter ? `?${new URLSearchParams({ fulfillment: filter })}` : ''));
  } catch (error) {
    // 표를 '불러오는 중...' 에 멈춰두지 않고, 무슨 일인지 그 자리에 씁니다.
    $('#orderRows').innerHTML = `<tr><td colspan="7" style="padding:20px;color:#b45309;font-weight:800;">${escapeHtml(error.message)}</td></tr>`;
    orderNotice(error.message, false);
    return;
  }
  state.orders = orders || [];

  $('#orderRows').innerHTML = state.orders.length === 0
    ? '<tr><td colspan="7">주문이 없습니다.</td></tr>'
    : state.orders.map((order) => {
        const next = FULFILLMENT_NEXT[order.fulfillmentStatus] || [];
        const shipping = (() => {
          try {
            const s = order.shipping ? JSON.parse(order.shipping) : null;
            return s ? `${escapeHtml(s.recipient || '')} · ${escapeHtml(s.phone || '')}<br>(${escapeHtml(s.postcode || '')}) ${escapeHtml(s.address1 || '')} ${escapeHtml(s.address2 || '')}` : '-';
          } catch { return '-'; }
        })();
        return `
        <tr>
          <td style="max-width:220px;">
            <strong style="display:block;">${escapeHtml((order.items || []).join(', ') || '(품목 없음)')}</strong>
            <small style="color:#64748b;">${formatDate(order.createdAt)}</small>
            <div style="margin-top:6px;font-size:11px;color:#64748b;line-height:1.5;">${shipping}</div>
          </td>
          <td>${escapeHtml(order.buyerEmail || '-')}</td>
          <td>
            <strong>${Number(order.totalKrw).toLocaleString('ko-KR')}원</strong>
            ${order.rewardUsed > 0 ? `<br><small style="color:#64748b;">적립금 ${Number(order.rewardUsed).toLocaleString('ko-KR')}원</small>` : ''}
          </td>
          <td><span class="pill ${escapeAttr(order.status)}">${escapeHtml(order.status)}</span></td>
          <td><span class="pill">${escapeHtml(FULFILLMENT_LABEL[order.fulfillmentStatus] || order.fulfillmentStatus)}</span></td>
          <td style="font-size:11px;color:#475569;">${order.trackingNo ? `${escapeHtml(order.trackingCarrier || '')}<br>${escapeHtml(order.trackingNo)}` : '-'}</td>
          <td>
            ${order.status !== 'PAID' ? '<small style="color:#64748b;">결제 완료 주문만</small>' : next.length === 0 ? '<small style="color:#64748b;">완료</small>' : `
              <div style="display:grid;gap:6px;min-width:180px;">
                <input class="input" data-carrier="${escapeAttr(order.id)}" placeholder="택배사" value="${escapeAttr(order.trackingCarrier || '')}" style="min-height:34px;font-size:12px;" />
                <input class="input" data-tracking="${escapeAttr(order.id)}" placeholder="송장번호" value="${escapeAttr(order.trackingNo || '')}" style="min-height:34px;font-size:12px;" />
                ${next.map((step) => `<button class="btn btn-soft" type="button" data-fulfill="${escapeAttr(order.id)}" data-step="${step}" style="min-height:34px;font-size:12px;">${FULFILLMENT_LABEL[step]}로</button>`).join('')}
              </div>`}
          </td>
        </tr>`;
      }).join('');

  document.querySelectorAll('[data-fulfill]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.fulfill;
      const step = button.dataset.step;
      const carrier = document.querySelector(`[data-carrier="${id}"]`)?.value?.trim() || null;
      const trackingNo = document.querySelector(`[data-tracking="${id}"]`)?.value?.trim() || null;
      if (step === 'SHIPPED' && !trackingNo) {
        orderNotice('발송 처리에는 송장번호가 필요합니다.', false);
        return;
      }
      try {
        await api(`/api/admin/orders/${encodeURIComponent(id)}/fulfillment`, {
          method: 'POST',
          body: JSON.stringify({ status: step, carrier, trackingNo }),
        });
        orderNotice(`${FULFILLMENT_LABEL[step]}(으)로 변경했습니다.`, true);
        await loadOrders();
      } catch (error) {
        orderNotice(error.message, false);
      }
    });
  });
}

/* ─────────────────────────────────────────────────────────────────────────
 * 전문가 확장 Phase 1 — 고객 관리
 *
 * 이 화면이 다루는 것은 남의 몸 상태입니다. 권한 판단은 전부 서버가 합니다
 * (current_professional_id · get_client_response). 여기서 숨기는 것은 화면일 뿐이고,
 * 화면을 뚫어도 서버가 403/404 를 돌려줍니다.
 * ───────────────────────────────────────────────────────────────────────── */

const CLIENT_STATUS_LABEL = {
  INVITED: '수락 대기',
  ACTIVE: '연결됨',
  REVOKED: '연결 끊김',
};

async function loadClients() {
  const [me, clients] = await Promise.all([
    api('/api/professional/me'),
    api('/api/professional/clients'),
  ]);
  $('#professionalName').textContent = me?.displayName ? `${me.displayName} 님` : '';
  renderClients(clients || []);
  // 주의 목록은 따로 부릅니다. 이게 실패해도 고객 목록은 떠야 합니다 —
  // 070 을 아직 적용하지 않은 서버에서도 Phase 1~4 는 그대로 돌아가야 합니다.
  loadAttention().catch(() => {});
}

/**
 * 오늘 볼 사람 (전문가 확장 Phase 5).
 *
 * 여기서 말하는 "확인" 은 운영 신호입니다 — 연락이 끊겼다, 수행이 밀렸다.
 * 몸 상태에 대한 판단이 아닙니다. 문구도 그 선을 넘지 않게 씁니다.
 */
const ATTENTION_LABEL = {
  inactive: ['연락 끊김', '며칠째 앱을 열지 않았습니다.'],
  not_started: ['아직 시작 안 함', '동의는 했는데 루틴을 시작하지 않았습니다.'],
  low_completion: ['수행이 밀림', '최근 받은 동작을 대부분 하지 않았습니다.'],
  hard_streak: ['어렵다는 말 반복', '최근에 "힘들었다" 가 여러 번입니다.'],
  ending_soon: ['곧 끝남', '14일 루틴이 곧 끝납니다. 다음 이야기를 할 때입니다.'],
};

async function loadAttention() {
  const host = $('#attentionBlock');
  if (!host) return;
  let data;
  try {
    data = await api('/api/professional/attention');
  } catch (error) {
    // 숫자가 0인 것과 못 불러온 것은 다릅니다. 섞으면 화면이 거짓말을 합니다.
    host.innerHTML = `<p class="member-muted" style="margin:8px 0;">주의 목록을 불러오지 못했습니다 (${escapeHtml(error.message)}).</p>`;
    return;
  }
  renderAttention(data || {});
}

function renderAttention(data) {
  const host = $('#attentionBlock');
  if (!host) return;
  const list = Array.isArray(data.clients) ? data.clients : [];
  const total = Number(data.total || 0);

  if (total === 0) {
    host.innerHTML = '';   // 고객이 없으면 이 블록 자체가 할 말이 없습니다.
    return;
  }

  if (!list.length) {
    host.innerHTML = `
      <div class="panel" style="padding:14px;margin:10px 0;">
        <div class="kicker">오늘 볼 사람</div>
        <p class="member-muted" style="margin:6px 0 0;">
          없습니다. 고객 ${total}명 모두 잘 따라오고 있습니다.
        </p>
      </div>`;
    return;
  }

  const rows = list.map((c) => {
    const flags = Array.isArray(c.flags) ? c.flags : [];
    const chips = flags.map((f) => {
      const [label] = ATTENTION_LABEL[f] || [f];
      return `<span class="pill" style="margin-right:6px;">${escapeHtml(label)}</span>`;
    }).join('');
    // 왜 떴는지를 숫자로 같이 보여줍니다. 근거 없는 목록은 신뢰를 못 얻습니다.
    const why = [];
    if (flags.includes('inactive')) why.push(`${c.days_inactive}일째 안 열었습니다`);
    if (flags.includes('low_completion')) why.push(`최근 ${c.planned}개 중 ${c.completed}개 완료`);
    if (flags.includes('hard_streak')) why.push(`"힘들었다" ${c.hard_count}회`);
    if (flags.includes('ending_soon') && c.day_no) why.push(`${c.duration_days}일 중 ${c.day_no}일차`);
    if (flags.includes('not_started')) why.push('진행 중인 루틴 없음');

    return `
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 0;border-top:1px solid rgba(1,71,37,0.08);">
        <div style="flex:1;min-width:180px;">
          <div style="font-weight:700;">${escapeHtml(c.display_name || '(이름 없음)')}</div>
          <div style="margin-top:4px;">${chips}</div>
          <div class="member-muted" style="font-size:0.85rem;margin-top:4px;">${escapeHtml(why.join(' · '))}</div>
        </div>
        <button class="btn btn-primary" data-open-client="${escapeAttr(c.client_user_id)}"
                data-client-name="${escapeAttr(c.display_name || '고객')}" type="button">결과 보기</button>
      </div>`;
  }).join('');

  host.innerHTML = `
    <div class="panel" style="padding:14px;margin:10px 0;">
      <div class="kicker">오늘 볼 사람 · 고객 ${total}명 중 ${list.length}명</div>
      <p class="member-muted" style="margin:6px 0 2px;font-size:0.85rem;">
        수행 기록에서 나온 운영 신호입니다. 몸 상태에 대한 판단이 아닙니다.
      </p>
      ${rows}
    </div>`;

  host.querySelectorAll('[data-open-client]').forEach((button) => {
    button.addEventListener('click', () => openClient(button.dataset.openClient, button.dataset.clientName));
  });
}

function renderClients(clients) {
  const host = $('#clientsList');
  if (!host) return;

  if (!clients.length) {
    host.innerHTML = '<p class="member-muted">아직 고객이 없습니다. 위에서 초대 링크를 만들어 보내세요.</p>';
    return;
  }

  host.innerHTML = clients.map((client) => {
    const status = client.expired ? '만료됨' : (CLIENT_STATUS_LABEL[client.status] || client.status);
    // 동의 전에는 이름도 코드도 없습니다. 서버가 아예 내려주지 않습니다.
    // 이름이 없을 수 있습니다. 수락 전이면 아직 누구인지 모르는 것이고, 수락 뒤라면
    // 그 사람이 이름을 안 넣은 것입니다. 둘을 같은 말로 쓰면 화면이 거짓말을 합니다.
    const pendingName = client.status === 'INVITED' && !client.clientUserId;
    const name = client.displayName
      ? escapeHtml(client.displayName)
      : `<span class="member-muted">${pendingName ? '수락 전' : '이름 미등록'}</span>`;
    const code = client.bodyCode
      ? `<b>${escapeHtml(client.bodyCode)}</b>`
      : '<span class="member-muted">—</span>';
    const canOpen = client.status === 'ACTIVE' && client.consentedAt && client.clientUserId;
    return `
      <div class="panel" style="padding:14px;margin-bottom:10px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <div style="flex:1;min-width:180px;">
          <div style="font-weight:700;">${name}</div>
          <div class="member-muted" style="font-size:0.85rem;margin-top:2px;">
            ${escapeHtml(status)} · 초대 ${formatDate(client.invitedAt)}
          </div>
        </div>
        <div style="min-width:80px;">${code}</div>
        ${client.inviteUrl ? `<button class="btn btn-soft" data-copy-invite="${escapeAttr(client.inviteUrl)}" type="button">링크 복사</button>` : ''}
        ${canOpen ? `<button class="btn btn-primary" data-open-client="${escapeAttr(client.clientUserId)}" data-client-name="${escapeAttr(client.displayName || '고객')}" type="button">결과 보기</button>` : ''}
        ${client.status !== 'REVOKED' ? `<button class="btn btn-soft" data-revoke-client="${escapeAttr(client.relationId)}" type="button">연결 끊기</button>` : ''}
      </div>`;
  }).join('');

  host.querySelectorAll('[data-copy-invite]').forEach((button) => {
    button.addEventListener('click', () => copyText(button.dataset.copyInvite, '초대 링크를 복사했습니다.'));
  });
  host.querySelectorAll('[data-open-client]').forEach((button) => {
    button.addEventListener('click', () => openClient(button.dataset.openClient, button.dataset.clientName));
  });
  host.querySelectorAll('[data-revoke-client]').forEach((button) => {
    button.addEventListener('click', async () => {
      const ok = await confirmAction({
        title: '이 고객과의 연결을 끊을까요?',
        body: '끊으면 결과를 더 볼 수 없습니다. 다시 보려면 새 초대 링크를 보내고 고객이 다시 동의해야 합니다.',
        confirmLabel: '연결 끊기',
      });
      if (!ok) return;
      try {
        await api(`/api/professional/clients/${button.dataset.revokeClient}`, { method: 'DELETE' });
        await loadClients();
        setMessage('연결을 끊었습니다.', true);
      } catch (error) {
        setMessage(error.message, false);
      }
    });
  });
}

async function createInvite() {
  try {
    const invite = await api('/api/professional/clients/invite', { method: 'POST' });
    $('#inviteUrl').value = invite.inviteUrl;
    $('#inviteResult').classList.remove('hidden');
    await loadClients();
    setMessage('초대 링크를 만들었습니다. 7일 뒤 만료되고 한 번만 쓸 수 있습니다.', true);
  } catch (error) {
    setMessage(error.message, false);
  }
}

const FEELING_LABEL = { BETTER: '나아짐', SAME: '비슷함', UNCOMFORTABLE: '불편함' };
const DIFFICULTY_LABEL = { EASY: '쉬움', GOOD: '알맞음', HARD: '힘듦' };

/**
 * 고객 상세 — 체형 결과(Phase 1)와 수행 기록(Phase 2).
 *
 * 수행 기록은 따로 부릅니다. 결과는 있는데 루틴을 아직 시작하지 않은 고객이 있고,
 * 한 번에 묶으면 그 경우에 화면 전체가 빈 채로 뜹니다.
 */
async function openClient(clientUserId, fallbackName) {
  try {
    const result = await api(`/api/professional/clients/${clientUserId}`);
    $('#clientsSection').classList.add('hidden');
    $('#clientDetailSection').classList.remove('hidden');
    $('#clientDetailName').textContent = result.displayName || fallbackName || '고객';
    $('#clientDetailBody').innerHTML = `
      <div class="panel" style="padding:16px;">
        <div class="kicker">mebody Code</div>
        <h2 style="margin:6px 0 0;">${escapeHtml(result.calculatedCode || '—')}</h2>
        <p class="member-muted" style="margin:6px 0 0;">
          ${result.primaryIdentity ? escapeHtml(result.primaryIdentity) + ' · ' : ''}진단 완료 ${formatDate(result.completedAt)}
        </p>
      </div>
      <div id="clientJourneyBlock" style="margin-top:14px;">
        <p class="member-muted" style="font-size:0.85rem;">수행 기록을 불러오는 중…</p>
      </div>
      <div id="clientDraftBlock" style="margin-top:14px;"></div>
      <div id="clientAssignBlock" style="margin-top:14px;"></div>
      <p class="member-muted" style="margin-top:14px;font-size:0.85rem;line-height:1.7;">
        문항별 답변은 제공하지 않습니다. 상담에 필요한 것은 코드와 축 경향이고,
        답변 원문은 한 번 나가면 돌려받을 수 없습니다.<br />
        고객은 언제든 동의를 거둘 수 있고, 거두면 이 화면도 더 이상 열리지 않습니다.
      </p>`;
    loadClientJourney(clientUserId);
    // 초안은 배정 목록(assignableCache)이 있어야 이름을 보여줄 수 있어서 그 뒤에 부릅니다.
    loadAssignBlock(clientUserId).then(() => loadPlanDraft(clientUserId));
  } catch (error) {
    setMessage(error.message, false);
  }
}

async function loadClientJourney(clientUserId) {
  const host = $('#clientJourneyBlock');
  if (!host) return;
  try {
    const data = await api(`/api/professional/clients/${clientUserId}/journey`);
    host.innerHTML = renderClientJourney(data);
  } catch (error) {
    // 못 불러온 것과 "아직 안 했다" 는 다릅니다. 같은 말로 쓰면 화면이 거짓말을 합니다.
    host.innerHTML = `<p class="member-muted" style="font-size:0.85rem;color:#b3261e;">
      수행 기록을 불러오지 못했습니다 (${escapeHtml(error.message)}). 기록이 없는 것과 다릅니다.</p>`;
  }
}


/* ─────────────────────────────────────────────────────────────────────────
 * Phase 3 — 미션 배정
 *
 * 전문가는 **라이브러리에 있는 동작만** 고를 수 있습니다. 새 동작이나 설명을 직접 써 넣는
 * 입력칸이 없는 것이 요점입니다 — 검증되지 않은 지시를 남의 몸에 나르지 않기 위해서입니다.
 * 덧붙일 수 있는 것은 짧은 메모 한 줄(200자)뿐이고, 하루 3개까지입니다.
 * ───────────────────────────────────────────────────────────────────────── */

let assignableCache = null;

/* ─────────────────────────────────────────────────────────────────────────
 * Phase 4 — 규칙 엔진 초안
 *
 * "앱이 오늘 이 고객에게 무엇을 배정할까" 를 미리 보여주고, 전문가가 빼거나 메모를 붙여
 * 한 번에 배정합니다. 하나씩 고르는 것보다 빠르고, 무엇보다 **앱이 하려던 것을 기준으로**
 * 시작하므로 전문가가 앱과 다른 방향으로 가는 일이 줄어듭니다.
 *
 * ── 계산은 어디서 하는가
 * **앱과 같은 코드**로 이 브라우저에서 합니다(journey-rules.js — 앱의 journeyRules.ts 를
 * 변환한 것). 규칙을 서버나 SQL 로 옮겨 적지 않은 이유는, 그러면 같은 로직이 두 벌이 되고
 * 112개 테스트는 한쪽만 지키기 때문입니다. 서버는 재료만 내려줍니다.
 *
 * ── 초안은 초안입니다
 * 화면에 뜬 것은 아직 고객에게 배정되지 않았습니다. 전문가가 「이대로 배정」 을 눌러야
 * 실제로 들어갑니다. 그때도 하루 3개 제한(059)은 그대로 걸립니다.
 * ───────────────────────────────────────────────────────────────────────── */

let rulesEngine = null;
/**
 * 초안을 만들 때 쓰는 가용 시간.
 *
 * select 에서 읽으면 안 됩니다 — 초안을 다시 그릴 때 select 도 같이 새로 그려져서
 * 고른 값이 사라집니다. 15분으로 바꿔 「다시 만들기」를 눌러도 화면은 5분으로 돌아갔습니다.
 */
let draftMinutes = 5;

async function loadRulesEngine() {
  if (rulesEngine) return rulesEngine;
  rulesEngine = await import('/assets/journey-rules.js');
  return rulesEngine;
}

async function loadPlanDraft(clientUserId) {
  const host = $('#clientDraftBlock');
  if (!host) return;
  host.innerHTML = '<p class="member-muted" style="font-size:0.85rem;">초안을 만드는 중…</p>';
  try {
    const [engine, input] = await Promise.all([
      loadRulesEngine(),
      api(`/api/professional/clients/${clientUserId}/plan-input`),
    ]);

    if (!input?.has_journey) {
      host.innerHTML = `<div class="panel" style="padding:16px;">
        <div class="kicker">DRAFT</div>
        <p class="member-muted" style="margin:6px 0 0;">
          고객이 아직 14일 루틴을 시작하지 않아 초안을 만들 수 없습니다.</p>
      </div>`;
      return;
    }

    // 앱이 오늘 화면에서 쓰는 것과 같은 입력입니다.
    const planned = engine.selectDailyMissions({
      dayNo: input.day_no,
      dayPlan: input.day_plan,
      axisPriority: input.axis_priority,
      contentTags: input.content_tags,
      feedback: input.feedback,
      recentContentKeys: input.recent_content_keys,
      availableMinutes: draftMinutes,
      lastActiveAt: input.last_active_at,
    });

    const already = new Set((input.today_missions || []).map((m) => m.content_key));
    renderPlanDraft(clientUserId, input, planned, already);
  } catch (error) {
    host.innerHTML = `<p class="member-muted" style="font-size:0.85rem;color:#b3261e;">
      초안을 만들지 못했습니다 (${escapeHtml(error.message)}).</p>`;
  }
}

function renderPlanDraft(clientUserId, input, planned, already) {
  const host = $('#clientDraftBlock');
  // 이름·주의사항은 배정 목록에서 옵니다. 그게 없으면 키만 보이는데, 그 상태로
  // 배정하라고 하면 전문가가 무엇을 주는지 모르고 누르게 됩니다.
  const byKey = new Map((assignableCache || []).map((c) => [c.contentKey, c]));
  const namesMissing = byKey.size === 0 && planned.length > 0;

  const rows = planned.map((m, i) => {
    const c = byKey.get(m.content_key);
    const dup = already.has(m.content_key);
    return `
      <div style="border-top:1px solid #e8ede6;padding:10px 0;display:flex;gap:10px;align-items:flex-start;">
        <input type="checkbox" class="draft-pick" data-key="${escapeAttr(m.content_key)}"
               ${dup ? '' : 'checked'} style="margin-top:4px;" />
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:0.9rem;">
            ${escapeHtml(c?.displayName || m.content_key)}
            ${dup ? '<span class="member-muted" style="font-weight:400;"> · 이미 오늘 목록에 있음</span>' : ''}
          </div>
          <div class="member-muted" style="font-size:0.78rem;margin-top:2px;">
            ${escapeHtml(c?.targetMuscle || '')} · ${Math.round((m.planned_duration_sec || 0) / 60)}분
            · 규칙 ${escapeHtml(m.source_rule || '')}
          </div>
          ${c?.caution ? `<div class="member-muted" style="font-size:0.75rem;margin-top:3px;">주의: ${escapeHtml(c.caution)}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  host.innerHTML = `
    <div class="panel" style="padding:16px;">
      <div class="kicker">DRAFT · ${input.day_no}일차</div>
      <p class="member-muted" style="margin:6px 0 12px;font-size:0.85rem;line-height:1.7;">
        앱이 오늘 이 고객에게 배정하려는 것입니다. <b>아직 배정되지 않았습니다</b> —
        빼거나 메모를 붙인 뒤 아래 버튼을 눌러야 들어갑니다. 하루 3개까지입니다.
      </p>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
        <span class="member-muted" style="font-size:0.8rem;">가용 시간</span>
        <select class="input" id="draftMinutes" style="max-width:110px;">
          <option value="5"${draftMinutes === 5 ? ' selected' : ''}>5분</option>
          <option value="15"${draftMinutes === 15 ? ' selected' : ''}>15분</option>
        </select>
        <button class="btn btn-soft" id="redraft" type="button" data-client="${escapeAttr(clientUserId)}">다시 만들기</button>
      </div>
      ${namesMissing
        ? '<p class="member-muted" style="font-size:0.85rem;color:#b3261e;">동작 이름을 불러오지 못했습니다. 새로고침한 뒤 배정하세요.</p>'
        : planned.length === 0
          ? '<p class="member-muted" style="font-size:0.85rem;">오늘은 규칙이 고른 동작이 없습니다.</p>'
          : rows}
      <input class="input" id="draftNote" maxlength="200" placeholder="배정에 붙일 메모 (선택, 200자)" style="margin-top:12px;" />
      <button class="btn btn-primary" id="applyDraft" type="button"
              data-client="${escapeAttr(clientUserId)}" style="margin-top:8px;"
              ${namesMissing || planned.length === 0 ? 'disabled' : ''}>
        고른 것만 배정
      </button>
    </div>`;

  $('#draftMinutes')?.addEventListener('change', (event) => {
    draftMinutes = Number(event.target.value) || 5;
    loadPlanDraft(clientUserId);
  });
  $('#redraft')?.addEventListener('click', () => loadPlanDraft(clientUserId));
  $('#applyDraft')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const keys = [...document.querySelectorAll('.draft-pick')]
      .filter((x) => x.checked).map((x) => x.dataset.key);
    if (keys.length === 0) { setMessage('고른 동작이 없습니다.', false); return; }

    button.disabled = true;
    const note = $('#draftNote')?.value || null;
    let done = 0;
    let stopped = null;
    for (const key of keys) {
      try {
        await api(`/api/professional/clients/${clientUserId}/missions`, {
          method: 'POST', body: JSON.stringify({ contentKey: key, note }),
        });
        done += 1;
      } catch (error) {
        // 하루 3개 제한에 걸리면 거기서 멈춥니다. 몇 개가 들어갔는지 정확히 말해야
        // 전문가가 다시 누를지 말지 판단할 수 있습니다.
        stopped = error.message;
        break;
      }
    }
    button.disabled = false;
    setMessage(stopped
      ? `${done}개 배정하고 멈췄습니다 — ${stopped}`
      : `${done}개를 배정했습니다. 고객의 오늘 목록에 표시됩니다.`, !stopped);
    loadClientJourney(clientUserId);
    loadPlanDraft(clientUserId);
  });
}

async function loadAssignBlock(clientUserId) {
  const host = $('#clientAssignBlock');
  if (!host) return;
  try {
    if (!assignableCache) assignableCache = await api('/api/professional/contents');
    const options = assignableCache.map((c) =>
      `<option value="${escapeAttr(c.contentKey)}">${escapeHtml(c.displayName || c.contentKey)}${c.targetMuscle ? ' — ' + escapeHtml(c.targetMuscle) : ''}</option>`).join('');
    host.innerHTML = `
      <div class="panel" style="padding:16px;">
        <div class="kicker">ASSIGN</div>
        <p class="member-muted" style="margin:6px 0 12px;font-size:0.85rem;line-height:1.7;">
          고객의 오늘 미션에 동작을 하나 추가합니다. <b>하루 3개까지</b>이고, 고객이 아직
          시작하지 않은 것만 거둘 수 있습니다.<br />
          동작은 MEBODY 라이브러리에서만 고릅니다. 새 동작이나 설명을 직접 쓸 수는 없습니다.
        </p>
        <div style="display:grid;gap:8px;">
          <select class="input" id="assignContent">${options}</select>
          <input class="input" id="assignNote" maxlength="200" placeholder="짧은 메모 (선택, 200자)" />
          <div id="assignCaution" class="member-muted" style="font-size:0.8rem;line-height:1.6;"></div>
          <button class="btn btn-primary" id="assignSubmit" type="button" data-client="${escapeAttr(clientUserId)}">미션 추가</button>
        </div>
      </div>`;

    // 고른 동작의 주의사항을 바로 보여줍니다. 배정 전에 읽어야 의미가 있습니다.
    const showCaution = () => {
      const key = $('#assignContent')?.value;
      const c = assignableCache.find((x) => x.contentKey === key);
      $('#assignCaution').textContent = c?.caution ? `주의: ${c.caution}` : '';
    };
    $('#assignContent')?.addEventListener('change', showCaution);
    showCaution();

    $('#assignSubmit')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await api(`/api/professional/clients/${button.dataset.client}/missions`, {
          method: 'POST',
          body: JSON.stringify({ contentKey: $('#assignContent').value, note: $('#assignNote').value || null }),
        });
        $('#assignNote').value = '';
        setMessage('미션을 추가했습니다. 고객의 오늘 목록에 표시됩니다.', true);
        loadClientJourney(button.dataset.client);
      } catch (error) {
        setMessage(error.message, false);
      } finally {
        button.disabled = false;
      }
    });
  } catch (error) {
    host.innerHTML = `<p class="member-muted" style="font-size:0.85rem;">미션 배정을 불러오지 못했습니다 (${escapeHtml(error.message)}).</p>`;
  }
}

function renderClientJourney(data) {
  if (!data?.hasJourney) {
    return `<div class="panel" style="padding:16px;">
      <div class="kicker">ROUTINE</div>
      <p class="member-muted" style="margin:6px 0 0;">아직 14일 루틴을 시작하지 않았습니다.</p>
    </div>`;
  }

  const s = data.summary || {};
  const j = s.journey || {};
  const p = s.progress || {};
  const days = Array.isArray(s.days) ? s.days : [];
  const feedback = Array.isArray(s.feedback) ? s.feedback : [];
  const rate = p.rate == null ? 0 : Number(p.rate);

  // 일자별 막대. 한 눈에 "어디서 멈췄는지" 가 보여야 합니다.
  const timeline = days.map((d) => {
    const planned = Number(d.planned || 0);
    const done = Number(d.completed || 0);
    const skipped = Number(d.skipped || 0);
    const tone = done === planned && planned > 0 ? 'var(--mb-green, #016B38)'
      : done > 0 ? '#9ac3a8'
      : skipped > 0 ? '#e0b4b0'
      : '#e4e9e1';
    return `<div title="${d.day_no}일차 — 배정 ${planned} · 완료 ${done} · 건너뜀 ${skipped}"
      style="flex:1;min-width:14px;">
      <div style="height:${planned > 0 ? 8 + (done / planned) * 30 : 8}px;background:${tone};border-radius:4px;"></div>
      <div style="font-size:0.62rem;color:#7b8a7f;text-align:center;margin-top:3px;">${d.day_no}</div>
    </div>`;
  }).join('');

  const feedbackRows = feedback.length === 0
    ? '<p class="member-muted" style="margin:8px 0 0;font-size:0.85rem;">아직 남긴 피드백이 없습니다.</p>'
    : feedback.map((f) => `
      <div style="border-top:1px solid #e8ede6;padding:10px 0;">
        <div style="font-size:0.78rem;color:#7b8a7f;">
          ${f.day_no}일차 · ${escapeHtml(FEELING_LABEL[f.feeling] || f.feeling || '')}
          · ${escapeHtml(DIFFICULTY_LABEL[f.difficulty] || f.difficulty || '')}
          · ${formatDate(f.created_at)}
        </div>
        ${f.note ? `<div style="margin-top:4px;font-size:0.88rem;">${escapeHtml(f.note)}</div>` : ''}
      </div>`).join('');

  return `
    <div class="panel" style="padding:16px;">
      <div class="kicker">ROUTINE</div>
      <div style="display:flex;gap:16px;align-items:baseline;flex-wrap:wrap;margin-top:6px;">
        <h2 style="margin:0;">${rate}%</h2>
        <span class="member-muted" style="font-size:0.85rem;">
          ${j.current_day || 0} / ${j.total_days || 14}일차 ·
          완료 ${p.completed || 0} · 건너뜀 ${p.skipped || 0} · 남음 ${p.scheduled || 0}
        </span>
      </div>
      <p class="member-muted" style="margin:6px 0 0;font-size:0.82rem;">
        마지막 활동 ${s.last_activity_at ? formatDate(s.last_activity_at) : '없음'}
      </p>
      <div style="display:flex;gap:4px;align-items:flex-end;margin-top:14px;">${timeline}</div>
      <p class="member-muted" style="margin:10px 0 0;font-size:0.75rem;">일자별 수행 (최근 14일)</p>
    </div>

    <div class="panel" style="padding:16px;margin-top:12px;">
      <div class="kicker">FEEDBACK</div>
      <p class="member-muted" style="margin:6px 0 0;font-size:0.82rem;">고객이 미션 뒤에 직접 남긴 말입니다.</p>
      ${feedbackRows}
    </div>`;
}

function copyText(text, okMessage) {
  const done = () => setMessage(okMessage, true);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => {
      $('#inviteUrl').value = text;
      $('#inviteUrl').select();
      setMessage('복사하지 못했습니다. 주소창의 값을 직접 복사해주세요.', false);
    });
    return;
  }
  $('#inviteUrl').value = text;
  $('#inviteUrl').select();
  done();
}

/* ─────────────────────────────────────────────────────────────────────────
 * 운영 지표
 *
 * 퍼널은 "어디서 떨어지는가" 를 보는 도구입니다. 그래서 각 칸의 비율을 **바로 앞 칸 대비**로
 * 보여줍니다. 첫 칸 대비로 그리면 뒤로 갈수록 다 같이 작아져서 어느 칸이 문제인지 안 보입니다.
 *
 * 앞 칸이 0이면 비율을 그리지 않습니다("—"). 0으로 나눈 값을 0%로 적으면
 * "아무도 안 넘어갔다" 로 읽히는데, 사실은 "잴 수 없다" 입니다.
 * ───────────────────────────────────────────────────────────────────────── */

async function loadMetrics() {
  const host = $('#metricsBody');
  if (!host) return;
  const days = Number($('#metricsDays')?.value || 30);
  host.innerHTML = '<p class="member-muted" style="font-size:0.85rem;">불러오는 중…</p>';
  try {
    const m = await api(`/api/admin/metrics/funnels?days=${days}`);
    const proRate = m.professional?.find((s) => s.event === 'professional_result_viewed')?.rate;
    const weekly = m.totalPros > 0 ? Math.round((m.weeklyActivePros / m.totalPros) * 1000) / 10 : null;

    $('#metricsNote').textContent = `최근 ${m.days}일`;
    host.innerHTML = `
      <div class="grid summary-grid" style="margin-bottom:16px;">
        ${statCard('전문가 주지표', proRate == null ? '—' : `${proRate}%`,
          '결과 열람 / 고객 동의 · 30% 미만이면 Phase 2 이후 보류')}
        ${statCard('주간 활성 전문가', weekly == null ? '—' : `${weekly}%`,
          `${m.weeklyActivePros} / ${m.totalPros}명 · 4주간 40% 미만이면 Phase 3 보류`)}
      </div>
      ${funnelTable('진단 퍼널', m.diagnosis)}
      ${funnelTable('저니 퍼널', m.journey)}
      ${funnelTable('수익 퍼널', m.revenue)}
      ${funnelTable('전문가 퍼널', m.professional)}
      <p class="member-muted" style="margin-top:14px;font-size:0.78rem;line-height:1.7;">
        앱 이벤트는 개인을 식별하지 않습니다(analytics_events). 전문가 퍼널의 초대·열람은
        전문가를 구분해야 세므로 별도 기록(professional_activity_log)에서 읽습니다.
      </p>`;
  } catch (error) {
    host.innerHTML = `<p class="member-muted" style="font-size:0.85rem;color:#b3261e;">
      지표를 불러오지 못했습니다 (${escapeHtml(error.message)}). 숫자가 0인 것과 다릅니다.</p>`;
  }
}

function statCard(label, value, hint) {
  return `<div class="panel" style="padding:14px;">
    <div class="kicker">${escapeHtml(label)}</div>
    <h2 style="margin:6px 0 0;">${escapeHtml(value)}</h2>
    <p class="member-muted" style="margin:6px 0 0;font-size:0.78rem;line-height:1.6;">${escapeHtml(hint)}</p>
  </div>`;
}

function funnelTable(title, steps) {
  if (!Array.isArray(steps) || steps.length === 0) return '';
  const max = Math.max(...steps.map((s) => Number(s.count) || 0), 1);
  const rows = steps.map((s) => {
    const n = Number(s.count) || 0;
    const width = Math.max(2, Math.round((n / max) * 100));
    // 앞 칸보다 절반 아래로 떨어지면 눈에 띄게 합니다 — 거기가 볼 곳입니다.
    const drop = s.rate != null && s.rate < 50;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:5px 0;">
        <div style="width:110px;flex-shrink:0;font-size:0.82rem;">${escapeHtml(s.label)}</div>
        <div style="flex:1;min-width:60px;background:#eef3ec;border-radius:5px;overflow:hidden;">
          <div style="width:${width}%;height:16px;background:${drop ? '#d9a7a2' : 'var(--mb-green, #016B38)'};"></div>
        </div>
        <div style="width:52px;text-align:right;font-size:0.82rem;font-weight:700;">${n}</div>
        <div style="width:58px;text-align:right;font-size:0.8rem;color:${drop ? '#b3261e' : '#7b8a7f'};">
          ${s.rate == null ? '—' : s.rate + '%'}
        </div>
      </div>`;
  }).join('');
  return `<div class="panel" style="padding:16px;margin-bottom:12px;">
    <div class="kicker">${escapeHtml(title)}</div>
    <div style="margin-top:10px;">${rows}</div>
  </div>`;
}

function bindMetrics() {
  $('#reloadMetrics')?.addEventListener('click', () => {
    loadMetrics().catch((error) => setMessage(error.message, false));
  });
  $('#metricsDays')?.addEventListener('change', () => {
    loadMetrics().catch((error) => setMessage(error.message, false));
  });
}

function bindClients() {
  $('#createInvite')?.addEventListener('click', createInvite);
  $('#reloadClients')?.addEventListener('click', () => {
    loadClients().catch((error) => setMessage(error.message, false));
  });
  $('#copyInvite')?.addEventListener('click', () => copyText($('#inviteUrl').value, '초대 링크를 복사했습니다.'));
  $('#backToClients')?.addEventListener('click', () => {
    $('#clientDetailSection').classList.add('hidden');
    $('#clientsSection').classList.remove('hidden');
  });
}

function bindHome() {
  if (homeBound) return;
  homeBound = true;

  // 고객 관리 탭의 버튼들. 가드 뒤에 둡니다 — 앞에 두면 bindHome 이 두 번 불릴 때
  // 초대 링크가 두 번 만들어집니다.
  bindClients();
  bindMetrics();

  document.querySelectorAll('[data-auth-tab]').forEach((button) => {
    button.addEventListener('click', () => setAuthMode(button.dataset.authTab));
  });

  document.querySelectorAll('[data-login]').forEach((button) => {
    button.addEventListener('click', () => {
      setAuthMode('signin');
      scrollToEl('#authPanel');
    });
  });

  document.querySelectorAll('[data-signup]').forEach((button) => {
    button.addEventListener('click', () => {
      setAuthMode('signup');
      scrollToEl('#authPanel');
    });
  });

  $('#authForm')?.addEventListener('submit', handleAuthSubmit);
  $('#forgotPassword')?.addEventListener('click', () => {
    handlePasswordReset().catch((error) => setMessage(error.message, false));
  });
  document.querySelectorAll('[data-dashboard-tab]').forEach((button) => {
    button.addEventListener('click', () => setDashboardTab(button.dataset.dashboardTab));
  });
  document.querySelectorAll('[data-logout]').forEach((button) => button.addEventListener('click', () => {
    localStorage.removeItem('mebody.server.accessToken');
    state.token = '';
    state.me = null;
    // `/me` 는 로그인 전용이므로 로그아웃하면 랜딩으로 실제 이동한다.
    // 그냥 showLanding() 만 하면 주소는 /me 인데 내용은 랜딩인 상태가 된다.
    if (isMemberPath()) {
      window.location.assign('/');
      return;
    }
    renderMissionList({ progress: [] });
    updateAccountSection();
    showLanding();
    setAuthMode('signin');
    clearMessage();
    setMessage('로그아웃되었습니다.', true);
    scrollToEl('#authPanel');
  }));
  $('#reloadMissions')?.addEventListener('click', () => loadMissions().catch((error) => setMessage(error.message, false)));
  $('#reloadUsers')?.addEventListener('click', () => Promise.all([loadSummary(), loadUsers()]));
  $('#search')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') loadUsers(); });
  $('#statusFilter')?.addEventListener('change', loadUsers);
  $('#includeDeleted')?.addEventListener('change', loadUsers);
  $('#saveUser')?.addEventListener('click', () => saveUser().catch((error) => setMessage(error.message, false)));
  $('#deleteUser')?.addEventListener('click', () => softDeleteUser().catch((error) => setMessage(error.message, false)));
  $('#loadImages')?.addEventListener('click', () => loadImages().catch((error) => setMessage(error.message, false)));
  $('#uploadImage')?.addEventListener('click', () => uploadImage().catch((error) => setMessage(error.message, false)));
  $('#productImageFile')?.addEventListener('change', refreshProductImageState);
  $('#productStatusFilter')?.addEventListener('change', () => loadProducts().catch((error) => setMessage(error.message, false)));
  $('#reloadProducts')?.addEventListener('click', () => loadProducts().catch((error) => setMessage(error.message, false)));
  $('#saveProduct')?.addEventListener('click', () => saveProduct().catch((error) => setMessage(error.message, false)));
  $('#cancelProductEdit')?.addEventListener('click', () => resetProductForm());
  $('#deleteProduct')?.addEventListener('click', () => deleteProduct().catch((error) => setMessage(error.message, false)));
  $('#reloadOrders')?.addEventListener('click', () => loadOrders().catch((error) => setMessage(error.message, false)));
  $('#orderFulfillmentFilter')?.addEventListener('change', () => loadOrders().catch((error) => setMessage(error.message, false)));
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ko-KR');
}

function renderLatestCodeCell(user) {
  const latestCode = user.latestBodyBtiCode || '';
  const profileCode = user.bodyBtiCode || '';
  const effectiveCode = latestCode || profileCode;

  if (!effectiveCode) {
    return '<span class="code-empty">결과 없음</span>';
  }

  const resultId = user.latestResultId ? String(user.latestResultId).slice(0, 8) : '';
  const date = user.latestResultCompletedAt ? formatDate(user.latestResultCompletedAt) : '진단일 없음';
  const mismatch = latestCode && profileCode && latestCode !== profileCode;

  return `
    <div class="code-cell">
      <strong>${escapeHtml(effectiveCode)}</strong>
      <span>${escapeHtml(date)}${resultId ? ` · #${escapeHtml(resultId)}` : ''}</span>
      ${mismatch ? '<em>프로필 캐시와 다름</em>' : ''}
    </div>
  `;
}

function renderLatestResultDetail(user) {
  const latestCode = user.latestBodyBtiCode || '';
  const profileCode = user.bodyBtiCode || '';
  const effectiveCode = latestCode || profileCode;

  if (!effectiveCode) {
    return `
      <div class="detail-latest muted">
        <strong>최신 결과 없음</strong>
        <span>아직 completed 결과가 없어 프로필 코드도 비어 있습니다.</span>
      </div>
    `;
  }

  const mismatch = latestCode && profileCode && latestCode !== profileCode;
  return `
    <div class="detail-latest ${mismatch ? 'warn' : ''}">
      <strong>최신 표시 코드: ${escapeHtml(effectiveCode)}</strong>
      <span>최신 결과일: ${escapeHtml(formatDate(user.latestResultCompletedAt))}</span>
      <span>결과 ID: ${escapeHtml(user.latestResultId ? String(user.latestResultId).slice(0, 8) : '-')}</span>
      ${mismatch ? `<em>프로필 캐시(${escapeHtml(profileCode)})보다 최신 completed 결과(${escapeHtml(latestCode)})를 우선 표시합니다.</em>` : ''}
    </div>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

bootstrap().catch((error) => {
  console.error(error);
  // 초기화가 어떤 이유로도 실패했을 때 버튼이 적어도 동작하도록 보장한다.
  // bindHome() 은 homeBound 가드가 있어 중복 바인드되지 않는다.
  try {
    bindHome();
    setAuthMode('signin');
  } catch (bindError) {
    console.error('UI 바인드 실패:', bindError);
  }
  showLanding();
  setMessage('초기화 중 오류가 발생했습니다. 새로고침 후 다시 시도해 주세요.', false);
});
