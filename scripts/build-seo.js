/**
 * 검색 노출용 태그와 sitemap 을 **한 곳에서** 만듭니다.
 *
 * ── 왜 스크립트인가
 * canonical · og:url · sitemap 의 주소는 전부 같은 값이어야 합니다. 세 군데에 손으로 적으면
 * 도메인을 옮길 때 하나를 빠뜨리고, 그러면 구글이 "진짜 페이지는 저쪽" 이라고 읽어
 * 정작 서빙되는 쪽이 색인에서 밀립니다.
 *
 * ── 주소를 어디로 잡나
 * `MEBODY_SITE_ORIGIN` 하나만 봅니다. 기본값은 브랜드 도메인입니다.
 *
 *   **그 도메인이 실제로 이 사이트를 서빙할 때까지 검색엔진에 제출하지 마세요.**
 *   2026-10 기준 mebody.net 은 스퀘어스페이스 「공사 중」 페이지입니다. 그 상태에서
 *   canonical 을 거기로 걸면, 지금 글이 있는 쪽(railway)이 "원본이 아니다" 로 읽혀
 *   오히려 손해입니다. scripts/verify-seo.mjs 가 이 상태를 잡아냅니다.
 *
 *   지금 당장 railway 주소로 등록하려면 빌드 때 이렇게 넘기면 됩니다.
 *     MEBODY_SITE_ORIGIN=https://mebodyserver-production.up.railway.app npm run build:seo
 *
 * 사용: npm run build:seo
 */
const fs = require('fs');
const path = require('path');

const ORIGIN = (process.env.MEBODY_SITE_ORIGIN || 'https://www.mebody.net').trim().replace(/\/+$/, '');
const STATIC = path.join(__dirname, '..', 'src', 'main', 'resources', 'static');

/** 공개 페이지만 넣습니다. /admin · /me 는 robots.txt 가 막고 있어 sitemap 에도 넣지 않습니다. */
const PAGES = [
  { path: '/', file: 'index.html', priority: '1.0', changefreq: 'weekly',
    title: 'mebody | mebody Code · 자세·체형 셀프 체크',
    description: 'mebody는 사전체크와 32문항으로 목·어깨·골반·하체 패턴을 확인하고, 나에게 맞는 mebody Code와 15분 케어 루틴을 안내하는 웰니스 서비스입니다.' },
  { path: '/privacy', file: 'privacy.html', priority: '0.3', changefreq: 'yearly',
    title: '개인정보처리방침 | mebody',
    description: 'mebody가 수집하는 개인정보 항목, 이용 목적, 보유 기간, 파기 절차와 이용자의 권리를 안내합니다.' },
  { path: '/terms', file: 'terms.html', priority: '0.3', changefreq: 'yearly',
    title: '이용약관 | mebody',
    description: 'mebody 서비스의 이용 조건, 회원의 권리와 의무, 유료 서비스와 환불 기준을 안내합니다.' },
];

/**
 * FAQ — AEO(답변 엔진) · GEO(생성형 검색) 대비.
 *
 * ── 쓰는 규칙
 * 1. **첫 문장만 떼어가도 답이 되게** 씁니다. AI 는 보통 한 문단만 인용합니다.
 *    "그것은 ~입니다" 처럼 앞을 받아야 뜻이 통하는 문장을 쓰지 않습니다.
 * 2. 질문은 **사람이 실제로 치는 말**로 적습니다. "mebody Code 산출 방식" 이 아니라
 *    "mebody Code가 뭔가요".
 * 3. 2~4문장. 길면 인용되지 않고, 짧으면 근거가 없어 보입니다.
 * 4. **의료 표현을 쓰지 않습니다.** 이 서비스는 진단하지 않습니다.
 *    AI 가 "진단해준다" 고 요약하면 그게 곧 우리 책임이 됩니다.
 * 5. **금액·확률을 적지 않습니다.** 바뀌면 AI 가 옛 숫자를 계속 퍼뜨립니다.
 *
 * ── 본문과 스키마가 같아야 합니다
 * FAQPage 구조화 데이터의 답이 화면에 없으면 구글이 위반으로 봅니다.
 * 그래서 이 배열 하나에서 **보이는 HTML 과 JSON-LD 를 같이** 만듭니다.
 */
const FAQ = [
  {
    q: 'mebody Code가 뭔가요?',
    a: 'mebody Code는 목·어깨·골반·하체 네 축의 자세 경향을 네 글자로 정리한 분류입니다. 32문항 셀프 체크의 답변으로 계산하며 모두 16가지가 있습니다. 질병을 가려내는 검사가 아니라, 지금 내 몸이 어느 방향을 자주 쓰는지 알아보는 분류입니다.',
  },
  {
    q: '검사하는 데 얼마나 걸리나요?',
    a: '32문항이고 보통 4분 안팎이 걸립니다. 사진을 보며 더 가깝게 느끼는 쪽을 고르는 방식이라 따로 준비할 것이 없습니다. 중간에 나가도 답한 곳까지 남아 있어 이어서 할 수 있습니다.',
  },
  {
    q: '무료인가요?',
    a: '32문항 셀프 체크와 mebody Code 결과는 무료입니다. 매일 하는 공통 스트레칭과 기록도 계속 무료로 쓸 수 있습니다. 14일 루틴은 첫 회차가 무료이고, 그 뒤로 이어서 하려면 멤버십이 필요합니다.',
  },
  {
    q: '병원 진단이나 물리치료와 어떻게 다른가요?',
    a: 'mebody는 의료행위가 아닌 웰니스 셀프 체크입니다. 질병을 진단하거나 통증을 판독하지 않고, 치료나 교정을 처방하지도 않습니다. 통증이나 이상이 있다면 먼저 의료 전문가의 상담을 받으시기를 권합니다.',
  },
  {
    q: '16가지 코드는 어떻게 정해지나요?',
    a: '목·어깨·골반·하체 네 축을 각각 두 방향으로 나눠 조합하면 16가지가 됩니다. 각 코드에는 캐릭터와 한 줄 해석, 네 축 그래프, 오늘 바로 할 수 있는 액션이 함께 붙습니다. 생활 습관과 컨디션에 따라 결과는 달라질 수 있습니다.',
  },
  {
    q: '결과가 나오면 매일 뭘 하나요?',
    a: '매일 하는 공통 스트레칭은 총 15분, 5단계로 목에서 하체 순서입니다. 네 축을 같은 순서로 전부 거치고, 코드에 따라 달라지는 것은 순서가 아니라 세부 구성입니다. 끝까지 마치면 그날의 기록이 쌓이고 적립금을 받습니다.',
  },
  {
    q: '몸 기록은 어떤 기능인가요?',
    a: '몸 기록은 오늘 불편했던 부위, 더 편했던 쪽, 많이 한 활동, 컨디션을 고르기만 하면 되는 하루 기록입니다. 30초면 끝나고, 쌓이면 어떤 날 어디가 반복해서 불편했는지 보입니다. 본인이 느낀 것을 적어두는 기록이며 시스템이 이를 질환으로 해석하지 않습니다.',
  },
  {
    q: '전문가와 연결하면 무엇이 달라지나요?',
    a: '연결에 동의하면 담당 전문가가 내 mebody Code와 몸 기록을 함께 보고, 나에게 맞는 동작을 오늘 할 일에 추가해 줍니다. 전문가가 추가한 동작은 앱에 출처와 메모가 함께 표시됩니다. 전문가는 기록을 읽을 수만 있고 고치거나 지울 수 없으며, 동의를 거두면 그 즉시 열람이 중단됩니다.',
  },
  {
    q: '내 기록은 안전한가요?',
    a: '32문항 답변 원문은 전문가에게도 제공하지 않습니다. 몸 기록은 연결에 동의한 전문가만 볼 수 있고, 동의를 거두면 바로 막힙니다. 탈퇴하면 체크 결과와 몸 기록이 함께 삭제됩니다.',
  },
]

const today = new Date().toISOString().slice(0, 10);

/* ── sitemap ───────────────────────────────────────────────────────────── */
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- scripts/build-seo.js 가 만듭니다. 직접 고치지 마세요 — 다음 빌드에 덮어씁니다. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map((p) => `  <url>
    <loc>${ORIGIN}${p.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(STATIC, 'sitemap.xml'), sitemap, 'utf8');

/* ── robots 에 sitemap 위치를 알려 줍니다 ───────────────────────────────── */
const robotsPath = path.join(STATIC, 'robots.txt');
let robots = fs.readFileSync(robotsPath, 'utf8').replace(/\nSitemap:.*\n?/g, '');
robots = `${robots.trimEnd()}\n\nSitemap: ${ORIGIN}/sitemap.xml\n`;
fs.writeFileSync(robotsPath, robots, 'utf8');

/* ── 페이지마다 canonical · OG · 트위터 카드 ────────────────────────────── */
/** 속성·본문에 그대로 넣기 전에 감쌉니다. 따옴표 하나로 태그가 깨집니다. */
const esc = (v) => String(v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const MARK_OPEN = '<!-- seo:start (build-seo.js) -->';
const MARK_CLOSE = '<!-- seo:end -->';
const FAQ_OPEN = '<!-- faq:start (build-seo.js) -->';
const FAQ_CLOSE = '<!-- faq:end -->';

function seoBlock(page) {
  const url = `${ORIGIN}${page.path}`;
  const image = `${ORIGIN}/og-image.png`;
  return `${MARK_OPEN}
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="mebody" />
    <meta property="og:locale" content="ko_KR" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${page.title}" />
    <meta property="og:description" content="${page.description}" />
    <meta property="og:image" content="${image}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${page.title}" />
    <meta name="twitter:description" content="${page.description}" />
    <meta name="twitter:image" content="${image}" />
    ${MARK_CLOSE}`;
}

/**
 * 조직·사이트 구조화 데이터.
 *
 * 과장하지 않습니다 — 아직 없는 평점(aggregateRating)이나 사업자 정보를 넣으면
 * 구글이 "허위 구조화 데이터" 로 보고 리치 결과를 아예 꺼 버립니다.
 * 사업자 등록이 나오면 주소·전화를 여기에 더합니다.
 */
function jsonLd() {
  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'mebody',
      url: ORIGIN,
      logo: `${ORIGIN}/brand-mark.svg`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'mebody',
      url: ORIGIN,
      inLanguage: 'ko-KR',
      description: PAGES[0].description,
    },
  ];
  // FAQPage — 답이 화면에 **그대로** 있어야 합니다. 같은 FAQ 배열에서 만들므로 어긋날 수 없습니다.
  data.push({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  });
  return `${MARK_OPEN}
    <script type="application/ld+json">${JSON.stringify(data)}</script>
    ${MARK_CLOSE}`;
}

/** 화면에 보이는 FAQ. 스키마와 **같은 배열**에서 만듭니다. */
function faqSection() {
  const items = FAQ.map((f) => `        <details class="mb-faq-item">
          <summary><h3>${esc(f.q)}</h3></summary>
          <p>${esc(f.a)}</p>
        </details>`).join('\n');
  return `${FAQ_OPEN}
      <section id="faq" class="mb-faq" aria-label="자주 묻는 질문">
        <div class="mb-faq-inner">
          <div class="mb-kicker">FAQ</div>
          <h2 class="mb-h2">자주 묻는 질문</h2>
${items}
        </div>
      </section>
      ${FAQ_CLOSE}`;
}

let touched = 0;
for (const page of PAGES) {
  const file = path.join(STATIC, page.file);
  let html = fs.readFileSync(file, 'utf8');

  // 이전 블록을 걷어냅니다. 두 번 돌려도 태그가 쌓이지 않아야 합니다.
  const re = new RegExp(`\\s*${MARK_OPEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${MARK_CLOSE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
  html = html.replace(re, '');

  const block = page.path === '/' ? `${seoBlock(page)}\n    ${jsonLd()}` : seoBlock(page);
  html = html.replace('</head>', `    ${block}\n  </head>`);

  // 랜딩에만 FAQ 섹션을 넣습니다. 두 번 돌려도 쌓이지 않게 먼저 걷어냅니다.
  if (page.path === '/') {
    const faqRe = new RegExp(`\\s*${FAQ_OPEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${FAQ_CLOSE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
    html = html.replace(faqRe, '');
    html = html.replace('<section id="download"', `${faqSection()}\n      <section id="download"`);
  }
  fs.writeFileSync(file, html, 'utf8');
  touched += 1;
}

console.log(`[build-seo] origin=${ORIGIN}`);
console.log(`[build-seo] sitemap ${PAGES.length}개 · robots Sitemap 줄 · 페이지 ${touched}개에 canonical/OG`);
if (ORIGIN.includes('mebody.net')) {
  console.log('[build-seo] ※ mebody.net 이 이 사이트를 실제로 서빙하는지 확인하고 제출하세요 (npm run verify:seo)');
}
