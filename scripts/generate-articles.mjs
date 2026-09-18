import fs from 'node:fs';
import path from 'node:path';
import sanitizeHtml from 'sanitize-html';

const SITE_DIR = process.env.SITE_DIR || '_site';

const SITE_URL = (
  process.env.SITE_URL ||
  'https://voxtemplari.idsc.edu.ph'
).replace(/\/$/, '');


// ============================================================
// READ SUPABASE CONFIG
// ============================================================

function readConfig() {

  const raw =
    fs.readFileSync(
      'js/config.js',
      'utf8'
    );

  const url =
    raw.match(
      /SUPABASE_URL\s*:\s*["'`]([^"'`]+)["'`]/
    )?.[1];

  const key =
    raw.match(
      /SUPABASE_(?:ANON_KEY|PUBLISHABLE_KEY)\s*:\s*["'`]([^"'`]+)["'`]/
    )?.[1];


  if (
    !url ||
    !key ||
    url.includes('YOUR_PROJECT') ||
    key.includes('YOUR_')
  ) {

    throw new Error(
      'Could not read the real Supabase URL/key from js/config.js'
    );

  }


  return {
    url,
    key
  };

}


// ============================================================
// ESCAPE HTML
// ============================================================

function esc(value = '') {

  return String(value).replace(
    /[&<>"']/g,
    ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[ch]
  );

}


// ============================================================
// DATE
// ============================================================

function niceDate(value) {

  if (!value) {
    return '';
  }


  return new Intl.DateTimeFormat(
    'en-PH',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }
  ).format(
    new Date(value)
  );

}


// ============================================================
// CLEAN ARTICLE BODY
// ============================================================

function cleanBody(html = '') {

  return sanitizeHtml(
    String(html),
    {

      allowedTags:
        sanitizeHtml
          .defaults
          .allowedTags
          .concat([
            'img',
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6'
          ]),

      allowedAttributes: {

        '*': [
          'class',
          'style'
        ],

        a: [
          'href',
          'target',
          'rel',
          'title'
        ],

        img: [
          'src',
          'alt',
          'title',
          'width',
          'height'
        ]

      },

      allowedSchemes: [
        'http',
        'https',
        'mailto'
      ],

      allowedStyles: {

        '*': {

          'font-family': [
            /^[^;]+$/
          ],

          'font-size': [
            /^[^;]+$/
          ],

          'text-align': [
            /^(left|right|center|justify)$/
          ],

          'font-weight': [
            /^[^;]+$/
          ],

          'font-style': [
            /^[^;]+$/
          ],

          'text-decoration': [
            /^[^;]+$/
          ]

        }

      },

      transformTags: {

        a:
          sanitizeHtml.simpleTransform(
            'a',
            {
              rel:
                'noopener noreferrer'
            },
            true
          )

      }

    }
  );

}


// ============================================================
// STRUCTURED DATA
// ============================================================

function jsonLd(
  article,
  articleUrl,
  image
) {

  return JSON.stringify({

    '@context':
      'https://schema.org',

    '@type':
      'NewsArticle',

    headline:
      article.title,

    description:
      article.excerpt || '',

    image:
      image
        ? [image]
        : undefined,

    datePublished:
      article.published_at ||
      undefined,

    dateModified:
      article.updated_at ||
      article.published_at ||
      undefined,

    author:
      article.author_name
        ? [
            {
              '@type':
                'Person',

              name:
                article.author_name
            }
          ]
        : undefined,

    publisher: {

      '@type':
        'Organization',

      name:
        'Vox Templari'

    },

    mainEntityOfPage:
      articleUrl,

    articleSection:
      article.category ||
      undefined

  }).replace(
    /</g,
    '\\u003c'
  );

}


// ============================================================
// PREVIOUS / NEXT ARTICLE
// ============================================================

function navLink(
  article,
  direction
) {

  if (!article) {

    return `
      <div
        class="article-nav-item article-nav-empty"
      ></div>
    `;

  }


  const isPrevious =
    direction === 'previous';


  return `

    <a
      class="article-nav-item ${
        isPrevious
          ? 'article-nav-prev'
          : 'article-nav-next'
      }"

      href="${SITE_URL}/articles/${encodeURIComponent(
        article.slug
      )}/"
    >

      <span class="article-nav-label">

        ${
          isPrevious
            ? '← Previous Article'
            : 'Next Article →'
        }

      </span>

      <strong>
        ${esc(article.title)}
      </strong>

    </a>

  `;

}


// ============================================================
// BUILD ARTICLE PAGE
// ============================================================

function page(
  article,
  previousArticle,
  nextArticle
) {

  const articleUrl =
    `${SITE_URL}/articles/${encodeURIComponent(
      article.slug
    )}/`;


  const image =
    article.featured_image_url ||
    '';


  const title =
    article.title ||
    'Vox
