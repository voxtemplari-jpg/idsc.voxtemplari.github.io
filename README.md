# Vox Templari CMS Starter

A free-hostable student publication website with a public news site and a protected newsroom dashboard.

## What the website already does

- Public homepage with lead story, featured stories, latest stories, and category filters
- Individual article pages
- Email/password newsroom login
- Four staff roles: Contributor, Author, Editor, Admin
- Create and edit articles without touching HTML
- Rich-text article editor
- Draft vs. published workflow
- Image upload to Supabase Storage
- Drag-and-drop featured-story ordering
- Mobile-responsive layout
- Row Level Security so permissions are enforced in the database, not only hidden in the interface
- Sanitized article HTML on the public article page using DOMPurify

## Recommended free stack

**Frontend hosting:** GitHub Pages  
**Database, authentication, and image storage:** Supabase

The website itself is plain HTML, CSS, and JavaScript. No build command or framework is required.

---

# 1. Create the Supabase backend

1. Go to **supabase.com** and create a free project.
2. Open **SQL Editor**.
3. Copy everything in `supabase/schema.sql` and run it once.
4. Open **Authentication → Users** and create the publication's first account.
5. Open **Table Editor → profiles** and find that new user. Change the role from `contributor` to `admin`.
6. Open **Project Settings / API** and copy:
   - Project URL
   - anon/public key

> Never put the `service_role` key in this website. The browser needs only the anon/public key. Database Row Level Security protects private actions.

# 2. Connect the website

1. Duplicate `js/config.example.js`.
2. Rename the copy to `js/config.js`.
3. Replace the two placeholder values:

```js
window.VT_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_ANON_KEY"
};
```

`js/config.js` must exist before the site is deployed.

# 3. Add staff members

The easiest safe workflow is for the Adviser/Admin to create staff accounts from **Supabase → Authentication → Users**.

Every new user automatically becomes a `contributor`.

Then assign a role in **Table Editor → profiles**:

- **contributor** — creates and edits own drafts; cannot publish
- **author** — creates, edits, and publishes own articles
- **editor** — edits/publishes all articles, deletes stories, controls featured order
- **admin** — same editorial authority plus intended platform/role administration

For most student publications:

- Staff writers → Contributor
- Senior writers → Author (optional)
- Section Editors / Managing Editor / EIC → Editor
- Faculty Adviser / permanent publication account → Admin

# 4. Run it on your computer

Because browsers treat local files differently, use a tiny local web server.

If Python is installed:

```bash
python -m http.server 8000
```

Then open:

`http://localhost:8000`

Newsroom login:

`http://localhost:8000/admin.html`

# 5. Publish free on GitHub Pages

1. Create a GitHub organization or institutional account for the publication if possible. Avoid making a graduating student's personal account the permanent owner.
2. Create a repository, for example `vox-templari`.
3. Upload all files in this folder, including your completed `js/config.js`.
4. In GitHub, open **Settings → Pages**.
5. Choose deployment from the main branch/root folder.
6. GitHub will give you an address similar to:
   `https://YOUR-ACCOUNT.github.io/vox-templari/`

The site uses relative links, so it works as a GitHub project site.

If the school later gives the publication a domain/subdomain, GitHub Pages can also be configured to use it.

# 6. Normal editorial workflow

### Writer
1. Open `admin.html`.
2. Sign in.
3. Click **New article**.
4. Write the headline, byline, section, excerpt, image, and body.
5. Click **Save draft**.

### Editor
1. Sign in.
2. Open the submitted article.
3. Edit headline/body/caption/details as needed.
4. Click **Publish**.
5. In **Featured story order**, drag important published stories upward.
6. Click **Save featured order**.

The first story in the featured list becomes the large lead story on the homepage.

# 7. Turnover procedure every school year

Do not transfer ownership by giving everyone one shared password.

At turnover:

1. Keep the institutional GitHub/Supabase ownership with the adviser or permanent publication account.
2. Create individual accounts for incoming staff.
3. Remove or disable outgoing student logins.
4. Preserve the articles: do not delete a writer's stories when the writer graduates.
5. Change Editor/Admin roles only after the new Editorial Board is officially designated.
6. Keep at least two trusted Admin-level custodians so the publication is not locked out of its own archive.

# 8. Images and storage

The starter automatically uploads selected featured images to the `article-images` Supabase bucket.

For long-term sustainability:

- resize photos before upload;
- web images around 1600–2200 px on the long edge are usually sufficient;
- keep original high-resolution photographs in the publication's separate archive/Drive;
- always write useful alt text and preserve photo credits in the story/caption.

# 9. Backups

Free services should not be treated as the publication's only archival copy.

At least once per term:

- export the `articles` table from Supabase;
- retain original photographs in the publication archive;
- keep the GitHub repository under institutional/publication ownership;
- document who currently has Admin access.

# 10. Files you will edit most often

- `index.html` — public homepage structure
- `styles.css` — colors, typography, layout
- `article.html` — public article shell
- `admin.html` — newsroom editor interface
- `js/site.js` — homepage data/rendering
- `js/admin.js` — newsroom behavior
- `supabase/schema.sql` — database structure/security rules

After the initial setup, ordinary writers and editors should **not need to edit any of these files**. They work from `admin.html`.

# 11. Before going public

Test these scenarios:

- visitor can read published stories but not drafts;
- Contributor can create/edit a draft but cannot publish it;
- Author can publish own article;
- Editor can edit/publish others' articles;
- Editor can drag featured stories;
- outgoing staff account can be removed without deleting its published articles;
- images display on phone and desktop;
- article links work from the GitHub Pages URL.

## Important limitation

Supabase's free plan can pause an inactive project. If the publication goes unused for an extended period, an admin may need to restore/wake the project in Supabase before the site resumes loading database content.

---

Built as a lightweight starter: easy enough for a student editorial board to operate, but structured so the publication can later migrate to a custom domain or a larger CMS without losing its basic editorial workflow.
