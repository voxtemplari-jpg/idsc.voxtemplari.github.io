// ============================================================
// VOX TEMPLARI
// article.js
//
// Loads an individual published article from Supabase
// and updates the article page + social sharing metadata.
// ============================================================


// ------------------------------------------------------------
// BASIC HELPERS
// ------------------------------------------------------------

const $ = selector =>
  document.querySelector(selector);


const esc = value =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    character =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      })[character]
  );


// ------------------------------------------------------------
// DATE FORMATTER
// ------------------------------------------------------------

const niceDate = value => {

  if (!value) {
    return "";
  }


  try {

    return new Intl.DateTimeFormat(
      "en-PH",
      {
        year: "numeric",
        month: "long",
        day: "numeric"
      }
    ).format(
      new Date(value)
    );

  } catch (error) {

    return "";

  }

};


// ------------------------------------------------------------
// META TAG HELPERS
// ------------------------------------------------------------

function setMetaById(
  id,
  value
) {

  const element =
    document.getElementById(id);


  if (!element) {
    return;
  }


  element.setAttribute(
    "content",
    value || ""
  );

}


function setCanonicalUrl(url) {

  const canonical =
    document.getElementById(
      "canonicalLink"
    );


  if (!canonical) {
    return;
  }


  canonical.setAttribute(
    "href",
    url
  );

}


// ------------------------------------------------------------
// CLEAN ARTICLE URL
// ------------------------------------------------------------

function getCurrentUrl() {

  // Removes unnecessary fragments such as #something
  // while retaining the article slug.

  const url =
    new URL(
      window.location.href
    );


  url.hash =
    "";


  return url.toString();

}


// ------------------------------------------------------------
// UPDATE SOCIAL / SEARCH METADATA
// ------------------------------------------------------------

function updateArticleMetadata(
  article
) {

  const title =
    article.title ||
    "Vox Templari";


  const description =
    article.excerpt ||
    "Read the latest story from Vox Templari.";


  const image =
    article.featured_image_url ||
    "";


  const imageAlt =
    article.image_alt ||
    title;


  const author =
    article.author_name ||
    "Vox Templari";


  const articleUrl =
    getCurrentUrl();


  // ----------------------------------------------------------
  // Browser tab title
  // ----------------------------------------------------------

  document.title =
    `${title} | Vox Templari`;


  // ----------------------------------------------------------
  // Standard metadata
  // ----------------------------------------------------------

  setMetaById(
    "metaDescription",
    description
  );


  setMetaById(
    "metaAuthor",
    author
  );


  // ----------------------------------------------------------
  // Open Graph
  // Facebook / Messenger / Discord / LinkedIn
  // ----------------------------------------------------------

  setMetaById(
    "ogTitle",
    title
  );


  setMetaById(
    "ogDescription",
    description
  );


  setMetaById(
    "ogImage",
    image
  );


  setMetaById(
    "ogImageAlt",
    imageAlt
  );


  setMetaById(
    "ogUrl",
    articleUrl
  );


  // ----------------------------------------------------------
  // Article metadata
  // ----------------------------------------------------------

  setMetaById(
    "articlePublishedTime",
    article.published_at ||
    ""
  );


  setMetaById(
    "articleModifiedTime",
    article.updated_at ||
    ""
  );


  setMetaById(
    "articleAuthor",
    author
  );


  setMetaById(
    "articleSection",
    article.category ||
    ""
  );


  // ----------------------------------------------------------
  // Twitter / X
  // ----------------------------------------------------------

  setMetaById(
    "twitterTitle",
    title
  );


  setMetaById(
    "twitterDescription",
    description
  );


  setMetaById(
    "twitterImage",
    image
  );


  setMetaById(
    "twitterImageAlt",
    imageAlt
  );


  // ----------------------------------------------------------
  // Canonical URL
  // ----------------------------------------------------------

  setCanonicalUrl(
    articleUrl
  );

}


// ============================================================
// LOAD ARTICLE
// ============================================================

async function loadArticle() {


  // ----------------------------------------------------------
  // GET ARTICLE SLUG FROM URL
  //
  // Example:
  // article.html?slug=idsc-at-18
  // ----------------------------------------------------------

  const params =
    new URLSearchParams(
      window.location.search
    );


  const slug =
    params.get(
      "slug"
    );


  if (!slug) {

    showError(
      "No article was specified."
    );

    return;

  }


  // ----------------------------------------------------------
  // CHECK SUPABASE CONNECTION
  // ----------------------------------------------------------

  if (
    !window.VT ||
    !window.VT.configured ||
    !window.VT.supabase
  ) {

    showError(
      "The website is not connected to Supabase."
    );

    return;

  }


  try {


    // --------------------------------------------------------
    // LOAD ONLY A PUBLISHED ARTICLE
    // --------------------------------------------------------

    const {
      data: article,
      error
    } =
      await VT.supabase
        .from("articles")
        .select("*")
        .eq(
          "slug",
          slug
        )
        .eq(
          "status",
          "published"
        )
        .maybeSingle();


    // --------------------------------------------------------
    // ARTICLE NOT FOUND
    // --------------------------------------------------------

    if (
      error ||
      !article
    ) {

      if (error) {

        console.error(
          "Article loading error:",
          error
        );

      }


      showError(
        "Article not found or not yet published."
      );

      return;

    }


    // --------------------------------------------------------
    // UPDATE PAGE + SOCIAL META
    // --------------------------------------------------------

    updateArticleMetadata(
      article
    );


    // --------------------------------------------------------
    // CATEGORY
    // --------------------------------------------------------

    $("#category").textContent =
      article.category ||
      "";


    // --------------------------------------------------------
    // HEADLINE
    // --------------------------------------------------------

    $("#title").textContent =
      article.title ||
      "";


    // --------------------------------------------------------
    // DECK / EXCERPT
    // --------------------------------------------------------

    $("#deck").textContent =
      article.excerpt ||
      "";


    // --------------------------------------------------------
    // BYLINE
    // --------------------------------------------------------

    const author =
      article.author_name ||
      "Vox Templari";


    const publicationDate =
      niceDate(
        article.published_at
      );


    $("#byline").textContent =
      publicationDate
        ? `By ${author} • ${publicationDate}`
        : `By ${author}`;


    // --------------------------------------------------------
    // FEATURED IMAGE
    // --------------------------------------------------------

    const hero =
      $("#hero");


    if (
      article.featured_image_url
    ) {

      hero.src =
        article.featured_image_url;


      hero.alt =
        article.image_alt ||
        article.title ||
        "";


      hero.classList.remove(
        "hidden"
      );


    } else {


      hero.removeAttribute(
        "src"
      );


      hero.classList.add(
        "hidden"
      );

    }


    // --------------------------------------------------------
    // ARTICLE BODY
    // --------------------------------------------------------

    const bodyHtml =
      article.body_html ||
      "";


    if (
      window.DOMPurify
    ) {

      $("#body").innerHTML =
        DOMPurify.sanitize(
          bodyHtml,
          {
            ADD_ATTR: [
              "target",
              "rel"
            ]
          }
        );


    } else {


      // Safe fallback if DOMPurify fails to load.

      $("#body").textContent =
        bodyHtml;

    }


    // --------------------------------------------------------
    // MAKE ARTICLE LINKS SAFER
    // --------------------------------------------------------

    $("#body")
      .querySelectorAll("a")
      .forEach(
        link => {

          // External links open in another tab.

          try {

            const targetUrl =
              new URL(
                link.href,
                window.location.href
              );


            if (
              targetUrl.hostname !==
              window.location.hostname
            ) {

              link.target =
                "_blank";


              link.rel =
                "noopener noreferrer";

            }

          } catch (error) {

            // Ignore malformed URLs.

          }

        }
      );


  } catch (error) {


    console.error(
      "Unexpected article error:",
      error
    );


    showError(
      "The article could not be loaded. Please try again."
    );

  }

}


// ============================================================
// ERROR MESSAGE
// ============================================================

function showError(message) {

  const article =
    $("#article");


  if (!article) {
    return;
  }


  article.innerHTML = `

    <div class="article-shell">

      <div class="empty">

        ${esc(message)}

      </div>

    </div>

  `;

}


// ============================================================
// MOBILE MENU
// ============================================================

$("#menuBtn")?.addEventListener(
  "click",
  () => {

    $("#mainNav")
      ?.classList
      .toggle(
        "open"
      );

  }
);


// ============================================================
// START
// ============================================================

loadArticle();
