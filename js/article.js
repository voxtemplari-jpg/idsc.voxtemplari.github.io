const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const niceDate = value => value ? new Intl.DateTimeFormat('en-PH',{year:'numeric',month:'long',day:'numeric'}).format(new Date(value)) : '';

async function loadArticle() {
  const slug = new URLSearchParams(location.search).get('slug');
  if (!slug) return showError('No article was specified.');
  if (!window.VT.configured) return showError('This starter site is not connected to Supabase yet. Follow README.md to finish setup.');

  const { data:a, error } = await VT.supabase.from('articles').select('*').eq('slug',slug).eq('status','published').maybeSingle();
  if (error || !a) return showError('Article not found or not yet published.');

  document.title = `${article.title} | Vox Templari`;
  $('#category').textContent = a.category || '';
  $('#title').textContent = a.title;
  $('#deck').textContent = a.excerpt || '';
  $('#byline').textContent = `By ${a.author_name || 'Vox Templari'} • ${niceDate(a.published_at)}`;
  if (a.featured_image_url) {
    $('#hero').src = a.featured_image_url;
    $('#hero').alt = a.image_alt || '';
    $('#hero').classList.remove('hidden');
  }
  // DOMPurify is loaded from CDN in article.html to prevent stored HTML from executing scripts.
  $('#body').innerHTML = window.DOMPurify ? DOMPurify.sanitize(a.body_html || '') : esc(a.body_html || '');
}

function showError(message) {
  $('#article').innerHTML = `<div class="empty">${esc(message)}</div>`;
}

$('#menuBtn')?.addEventListener('click',()=>$('#mainNav').classList.toggle('open'));
loadArticle();
