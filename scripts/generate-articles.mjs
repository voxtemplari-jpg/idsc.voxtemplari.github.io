import fs from 'node:fs';
import path from 'node:path';
import sanitizeHtml from 'sanitize-html';

const SITE_DIR = process.env.SITE_DIR || '_site';
const SITE_URL = (process.env.SITE_URL || 'https://voxtemplari-jpg.github.io/voxtemplari').replace(/\/$/, '');

function readConfig() {
  const raw = fs.readFileSync('js/config.js', 'utf8');
  const url = raw.match(/SUPABASE_URL\s*:\s*["'`]([^"'`]+)["'`]/)?.[1];
  const key = raw.match(/SUPABASE_(?:ANON_KEY|PUBLISHABLE_KEY)\s*:\s*["'`]([^"'`]+)["'`]/)?.[1];
  if (!url || !key || url.includes('YOUR_PROJECT') || key.includes('YOUR_')) {
    throw new Error('Could not read real Supabase URL/key from js/config.js');
  }
  return { url, key };
}

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

function niceDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric'
  }).format(new Date(value));
}

function cleanBody(html = '') {
  return sanitizeHtml(String(html), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
    ]),
    allowedAttributes: {
      '*': ['class', 'style'],
      a: ['href', 'target', 'rel', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedStyles: {
      '*': {
        'font-family': [/^[^;]+$/],
        'font-size': [/^[^;]+$/],
        'text-align': [/^(left|right|center|justify)$/],
        'font-weight': [/^[^;]+$/],
        'font-style': [/^[^;]+$/],
        'text-decoration': [/^[^;]+$/]
      }
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true)
    }
  });
}

function jsonLd(article, url, image) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt || '',
    image: image ? [image] : undefined,
    datePublished: article.published_at || undefined,
    dateModified: article.updated_at || article.published_at || undefined,
    author: article.author_name ? [{ '@type': 'Person', name: article.author_name }] : undefined,
    publisher: { '@type': 'Organization', name: 'Vox Templari' },
    mainEntityOfPage: url,
    articleSection: article.category || undefined
  }).replace(/</g, '\\u003c');
}

function page(article) {
  const articleUrl = `${SITE_URL}/articles/${encodeURIComponent(article.slug)}/`;
  const image = article.featured_image_url || '';
  const title = article.title || 'Vox Templari';
  const description = article.excerpt || 'Read the latest story from Vox Templari.';
  const author = article.author_name || 'Vox Templari';
  const category = article.category || 'News';
  const body = cleanBody(article.body_html || '');
 const imageMeta = image ? `
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:image:secure_url" content="${esc(image)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(article.image_alt || title)}">

  <meta name="twitter:image" content="${esc(image)}">
  <meta name="twitter:image:alt" content="${esc(article.image_alt || title)}">`
  : '';
  const hero = image ? `<img id="hero" class="article-hero" src="${esc(image)}" alt="${esc(article.image_alt || title)}">` : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)} | Vox Templari</title>
  <meta name="description" content="${esc(description)}">
  <meta name="author" content="${esc(author)}">

  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Vox Templari">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(articleUrl)}">${imageMeta}
  <meta property="article:published_time" content="${esc(article.published_at || '')}">
  <meta property="article:modified_time" content="${esc(article.updated_at || article.published_at || '')}">
  <meta property="article:author" content="${esc(author)}">
  <meta property="article:section" content="${esc(category)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">

  <link rel="canonical" href="${esc(articleUrl)}">
  <link rel="stylesheet" href="${SITE_URL}/styles.css">
  <script type="application/ld+json">${jsonLd(article, articleUrl, image)}</script>
</head>
<body>
  <header class="site-header">
    <div class="container header-row">
    <a class="brand" href="${SITE_URL}/">
      <div class="brand-mark">VT</div>
    <div>
    <div class="brand-title">Vox Templari</div>
    <div class="brand-sub">Official Student Publication</div>
  </div>
</a>
      <nav class="nav">
        <a href="${SITE_URL}/">Home</a>
        <a href="${SITE_URL}/#latest">Latest</a>
      </nav>
    </div>
  </header>

  <main id="article">
    <div class="article-shell">
      <div class="article-category">${esc(category)}</div>
      <h1>${esc(title)}</h1>
      <div class="article-deck">${esc(description)}</div>
      <div class="byline">By ${esc(author)}${article.published_at ? ` • ${esc(niceDate(article.published_at))}` : ''}</div>
    </div>
    ${hero}
    <div class="article-shell">
      <article class="article-body">${body}</article>
    </div>
  </main>

  <footer class="site-footer">
    <div class="container">
      <div class="footer-title">Vox Templari</div>
      <p class="footer-small">Student journalism preserved beyond every editorial term.</p>
    </div>
  </footer>
</body>
</html>`;
}

const { url: supabaseUrl, key } = readConfig();
const endpoint = new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/articles`);
endpoint.searchParams.set('select', 'title,slug,excerpt,body_html,category,author_name,featured_image_url,image_alt,published_at,updated_at');
endpoint.searchParams.set('status', 'eq.published');
endpoint.searchParams.set('order', 'published_at.desc');

const response = await fetch(endpoint, {
  headers: { apikey: key, Authorization: `Bearer ${key}` }
});
if (!response.ok) throw new Error(`Supabase returned ${response.status}: ${await response.text()}`);
const articles = await response.json();

const articlesRoot = path.join(SITE_DIR, 'articles');
fs.rmSync(articlesRoot, { recursive: true, force: true });
fs.mkdirSync(articlesRoot, { recursive: true });

for (const article of articles) {
  if (!article.slug) continue;
  const dir = path.join(articlesRoot, article.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(article));
}

console.log(`Generated ${articles.length} static article page(s).`);
