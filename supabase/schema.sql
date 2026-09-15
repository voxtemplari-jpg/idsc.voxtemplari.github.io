-- VOX TEMPLARI CMS — Supabase setup
-- Run this entire file once in Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'contributor' check (role in ('contributor','author','editor','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text default '',
  body_html text default '',
  category text not null default 'News',
  author_name text,
  author_id uuid references auth.users(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','published')),
  featured_image_url text,
  image_alt text default '',
  featured_rank integer,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Automatically create a contributor profile when a newsroom account is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), 'contributor')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Helper functions used by RLS policies.
create or replace function public.my_role()
returns text language sql stable security definer set search_path=public as $$
  select role from public.profiles where id=auth.uid();
$$;

alter table public.profiles enable row level security;
alter table public.articles enable row level security;

-- Profiles: users can see their own profile; editors/admins can see all.
drop policy if exists "profile_read_self_or_editor" on public.profiles;
create policy "profile_read_self_or_editor" on public.profiles for select
using (id=auth.uid() or public.my_role() in ('editor','admin'));

-- Only admins may change roles/profile records through the API.
drop policy if exists "profile_admin_update" on public.profiles;
create policy "profile_admin_update" on public.profiles for update
using (public.my_role()='admin') with check (public.my_role()='admin');

-- Public can read only published articles. Signed-in newsroom staff can read drafts.
drop policy if exists "articles_public_read" on public.articles;
create policy "articles_public_read" on public.articles for select
using (status='published' or auth.uid() is not null);

-- Any signed-in staff member may create a draft under their own user ID.
drop policy if exists "articles_insert_own" on public.articles;
create policy "articles_insert_own" on public.articles for insert
with check (
  auth.uid() is not null
  and author_id=auth.uid()
  and (status='draft' or public.my_role() in ('author','editor','admin'))
);

-- Contributors can edit their own work but cannot publish. Authors can publish their own.
-- Editors/admins can edit all articles.
drop policy if exists "articles_update_author_or_editor" on public.articles;
create policy "articles_update_author_or_editor" on public.articles for update
using (author_id=auth.uid() or public.my_role() in ('editor','admin'))
with check (
  public.my_role() in ('editor','admin')
  or (author_id=auth.uid() and (status='draft' or public.my_role()='author'))
);

-- Only editors/admins may permanently delete stories.
drop policy if exists "articles_delete_editor" on public.articles;
create policy "articles_delete_editor" on public.articles for delete
using (public.my_role() in ('editor','admin'));

-- Public image bucket for story photographs.
insert into storage.buckets (id,name,public)
values ('article-images','article-images',true)
on conflict (id) do update set public=true;

drop policy if exists "article_images_public_read" on storage.objects;
create policy "article_images_public_read" on storage.objects for select
using (bucket_id='article-images');

drop policy if exists "article_images_authenticated_upload" on storage.objects;
create policy "article_images_authenticated_upload" on storage.objects for insert to authenticated
with check (bucket_id='article-images');

drop policy if exists "article_images_owner_update" on storage.objects;
create policy "article_images_owner_update" on storage.objects for update to authenticated
using (bucket_id='article-images' and owner_id=(select auth.uid()::text));

drop policy if exists "article_images_editor_delete" on storage.objects;
create policy "article_images_editor_delete" on storage.objects for delete to authenticated
using (bucket_id='article-images' and (owner_id=(select auth.uid()::text) or public.my_role() in ('editor','admin')));

-- After creating the first account in Authentication > Users, promote it with:
-- update public.profiles set role='admin', display_name='Your Name' where id='USER_UUID_HERE';
