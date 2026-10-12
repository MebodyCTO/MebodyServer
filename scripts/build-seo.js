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
const MARK_OPEN = '<!-- seo:start (build-seo.js) -->';
const MARK_CLOSE = '<!-- seo:end -->';

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
  return `${MARK_OPEN}
    <script type="application/ld+json">${JSON.stringify(data)}</script>
    ${MARK_CLOSE}`;
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
  fs.writeFileSync(file, html, 'utf8');
  touched += 1;
}

console.log(`[build-seo] origin=${ORIGIN}`);
console.log(`[build-seo] sitemap ${PAGES.length}개 · robots Sitemap 줄 · 페이지 ${touched}개에 canonical/OG`);
if (ORIGIN.includes('mebody.net')) {
  console.log('[build-seo] ※ mebody.net 이 이 사이트를 실제로 서빙하는지 확인하고 제출하세요 (npm run verify:seo)');
}
