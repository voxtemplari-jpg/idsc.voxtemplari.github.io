// ============================================================
// VOX TEMPLARI NEWSROOM
// admin.js
// ============================================================


// ------------------------------------------------------------
// BASIC HELPERS
// ------------------------------------------------------------

const $ = selector => document.querySelector(selector);

const $$ = selector => [
  ...document.querySelectorAll(selector)
];

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

const slugify = value =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);


// ------------------------------------------------------------
// GLOBAL STATE
// ------------------------------------------------------------

let currentUser = null;
let currentProfile = null;
let currentArticleId = null;
let allArticles = [];

let savedEditorRange = null;

let enteringDashboard = false;


// ------------------------------------------------------------
// START NEWSROOM
// ------------------------------------------------------------

if (
  !window.VT ||
  !window.VT.configured ||
  !window.VT.supabase
) {

  showLoginNotice(
    "The newsroom is not connected to Supabase. Check js/config.js.",
    true
  );

} else {

  boot();

}


// ============================================================
// AUTHENTICATION
// ============================================================

async function boot() {

  try {

    const {
      data: { session },
      error
    } = await VT.supabase.auth.getSession();


    if (error) {

      console.error(
        "Supabase session error:",
        error
      );

      showLoginNotice(
        error.message,
        true
      );

      return;

    }


    if (session?.user) {

      await enterDashboard(
        session.user
      );

    } else {

      showLogin();

    }


    // Listen for future authentication changes.
    //
    // IMPORTANT:
    // We only return to the login page when Supabase explicitly
    // reports SIGNED_OUT.
    //
    // This prevents the old "login bounce" problem.

    VT.supabase.auth.onAuthStateChange(
      (event, session) => {

        console.log(
          "[Vox Templari Auth]",
          event,
          session ? "session active" : "no session"
        );


        // Run asynchronously outside the auth callback.
        setTimeout(
          async () => {

            if (event === "SIGNED_OUT") {

              currentUser = null;
              currentProfile = null;

              showLogin();

              return;

            }


            if (
              session?.user &&
              (
                event === "SIGNED_IN" ||
                event === "TOKEN_REFRESHED" ||
                event === "USER_UPDATED"
              )
            ) {

              await enterDashboard(
                session.user
              );

            }

          },
          0
        );

      }
    );


  } catch (error) {

    console.error(
      "Unable to initialize newsroom:",
      error
    );

    showLoginNotice(
      "Unable to initialize the newsroom. Please refresh the page.",
      true
    );

  }

}


// ------------------------------------------------------------
// LOGIN FORM
// ------------------------------------------------------------

$("#loginForm")?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const email =
      $("#email").value.trim();

    const password =
      $("#password").value;


    if (!email || !password) {

      showLoginNotice(
        "Please enter your email and password.",
        true
      );

      return;

    }


    showLoginNotice(
      "Signing in…"
    );


    try {

      const {
        data,
        error
      } =
        await VT.supabase.auth.signInWithPassword({
          email,
          password
        });


      if (error) {

        console.error(
          "Login error:",
          error
        );

        showLoginNotice(
          error.message,
          true
        );

        return;

      }


      if (
        !data?.session ||
        !data?.user
      ) {

        showLoginNotice(
          "Supabase did not create an active login session.",
          true
        );

        return;

      }


      showLoginNotice(
        "Signed in successfully."
      );


      await enterDashboard(
        data.user
      );


    } catch (error) {

      console.error(
        "Unexpected login error:",
        error
      );

      showLoginNotice(
        "Something went wrong while signing in.",
        true
      );

    }

  }
);


// ------------------------------------------------------------
// LOGOUT
// ------------------------------------------------------------

$("#logoutBtn")?.addEventListener(
  "click",
  async () => {

    try {

      await VT.supabase.auth.signOut();

    } catch (error) {

      console.error(
        "Logout error:",
        error
      );

    }

  }
);


// ------------------------------------------------------------
// ENTER DASHBOARD
// ------------------------------------------------------------

async function enterDashboard(user) {

  // Prevent duplicate SIGNED_IN events from trying to load the
  // dashboard twice at the same moment.

  if (enteringDashboard) {
    return;
  }


  enteringDashboard = true;


  try {

    currentUser = user;


    const {
      data: profile,
      error: profileError
    } =
      await VT.supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();


    if (profileError) {

      console.warn(
        "Profile could not be loaded:",
        profileError
      );

    }


    // If a profile does not yet exist, the newsroom can still load
    // using contributor-level permissions.

    currentProfile =
      profile || {
        role: "contributor",
        display_name:
          user.email || "Staff Member"
      };


    $("#loginScreen")
      ?.classList
      .add("hidden");


    $("#dashboard")
      ?.classList
      .remove("hidden");


    if ($("#userLabel")) {

      $("#userLabel").textContent =
        `${
          currentProfile.display_name ||
          user.email
        } • ${
          currentProfile.role
        }`;

    }


    const canFeature =
      [
        "editor",
        "admin"
      ].includes(
        currentProfile.role
      );


    $("#featuredPanel")
      ?.classList
      .toggle(
        "hidden",
        !canFeature
      );


    // Contributors may write drafts,
    // but cannot publish directly.

    $("#publishBtn")
      ?.classList
      .toggle(
        "hidden",
        currentProfile.role === "contributor"
      );


    hideLoginNotice();


    await refreshArticles();


  } catch (error) {

    console.error(
      "Dashboard loading error:",
      error
    );

    showLoginNotice(
      "You are signed in, but the newsroom could not load. Check the browser console for details.",
      true
    );


  } finally {

    enteringDashboard = false;

  }

}


// ------------------------------------------------------------
// LOGIN SCREEN HELPERS
// ------------------------------------------------------------

function showLogin() {

  $("#dashboard")
    ?.classList
    .add("hidden");

  $("#loginScreen")
    ?.classList
    .remove("hidden");

}


function showLoginNotice(
  message,
  isError = false
) {

  const notice =
    $("#loginNotice");

  if (!notice) {
    return;
  }


  notice.textContent =
    message;


  notice.className =
    `notice${isError ? " error" : ""}`;


  notice.classList.remove(
    "hidden"
  );

}


function hideLoginNotice() {

  $("#loginNotice")
    ?.classList
    .add("hidden");

}


function setStatus(message) {

  const status =
    $("#saveStatus");

  if (status) {

    status.textContent =
      message;

  }

}


// ============================================================
// ARTICLES
// ============================================================


// ------------------------------------------------------------
// LOAD ARTICLES
// ------------------------------------------------------------

async function refreshArticles() {

  try {

    const {
      data,
      error
    } =
      await VT.supabase
        .from("articles")
        .select("*")
        .order(
          "updated_at",
          {
            ascending: false
          }
        );


    if (error) {

      console.error(
        "Article loading error:",
        error
      );

      setStatus(
        error.message
      );

      return;

    }


    allArticles =
      data || [];


    renderArticleList();

    renderFeatured();


  } catch (error) {

    console.error(
      "Article refresh error:",
      error
    );

    setStatus(
      "Unable to load articles."
    );

  }

}


// ------------------------------------------------------------
// RENDER ARTICLE LIST
// ------------------------------------------------------------

function renderArticleList() {

  const element =
    $("#articleList");

  if (!element) {
    return;
  }


  const visibleArticles =
    currentProfile?.role ===
    "contributor"

      ? allArticles.filter(
          article =>
            article.author_id ===
            currentUser.id
        )

      : allArticles;


  element.innerHTML =
    visibleArticles
      .map(
        article => {

          const updatedDate =
            article.updated_at
              ? new Date(
                  article.updated_at
                ).toLocaleString()
              : "";


          const canDelete =
            [
              "editor",
              "admin"
            ].includes(
              currentProfile?.role
            );


          return `

            <div class="admin-item">

              <div>

                <div class="admin-item-title">
                  ${esc(article.title)}
                </div>

                <div class="status">

                  ${esc(article.category)}

                  ·

                  <span class="badge ${esc(article.status)}">
                    ${esc(article.status)}
                  </span>

                  · Updated ${esc(updatedDate)}

                </div>

              </div>


              <div class="actions">

                <button
                  type="button"
                  class="btn btn-secondary"
                  data-edit="${article.id}"
                >
                  Edit
                </button>


                ${
                  canDelete
                    ? `
                      <button
                        type="button"
                        class="btn btn-danger"
                        data-delete="${article.id}"
                      >
                        Delete
                      </button>
                    `
                    : ""
                }

              </div>

            </div>

          `;

        }
      )
      .join("") ||

      `
        <div class="empty">
          No articles yet.
        </div>
      `;

}


// ------------------------------------------------------------
// ARTICLE LIST BUTTONS
// ------------------------------------------------------------

$("#articleList")?.addEventListener(
  "click",
  async event => {

    const editButton =
      event.target.closest(
        "[data-edit]"
      );


    if (editButton) {

      openArticle(
        editButton.dataset.edit
      );

      return;

    }


    const deleteButton =
      event.target.closest(
        "[data-delete]"
      );


    if (!deleteButton) {
      return;
    }


    const confirmed =
      confirm(
        "Delete this article permanently?"
      );


    if (!confirmed) {
      return;
    }


    const {
      error
    } =
      await VT.supabase
        .from("articles")
        .delete()
        .eq(
          "id",
          deleteButton.dataset.delete
        );


    if (error) {

      setStatus(
        error.message
      );

      return;

    }


    if (
      currentArticleId ===
      deleteButton.dataset.delete
    ) {

      resetForm();

    }


    await refreshArticles();

  }
);


// ------------------------------------------------------------
// OPEN ARTICLE
// ------------------------------------------------------------

function openArticle(id) {

  const article =
    allArticles.find(
      item =>
        item.id === id
    );


  if (!article) {
    return;
  }


  currentArticleId =
    id;


  $("#formTitle").textContent =
    "Edit Article";


  $("#titleInput").value =
    article.title || "";


  $("#slugInput").value =
    article.slug || "";


  $("#categoryInput").value =
    article.category || "News";


  $("#authorInput").value =
    article.author_name ||
    currentProfile?.display_name ||
    "";


  $("#excerptInput").value =
    article.excerpt || "";


  $("#imageUrlInput").value =
    article.featured_image_url ||
    "";


  $("#imageAltInput").value =
    article.image_alt || "";


  $("#editor").innerHTML =
    article.body_html || "";


  $("#statusInput").value =
    article.status || "draft";


  savedEditorRange = null;


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


// ------------------------------------------------------------
// NEW ARTICLE
// ------------------------------------------------------------

$("#newArticleBtn")?.addEventListener(
  "click",
  resetForm
);


function resetForm() {

  currentArticleId =
    null;


  $("#formTitle").textContent =
    "New Article";


  $("#articleForm")
    ?.reset();


  if ($("#editor")) {

    $("#editor").innerHTML =
      "";

  }


  $("#categoryInput").value =
    "News";


  $("#statusInput").value =
    "draft";


  $("#authorInput").value =
    currentProfile?.display_name ||
    "";


  savedEditorRange =
    null;


  setStatus("");

}


// ------------------------------------------------------------
// AUTOMATIC URL SLUG
// ------------------------------------------------------------

$("#titleInput")?.addEventListener(
  "input",
  event => {

    const slugField =
      $("#slugInput");


    if (
      !currentArticleId ||
      !slugField.value
    ) {

      slugField.value =
        slugify(
          event.target.value
        );

    }

  }
);


// ------------------------------------------------------------
// ARTICLE FORM ACTIONS
// ------------------------------------------------------------

$("#articleForm")?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    await saveArticle(
      $("#statusInput").value ||
      "draft"
    );

  }
);


$("#saveDraftBtn")?.addEventListener(
  "click",
  () =>
    saveArticle(
      "draft"
    )
);


$("#publishBtn")?.addEventListener(
  "click",
  () =>
    saveArticle(
      "published"
    )
);


// ------------------------------------------------------------
// SAVE ARTICLE
// ------------------------------------------------------------

async function saveArticle(status) {

  if (!currentUser) {

    setStatus(
      "You are not signed in."
    );

    return;

  }


  // Contributors cannot directly publish.

  if (
    status === "published" &&
    currentProfile?.role ===
      "contributor"
  ) {

    status =
      "draft";

  }


  const title =
    $("#titleInput")
      .value
      .trim();


  if (!title) {

    setStatus(
      "Title is required."
    );

    return;

  }


  setStatus(
    status === "published"
      ? "Publishing…"
      : "Saving…"
  );


  const existingArticle =
    currentArticleId
      ? allArticles.find(
          article =>
            article.id ===
            currentArticleId
        )
      : null;


  const payload = {

    title,

    slug:
      slugify(
        $("#slugInput").value ||
        title
      ),

    category:
      $("#categoryInput").value,

    author_name:
      $("#authorInput")
        .value
        .trim() ||

      currentProfile?.display_name ||

      currentUser.email,

    excerpt:
      $("#excerptInput")
        .value
        .trim(),

    featured_image_url:
      $("#imageUrlInput")
        .value
        .trim() ||
      null,

    image_alt:
      $("#imageAltInput")
        .value
        .trim(),

    body_html:
      $("#editor").innerHTML,

    status,

    author_id:
      existingArticle
        ? (
            existingArticle.author_id ||
            currentUser.id
          )
        : currentUser.id,

    updated_at:
      new Date().toISOString()

  };


  // Keep the original publication date if editing
  // an already published article.

  if (status === "published") {

    payload.published_at =
      existingArticle?.published_at ||
      new Date().toISOString();

  }


  let result;


  if (currentArticleId) {

    result =
      await VT.supabase
        .from("articles")
        .update(payload)
        .eq(
          "id",
          currentArticleId
        )
        .select()
        .single();

  } else {

    result =
      await VT.supabase
        .from("articles")
        .insert(payload)
        .select()
        .single();

  }


  if (result.error) {

    console.error(
      "Save article error:",
      result.error
    );

    setStatus(
      result.error.message
    );

    return;

  }


  currentArticleId =
    result.data.id;


  $("#statusInput").value =
    status;


  setStatus(
    status === "published"
      ? "Published successfully."
      : "Draft saved."
  );


  await refreshArticles();

}


// ============================================================
// IMAGE UPLOAD
// ============================================================

$("#imageFile")?.addEventListener(
  "change",
  async event => {

    const file =
      event.target.files?.[0];


    if (!file) {
      return;
    }


    if (!currentUser) {

      setStatus(
        "Please sign in before uploading an image."
      );

      return;

    }


    setStatus(
      "Uploading image…"
    );


    const safeName =
      file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "-"
      );


    const path =
      `${
        currentUser.id
      }/${
        Date.now()
      }-${
        safeName
      }`;


    const {
      error
    } =
      await VT.supabase
        .storage
        .from(
          "article-images"
        )
        .upload(
          path,
          file,
          {
            upsert: false
          }
        );


    if (error) {

      console.error(
        "Image upload error:",
        error
      );

      setStatus(
        error.message
      );

      return;

    }


    const {
      data
    } =
      VT.supabase
        .storage
        .from(
          "article-images"
        )
        .getPublicUrl(path);


    $("#imageUrlInput").value =
      data.publicUrl;


    setStatus(
      "Image uploaded."
    );

  }
);


// ============================================================
// RICH TEXT EDITOR
// ============================================================


// ------------------------------------------------------------
// REMEMBER SELECTED TEXT
// ------------------------------------------------------------

function rememberEditorSelection() {

  const editor =
    $("#editor");


  const selection =
    window.getSelection();


  if (
    !editor ||
    !selection ||
    !selection.rangeCount
  ) {

    return;

  }


  const range =
    selection.getRangeAt(0);


  if (
    editor.contains(
      range.commonAncestorContainer
    )
  ) {

    savedEditorRange =
      range.cloneRange();

  }

}


// ------------------------------------------------------------
// RESTORE SELECTED TEXT
// ------------------------------------------------------------

function restoreEditorSelection() {

  if (!savedEditorRange) {
    return;
  }


  const selection =
    window.getSelection();


  selection.removeAllRanges();

  selection.addRange(
    savedEditorRange
  );

}


// ------------------------------------------------------------
// RUN EDITOR COMMAND
// ------------------------------------------------------------

function runEditorCommand(
  command,
  value = null
) {

  restoreEditorSelection();


  const editor =
    $("#editor");


  if (!editor) {
    return;
  }


  editor.focus();


  // Store formatting primarily as inline CSS instead
  // of old <font> tags where the browser supports it.

  try {

    document.execCommand(
      "styleWithCSS",
      false,
      true
    );

  } catch (error) {

    // Safe to ignore.

  }


  document.execCommand(
    command,
    false,
    value
  );


  rememberEditorSelection();

}


// ------------------------------------------------------------
// TRACK EDITOR SELECTION
// ------------------------------------------------------------

$("#editor")?.addEventListener(
  "mouseup",
  rememberEditorSelection
);


$("#editor")?.addEventListener(
  "keyup",
  rememberEditorSelection
);


$("#editor")?.addEventListener(
  "input",
  rememberEditorSelection
);


$("#editor")?.addEventListener(
  "touchend",
  rememberEditorSelection
);


// ------------------------------------------------------------
// TOOLBAR SELECTION PRESERVATION
// ------------------------------------------------------------

$("#toolbar")?.addEventListener(
  "mousedown",
  event => {

    if (
      event.target.closest(
        "button, select"
      )
    ) {

      rememberEditorSelection();

    }

  }
);


// ------------------------------------------------------------
// TOOLBAR BUTTONS
// ------------------------------------------------------------

$("#toolbar")?.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        "button"
      );


    if (!button) {
      return;
    }


    event.preventDefault();


    const command =
      button.dataset.cmd;


    const value =
      button.dataset.value ||
      null;


    if (!command) {
      return;
    }


    if (
      command ===
      "createLink"
    ) {

      restoreEditorSelection();


      const url =
        prompt(
          "Link URL (for example: https://example.com)"
        );


      if (!url) {
        return;
      }


      let safeUrl =
        url.trim();


      // If the editor types example.com rather than
      // https://example.com, automatically add HTTPS.

      if (
        safeUrl &&
        !/^https?:\/\//i.test(
          safeUrl
        ) &&
        !/^mailto:/i.test(
          safeUrl
        )
      ) {

        safeUrl =
          `https://${safeUrl}`;

      }


      runEditorCommand(
        "createLink",
        safeUrl
      );

      return;

    }


    runEditorCommand(
      command,
      value
    );

  }
);


// ------------------------------------------------------------
// FONT FAMILY
// ------------------------------------------------------------

$("#fontFamilySelect")?.addEventListener(
  "change",
  event => {

    const value =
      event.target.value;


    if (value) {

      runEditorCommand(
        "fontName",
        value
      );

    }


    event.target.selectedIndex =
      0;

  }
);


// ------------------------------------------------------------
// FONT SIZE
// ------------------------------------------------------------

$("#fontSizeSelect")?.addEventListener(
  "change",
  event => {

    const value =
      event.target.value;


    if (value) {

      runEditorCommand(
        "fontSize",
        value
      );

    }


    event.target.selectedIndex =
      0;

  }
);


// ============================================================
// FEATURED ARTICLE ORDER
// ============================================================

function renderFeatured() {

  if (
    ![
      "editor",
      "admin"
    ].includes(
      currentProfile?.role
    )
  ) {

    return;

  }


  const featuredList =
    $("#featuredList");


  if (!featuredList) {
    return;
  }


  const publishedArticles =
    allArticles
      .filter(
        article =>
          article.status ===
          "published"
      )
      .sort(
        (articleA, articleB) => {

          const rankDifference =
            (
              articleA.featured_rank ??
              999
            ) -
            (
              articleB.featured_rank ??
              999
            );


          if (rankDifference !== 0) {

            return rankDifference;

          }


          return (
            new Date(
              articleB.published_at ||
              0
            ) -
            new Date(
              articleA.published_at ||
              0
            )
          );

        }
      );


  featuredList.innerHTML =
    publishedArticles
      .map(
        article => `

          <div
            class="drag-item"
            draggable="true"
            data-id="${article.id}"
          >

            <span class="drag-handle">
              ☰
            </span>

            <span>
              ${esc(article.title)}
            </span>

          </div>

        `
      )
      .join("") ||

      `
        <div class="empty">
          Publish an article first.
        </div>
      `;


  setupDrag();

}


// ------------------------------------------------------------
// DRAG AND DROP
// ------------------------------------------------------------

function setupDrag() {

  const list =
    $("#featuredList");


  if (!list) {
    return;
  }


  let dragging =
    null;


  $$(".drag-item").forEach(
    item => {

      item.addEventListener(
        "dragstart",
        () => {

          dragging =
            item;

          item.classList.add(
            "dragging"
          );

        }
      );


      item.addEventListener(
        "dragend",
        () => {

          item.classList.remove(
            "dragging"
          );

          dragging =
            null;

        }
      );

    }
  );


  list.addEventListener(
    "dragover",
    event => {

      event.preventDefault();


      if (!dragging) {
        return;
      }


      const siblings = [
        ...list.querySelectorAll(
          ".drag-item:not(.dragging)"
        )
      ];


      const nextSibling =
        siblings.find(
          sibling =>
            event.clientY <=
            (
              sibling
                .getBoundingClientRect()
                .top +
              sibling.offsetHeight /
                2
            )
        );


      list.insertBefore(
        dragging,
        nextSibling ||
        null
      );

    }
  );

}


// ------------------------------------------------------------
// SAVE FEATURED ORDER
// ------------------------------------------------------------

$("#saveFeaturedBtn")?.addEventListener(
  "click",
  async () => {

    const ids =
      $$("#featuredList .drag-item")
        .map(
          item =>
            item.dataset.id
        );


    setStatus(
      "Saving featured order…"
    );


    for (
      let index = 0;
      index < ids.length;
      index++
    ) {

      const {
        error
      } =
        await VT.supabase
          .from("articles")
          .update({
            featured_rank:
              index + 1
          })
          .eq(
            "id",
            ids[index]
          );


      if (error) {

        console.error(
          "Featured order error:",
          error
        );

        setStatus(
          error.message
        );

        return;

      }

    }


    setStatus(
      "Featured order saved."
    );


    await refreshArticles();

  }
);
