const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const slugify = s => String(s||'').toLowerCase().trim().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,120);
let currentUser = null;
let currentProfile = null;
let currentArticleId = null;
let allArticles = [];

if (!window.VT.configured) {
  showLoginNotice('Before the newsroom can work, copy js/config.example.js to js/config.js and add your Supabase URL and anon key.', true);
} else {
  boot();
}

async function boot() {
  const { data:{ session } } = await VT.supabase.auth.getSession();
  if (session) await enterDashboard(session.user);
  VT.supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) showLogin();
  });
}

$('#loginForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('#email').value.trim();
  const password = $('#password').value;
  const { data, error } = await VT.supabase.auth.signInWithPassword({email,password});
  if (error) return showLoginNotice(error.message, true);
  await enterDashboard(data.user);
});

$('#logoutBtn')?.addEventListener('click', async()=>{ await VT.supabase.auth.signOut(); showLogin(); });

async function enterDashboard(user) {
  currentUser = user;
  const { data:profile } = await VT.supabase.from('profiles').select('*').eq('id',user.id).maybeSingle();
  currentProfile = profile || {role:'contributor', display_name:user.email};
  $('#loginScreen').classList.add('hidden');
  $('#dashboard').classList.remove('hidden');
  $('#userLabel').textContent = `${currentProfile.display_name || user.email} • ${currentProfile.role}`;
  const canFeature = ['editor','admin'].includes(currentProfile.role);
  $('#featuredPanel').classList.toggle('hidden', !canFeature);
  $('#publishBtn').classList.toggle('hidden', currentProfile.role === 'contributor');
  await refreshArticles();
}

function showLogin(){ $('#dashboard').classList.add('hidden'); $('#loginScreen').classList.remove('hidden'); }
function showLoginNotice(msg,isError=false){ const n=$('#loginNotice'); n.textContent=msg; n.className=`notice${isError?' error':''}`; n.classList.remove('hidden'); }
function setStatus(msg){ $('#saveStatus').textContent=msg; }

async function refreshArticles() {
  let query = VT.supabase.from('articles').select('*').order('updated_at',{ascending:false});
  const { data, error } = await query;
  if (error) return setStatus(error.message);
  allArticles = data || [];
  renderArticleList();
  renderFeatured();
}

function renderArticleList() {
  const el = $('#articleList');
  const visible = currentProfile.role === 'contributor' ? allArticles.filter(a=>a.author_id===currentUser.id) : allArticles;
  el.innerHTML = visible.map(a=>`<div class="admin-item"><div><div class="admin-item-title">${esc(a.title)}</div><div class="status">${esc(a.category)} · <span class="badge ${a.status}">${esc(a.status)}</span> · Updated ${new Date(a.updated_at).toLocaleString()}</div></div><div class="actions"><button class="btn btn-secondary" data-edit="${a.id}">Edit</button>${['editor','admin'].includes(currentProfile.role)?`<button class="btn btn-danger" data-delete="${a.id}">Delete</button>`:''}</div></div>`).join('') || '<div class="empty">No articles yet.</div>';
}

$('#articleList')?.addEventListener('click', async e=>{
  const edit = e.target.closest('[data-edit]');
  if (edit) return openArticle(edit.dataset.edit);
  const del = e.target.closest('[data-delete]');
  if (del) {
    if (!confirm('Delete this article permanently?')) return;
    const { error } = await VT.supabase.from('articles').delete().eq('id',del.dataset.delete);
    if (error) return setStatus(error.message);
    if (currentArticleId === del.dataset.delete) resetForm();
    await refreshArticles();
  }
});

function openArticle(id) {
  const a = allArticles.find(x=>x.id===id); if (!a) return;
  currentArticleId = id;
  $('#formTitle').textContent = 'Edit Article';
  $('#titleInput').value = a.title || '';
  $('#slugInput').value = a.slug || '';
  $('#categoryInput').value = a.category || 'News';
  $('#authorInput').value = a.author_name || currentProfile.display_name || '';
  $('#excerptInput').value = a.excerpt || '';
  $('#imageUrlInput').value = a.featured_image_url || '';
  $('#imageAltInput').value = a.image_alt || '';
  $('#editor').innerHTML = a.body_html || '';
  $('#statusInput').value = a.status || 'draft';
  window.scrollTo({top:0,behavior:'smooth'});
}

$('#newArticleBtn')?.addEventListener('click', resetForm);
function resetForm() {
  currentArticleId = null;
  $('#formTitle').textContent = 'New Article';
  $('#articleForm').reset();
  $('#editor').innerHTML = '';
  $('#categoryInput').value='News';
  $('#statusInput').value='draft';
  $('#authorInput').value=currentProfile?.display_name || '';
  setStatus('');
}

$('#titleInput')?.addEventListener('input', e=>{
  if (!currentArticleId || !$('#slugInput').value) $('#slugInput').value=slugify(e.target.value);
});

$('#articleForm')?.addEventListener('submit', async e=>{
  e.preventDefault();
  await saveArticle($('#statusInput').value || 'draft');
});
$('#saveDraftBtn')?.addEventListener('click',()=>saveArticle('draft'));
$('#publishBtn')?.addEventListener('click',()=>saveArticle('published'));

async function saveArticle(status) {
  if (!currentUser) return;
  if (status==='published' && currentProfile.role==='contributor') status='draft';
  const title=$('#titleInput').value.trim();
  if (!title) return setStatus('Title is required.');
  const payload = {
    title,
    slug: slugify($('#slugInput').value || title),
    category: $('#categoryInput').value,
    author_name: $('#authorInput').value.trim() || currentProfile.display_name || currentUser.email,
    excerpt: $('#excerptInput').value.trim(),
    featured_image_url: $('#imageUrlInput').value.trim() || null,
    image_alt: $('#imageAltInput').value.trim(),
    body_html: $('#editor').innerHTML,
    status,
    author_id: currentArticleId ? (allArticles.find(a=>a.id===currentArticleId)?.author_id || currentUser.id) : currentUser.id,
    updated_at: new Date().toISOString()
  };
  if (status==='published' && !currentArticleId) payload.published_at = new Date().toISOString();
  if (status==='published' && currentArticleId) {
    const old=allArticles.find(a=>a.id===currentArticleId);
    payload.published_at = old?.published_at || new Date().toISOString();
  }
  let result;
  if (currentArticleId) result=await VT.supabase.from('articles').update(payload).eq('id',currentArticleId).select().single();
  else result=await VT.supabase.from('articles').insert(payload).select().single();
  if (result.error) return setStatus(result.error.message);
  currentArticleId = result.data.id;
  $('#statusInput').value=status;
  setStatus(status==='published'?'Published successfully.':'Draft saved.');
  await refreshArticles();
}

$('#imageFile')?.addEventListener('change', async e=>{
  const file=e.target.files?.[0]; if (!file) return;
  setStatus('Uploading image…');
  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'-');
  const path=`${currentUser.id}/${Date.now()}-${safeName}`;
  const { error }=await VT.supabase.storage.from('article-images').upload(path,file,{upsert:false});
  if (error) return setStatus(error.message);
  const { data }=VT.supabase.storage.from('article-images').getPublicUrl(path);
  $('#imageUrlInput').value=data.publicUrl;
  setStatus('Image uploaded.');
});

$('#toolbar')?.addEventListener('click', e=>{
  const btn=e.target.closest('button'); if(!btn) return;
  e.preventDefault();
  const cmd=btn.dataset.cmd; const value=btn.dataset.value || null;
  if(cmd==='createLink') { const url=prompt('Link URL'); if(url) document.execCommand(cmd,false,url); }
  else document.execCommand(cmd,false,value);
  $('#editor').focus();
});

function renderFeatured() {
  if (!['editor','admin'].includes(currentProfile?.role)) return;
  const published=allArticles.filter(a=>a.status==='published').sort((a,b)=>(a.featured_rank??999)-(b.featured_rank??999) || new Date(b.published_at)-new Date(a.published_at));
  $('#featuredList').innerHTML=published.map(a=>`<div class="drag-item" draggable="true" data-id="${a.id}"><span class="drag-handle">☰</span><span>${esc(a.title)}</span></div>`).join('') || '<div class="empty">Publish an article first.</div>';
  setupDrag();
}

function setupDrag() {
  const list=$('#featuredList'); let dragging=null;
  $$('.drag-item').forEach(item=>{
    item.addEventListener('dragstart',()=>{dragging=item; item.classList.add('dragging');});
    item.addEventListener('dragend',()=>{item.classList.remove('dragging'); dragging=null;});
  });
  list.addEventListener('dragover',e=>{
    e.preventDefault(); if(!dragging) return;
    const siblings=[...list.querySelectorAll('.drag-item:not(.dragging)')];
    const next=siblings.find(s=>e.clientY <= s.getBoundingClientRect().top+s.offsetHeight/2);
    list.insertBefore(dragging,next||null);
  });
}

$('#saveFeaturedBtn')?.addEventListener('click', async()=>{
  const ids=$$('#featuredList .drag-item').map(x=>x.dataset.id);
  setStatus('Saving featured order…');
  for (let i=0;i<ids.length;i++) {
    const { error }=await VT.supabase.from('articles').update({featured_rank:i+1}).eq('id',ids[i]);
    if(error) return setStatus(error.message);
  }
  setStatus('Featured order saved.');
  await refreshArticles();
});
