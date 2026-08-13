const state = {
  config: null,
  mode: 'signin',
  token: localStorage.getItem('mebody.server.accessToken') || '',
  me: null,
  selectedUser: null,
  currentTab: 'me',
};

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
const isAdminPath = () => window.location.pathname === '/admin';
const isAdmin = () => state.me?.role === 'ADMIN';

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
  const payload = await response.json();
  state.config = payload.data;
}

function setAuthMode(mode) {
  state.mode = mode;
  $('#authTitle').textContent = mode === 'signin' ? '로그인' : '회원가입';
  $('#authSubmit').textContent = mode === 'signin' ? '로그인하고 시작' : '회원가입하고 시작';
  $('#name').classList.toggle('hidden', mode === 'signin');
  $('#password').setAttribute('autocomplete', mode === 'signin' ? 'current-password' : 'new-password');
  $('#signupOnlyFields')?.classList.toggle('hidden', mode === 'signin');
  if (mode === 'signin') {
    const confirmInput = $('#passwordConfirm');
    if (confirmInput) confirmInput.value = '';
    const privacy = $('#consentPrivacy');
    if (privacy) privacy.checked = false;
    const terms = $('#consentTerms');
    if (terms) terms.checked = false;
  }
  document.querySelectorAll('[data-auth-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.authTab === mode);
  });
}

function showLanding() {
  $('.nav')?.classList.remove('hidden');
  $('main')?.classList.remove('hidden');
  $('.footer')?.classList.remove('hidden');
  $('#dashboardView')?.classList.add('hidden');
  updateAccountSection();
}

function updateAccountSection() {
  const kicker = $('#accountKicker');
  const title = $('#accountTitle');
  if (!kicker || !title) return;
  
  if (state.me) {
    const displayName = state.me.name || state.me.nickname || state.me.email?.split('@')[0] || 'MEBODY';
    kicker.textContent = 'MY ACCOUNT';
    title.textContent = `${displayName}님, 다시 오신 것을 환영합니다.`;
  } else {
    kicker.textContent = 'ACCOUNT';
    title.textContent = '결과를 저장하고 다음 방문에서 바로 이어보세요.';
  }
}

function showDashboard() {
  $('.nav')?.classList.add('hidden');
  $('main')?.classList.add('hidden');
  $('.footer')?.classList.add('hidden');
  $('#dashboardView')?.classList.remove('hidden');
}

async function supabasePasswordLogin(email, password) {
  if (!state.config?.supabaseUrl || !state.config?.supabaseAnonKey) {
    throw new Error('Server .env에 SUPABASE_URL과 SUPABASE_ANON_KEY가 필요합니다.');
  }
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

async function serverSignup(email, password, displayName) {
  const response = await fetch(apiUrl('/api/public/auth/signup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || `회원가입 처리에 실패했습니다. (${response.status})`);
  }
  return supabasePasswordLogin(email, password);
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

function renderMemberSummary(summary) {
  const profile = summary?.profile || state.me || {};
  const displayName = profile.name || profile.nickname || 'MEBODY 회원';
  const bodyCode = summary?.bodyBtiCode || profile.bodyBtiCode || '';
  const bodyTitle = summary?.bodyBtiTitle || profile.bodyBtiTitle || '';
  const bodyDescription = profile.bodyBtiDescription || '';
  const missionRate = Number(summary?.missionAchievementRate ?? profile.missionAchievementRate ?? 0);

  const memberKicker = document.querySelector('#meSection .member-hero-card .kicker');
  if (memberKicker) {
    memberKicker.textContent = profile.role === 'ADMIN' ? 'ADMIN ACCOUNT' : 'MY ACCOUNT';
  }

  $('#dashboardEmail').textContent = profile.email || '';
  $('#memberName').textContent = displayName;
  $('#memberEmail').textContent = profile.email || '';
  $('#memberRole').textContent = profile.role || 'MEMBER';
  $('#memberRole').className = `pill ${profile.role || ''}`;
  $('#memberStatus').textContent = profile.status || 'ACTIVE';
  $('#memberStatus').className = `pill ${profile.status || ''}`;
  $('#memberGrade').textContent = profile.grade || 'BASIC';

  if (bodyCode) {
    // Mebody code 카드: h2는 코드만, DB 타이틀(캐릭터 멘트)·설명은 하단에 통일
    $('#bodyBtiCode').textContent = bodyCode;
    if (bodyTitle && bodyDescription) {
      $('#bodyBtiDescription').textContent = `${bodyTitle} — ${bodyDescription}`;
    } else if (bodyTitle) {
      $('#bodyBtiDescription').textContent = bodyTitle;
    } else if (bodyDescription) {
      $('#bodyBtiDescription').textContent = bodyDescription;
    } else {
      $('#bodyBtiDescription').textContent = '최근 진단 결과가 계정에 저장되어 있습니다. 모바일 앱에서 코드 플랜과 오늘의 미션을 이어서 확인할 수 있습니다.';
    }
  } else {
    $('#bodyBtiCode').textContent = '아직 결과 없음';
    $('#bodyBtiDescription').textContent = '아직 진단 결과가 없습니다. 모바일 앱에서 체형 코드 분석을 시작해보세요.';
  }

  $('#missionRate').textContent = missionRate;
  $('#missionSummary').textContent = `진행 중 미션 ${Number(summary?.activeMissionCount ?? 0)}개 · 완료 미션 ${Number(summary?.completedMissionCount ?? 0)}개`;
  $('#missionProgressBar').style.width = `${Math.max(0, Math.min(100, missionRate))}%`;
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
}

function configureDashboardAccess() {
  document.querySelectorAll('[data-admin-only]').forEach((element) => {
    element.classList.toggle('hidden', !isAdmin());
  });
}

function setDashboardTab(tab) {
  const requestedTab = tab || 'me';
  const nextTab = requestedTab !== 'me' && !isAdmin() ? 'me' : requestedTab;
  state.currentTab = nextTab;

  document.querySelectorAll('[data-dashboard-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.dashboardTab === nextTab);
  });
  $('#meSection').classList.toggle('hidden', nextTab !== 'me');
  $('#usersSection').classList.toggle('hidden', nextTab !== 'users');
  $('#storageSection').classList.toggle('hidden', nextTab !== 'storage');

  const meta = {
    me: ['MY PAGE', '내 MEBODY', '계정 정보와 최근 체형 코드, 미션 상태를 확인합니다.'],
    users: ['OPERATIONS', '회원·권한 관리', 'Supabase 사용자 프로필과 권한, 등급, 체형 코드를 관리합니다.'],
    storage: ['STORAGE', 'Storage 이미지 관리', 'Supabase Storage 이미지를 서버 권한으로 안전하게 관리합니다.'],
  }[nextTab];
  $('#dashboardKicker').textContent = meta[0];
  $('#dashboardTitle').textContent = meta[1];
  $('#dashboardLead').textContent = meta[2];

  if (nextTab === 'users') Promise.all([loadSummary(), loadUsers()]).catch((error) => setMessage(error.message, false));
  if (nextTab === 'storage') loadImages().catch((error) => setMessage(error.message, false));
}

async function enterDashboard(preferredTab = 'me') {
  clearMessage();
  updateAccountSection();
  await loadMeDashboard();
  configureDashboardAccess();
  showDashboard();
  setDashboardTab(preferredTab);
}

async function bootstrap() {
  await loadConfig();
  bindHome();
  setAuthMode('signin');

  if (!state.token) {
    showLanding();
    if (isAdminPath()) {
      setMessage('로그인하면 권한에 따라 내 페이지 또는 관리자 화면으로 이동합니다.', true);
      $('#authPanel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }

  try {
    // `/admin` 에서만 콘솔(대시보드). `/` 홈은 로그인 상태여도 랜딩을 보여준다.
    if (isAdminPath()) {
      await enterDashboard('users');
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
    if (isAdminPath()) $('#authPanel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    if (password.length < 8) {
      setMessage('비밀번호는 8자 이상이어야 합니다.', false);
      return;
    }
    const confirm = $('#passwordConfirm')?.value ?? '';
    if (password !== confirm) {
      setMessage('비밀번호와 확인이 일치하지 않습니다.', false);
      return;
    }
    if (!($('#consentPrivacy')?.checked && $('#consentTerms')?.checked)) {
      setMessage('개인정보처리방침과 이용약관에 동의해주세요.', false);
      return;
    }
  }

  $('#authSubmit').disabled = true;
  try {
    const auth = state.mode === 'signin'
      ? await supabasePasswordLogin(email, password)
      : await serverSignup(email, password, name);

    localStorage.setItem('mebody.server.accessToken', auth.access_token);
    state.token = auth.access_token;
    // 홈(`/`)에서 로그인해도 랜딩을 유지. 콘솔은 `/admin` 에서만 연다.
    if (isAdminPath()) {
      await enterDashboard('users');
    } else {
      await loadMeDashboard();
      showLanding();
      setMessage('로그인되었습니다.', true);
    }
  } catch (error) {
    setMessage(error.message || '처리 중 오류가 발생했습니다.', false);
  } finally {
    $('#authSubmit').disabled = false;
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
  if (!confirm(`${state.selectedUser.email} 회원을 삭제 처리할까요?`)) return;
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
      if (!confirm(`${button.dataset.deleteImage} 이미지를 삭제할까요?`)) return;
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

function bindHome() {
  document.querySelectorAll('[data-auth-tab]').forEach((button) => {
    button.addEventListener('click', () => setAuthMode(button.dataset.authTab));
  });

  document.querySelectorAll('[data-login]').forEach((button) => {
    button.addEventListener('click', () => {
      setAuthMode('signin');
      $('#authPanel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  document.querySelectorAll('[data-signup]').forEach((button) => {
    button.addEventListener('click', () => {
      setAuthMode('signup');
      $('#authPanel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  $('#authForm')?.addEventListener('submit', handleAuthSubmit);
  document.querySelectorAll('[data-dashboard-tab]').forEach((button) => {
    button.addEventListener('click', () => setDashboardTab(button.dataset.dashboardTab));
  });
  document.querySelectorAll('[data-logout]').forEach((button) => button.addEventListener('click', () => {
    localStorage.removeItem('mebody.server.accessToken');
    state.token = '';
    state.me = null;
    showLanding();
    setAuthMode('signin');
    $('#authPanel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
  $('#reloadUsers')?.addEventListener('click', () => Promise.all([loadSummary(), loadUsers()]));
  $('#search')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') loadUsers(); });
  $('#statusFilter')?.addEventListener('change', loadUsers);
  $('#includeDeleted')?.addEventListener('change', loadUsers);
  $('#saveUser')?.addEventListener('click', () => saveUser().catch((error) => setMessage(error.message, false)));
  $('#deleteUser')?.addEventListener('click', () => softDeleteUser().catch((error) => setMessage(error.message, false)));
  $('#loadImages')?.addEventListener('click', () => loadImages().catch((error) => setMessage(error.message, false)));
  $('#uploadImage')?.addEventListener('click', () => uploadImage().catch((error) => setMessage(error.message, false)));
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
  showLanding();
  setMessage('서버 공개 설정을 불러오지 못했습니다.', false);
});
