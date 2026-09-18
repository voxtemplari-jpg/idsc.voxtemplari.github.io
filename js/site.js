const CATEGORIES = ['News','Features','Editorial','Opinion','Sports','Campus Life','Photojournalism'];
const placeholder = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750"><rect width="100%" height="100%" fill="#e6e3d9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#476255" font-family="Georgia" font-size="54">Vox Templari</text></svg>`);

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const niceDate = value => value ? new Intl.DateTimeFormat('en-PH',{year:'numeric',month:'short',day:'numeric'}).format(new Date(value)) : '';
const articleHref = slug =>
  `articles/${encodeURIComponent(slug)}/`;

function renderCard(a) {
  return `<article class="story-card" data-category="${esc(a.category)}">
    <a href="${articleHref(a.slug)}"><img src="${esc(a.featured_image_url || placeholder)}" alt="${esc(a.image_alt || '')}"></a>
    <div class="story-card-copy">
      <div class="story-meta"><span class="story-category">${esc(a.category)}</span><span>•</span><span>${niceDate(a.published_at)}</span></div>
      <a href="${articleHref(a.slug)}"><h3>${esc(a.title)}</h3></a>
      <p>${esc(a.excerpt || '')}</p>
    </div>
  </article>`;
}

const sampleStories = [
  {title:'A newsroom built to outlast every editorial board',slug:'newsroom-built-to-last',excerpt:'This preview story shows how articles will appear after the publication connects its database.',category:'News',published_at:new Date().toISOString()},
  {title:'Stories, photographs, and voices from across campus',slug:'campus-voices',excerpt:'Use categories to organize everything from breaking campus news to long-form features.',category:'Features',published_at:new Date(Date.now()-86400000).toISOString()},
  {title:'Editorial independence begins with a clear workflow',slug:'editorial-workflow',excerpt:'Writers draft, editors review, and authorized staff publish.',category:'Editorial',published_at:new Date(Date.now()-172800000).toISOString()}
];

async function loadStories() {
  const featuredEl = $('#featuredStories');
  const gridEl = $('#storyGrid');
  if (!window.VT.configured) {
    featuredEl.innerHTML = `<div class="empty">Connect Supabase in <strong>js/config.js</strong> to load published stories. The layout is ready for your newsroom data.</div>`;
    gridEl.innerHTML = sampleStories.map(renderCard).join('');
    return;
  }
  const { data, error } = await VT.supabase.from('articles')
    .select('id,title,slug,excerpt,category,featured_image_url,image_alt,published_at,featured_rank,author_name')
    .eq('status','published')
    .order('published_at',{ascending:false});
  if (error) {
    featuredEl.innerHTML = `<div class="empty">Could not load stories: ${esc(error.message)}</div>`;
    return;
  }
  renderStories(data || []);
}

function renderStories(stories) {
  const featuredEl = $('#featuredStories');
  const gridEl = $('#storyGrid');
  const featured = [...stories].filter(x => Number.isFinite(x.featured_rank)).sort((a,b)=>a.featured_rank-b.featured_rank).slice(0,4);
  const lead = featured[0] || stories[0];
  const side = (featured.length > 1 ? featured.slice(1) : stories.filter(x=>x.id!==lead?.id).slice(0,3));

  if (!lead) {
    featuredEl.innerHTML = `<div class="empty">No published stories yet. Sign in to the newsroom and publish your first article.</div>`;
  } else {
    featuredEl.innerHTML = `<div class="hero-main">
      <a href="${articleHref(lead.slug)}"><img class="hero-image" src="${esc(lead.featured_image_url || placeholder)}" alt="${esc(lead.image_alt || '')}"></a>
      <div class="hero-copy"><div class="story-meta"><span class="story-category">${esc(lead.category)}</span><span>•</span><span>${niceDate(lead.published_at)}</span></div>
      <a href="${articleHref(lead.slug)}"><h2>${esc(lead.title)}</h2></a><div class="deck">${esc(lead.excerpt || '')}</div></div>
    </div>
    <div class="hero-side">${side.map(a=>`<article class="hero-side-card"><a href="${articleHref(a.slug)}"><img src="${esc(a.featured_image_url || placeholder)}" alt="${esc(a.image_alt || '')}"></a><div class="hero-side-copy"><div class="story-meta"><span class="story-category">${esc(a.category)}</span></div><a href="${articleHref(a.slug)}"><h3>${esc(a.title)}</h3></a></div></article>`).join('')}</div>`;
  }
  gridEl.innerHTML = stories.map(renderCard).join('') || `<div class="empty">No stories found.</div>`;
}

function setupFilters() {
  const holder = $('#categoryFilters');
  holder.innerHTML = ['All',...CATEGORIES].map((c,i)=>`<button class="filter-btn ${i===0?'active':''}" data-filter="${esc(c)}">${esc(c)}</button>`).join('');
  holder.addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    $$('.filter-btn').forEach(b=>b.classList.toggle('active',b===btn));
    const f = btn.dataset.filter;
    $$('.story-card').forEach(card => card.classList.toggle('hidden', f!=='All' && card.dataset.category!==f));
  });
}

$('#menuBtn')?.addEventListener('click',()=>$('#mainNav').classList.toggle('open'));
setupFilters();
loadStories();
