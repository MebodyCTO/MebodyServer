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
const isSeller = () => state.me?.role === 'SELLER';
/** 상품을 올릴 수 있는 역할 — 관리자는 전부, 판매자는 자기 것만. */
const isManager = () => isAdmin() || isSeller();
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
  document.querySelectorAll('[data-manager-only]').forEach((element) => {
    element.classList.toggle('hidden', !isManager());
  });
  // 판매자는 자기 상품만 올리므로 판매자 선택 칸이 필요 없습니다(서버가 본인으로 강제).
  $('#productSellerRow')?.classList.toggle('hidden', !isAdmin());
}

function setDashboardTab(tab) {
  const requestedTab = tab || 'me';
  const managerTabs = ['products', 'orders'];
  const allowed = requestedTab === 'me' || (managerTabs.includes(requestedTab) ? isManager() : isAdmin());
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

  const meta = {
    me: ['MY PAGE', '내 MEBODY', '계정 정보와 최근 체형 코드, 미션 상태를 확인합니다.'],
    users: ['OPERATIONS', '회원·권한 관리', 'Supabase 사용자 프로필과 권한, 등급, 체형 코드를 관리합니다.'],
    products: ['MARKET', '상품 관리', '사진과 함께 상품을 등록합니다. 사진 없이는 등록되지 않고, 등록 즉시 앱 마켓 탭에 반영됩니다.'],
    orders: ['ORDERS', '주문 · 배송', '결제된 주문의 배송 상태를 관리합니다. 발송 처리에는 송장번호가 필요합니다.'],
    storage: ['STORAGE', 'Storage 이미지 관리', 'Supabase Storage 이미지를 서버 권한으로 안전하게 관리합니다.'],
  }[nextTab];
  $('#dashboardKicker').textContent = meta[0];
  $('#dashboardTitle').textContent = meta[1];
  $('#dashboardLead').textContent = meta[2];

  if (nextTab === 'users') Promise.all([loadSummary(), loadUsers()]).catch((error) => setMessage(error.message, false));
  if (nextTab === 'products') loadProducts().catch((error) => setMessage(error.message, false));
  if (nextTab === 'orders') loadOrders().catch((error) => setMessage(error.message, false));
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
    stateLabel.style.color = '#b91c1c';
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
  $('#productsSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  if (!confirm(`${product?.name || '이 상품'}을(를) 삭제할까요? 사진도 함께 지워집니다.`)) return;
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
  el.style.color = ok ? '#014725' : '#b91c1c';
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
  showLanding();
  setMessage('서버 공개 설정을 불러오지 못했습니다.', false);
});
