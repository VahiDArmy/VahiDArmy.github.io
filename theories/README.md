# نظریه — Theory Studio

A rich Persian (RTL) single-page application for writing, organizing, and publishing theories.

## Features

- Persian RTL UI with Vazirmatn typography
- Rich text editor (headings, lists, quotes, code, links, images, formatting, undo/redo)
- Optional objects attached to each theory (concepts, images, quotes, references, notes, artifacts)
- Optional line-picture canvas with colors and widths
- Optional cover images uploaded by the user to Supabase Storage
- Shamsi (Jalali) calendar formatting for dates and times
- Public explore page with search, tag filters, sorting, grid/list views, and pagination
- Theory detail page with table of contents, reading progress, likes, bookmarks, sharing, related theories, and object/line-picture sections
- Dashboard with author statistics and recent theories
- User profiles with editable settings, avatar upload, password change, and theme options
- Authentication via Supabase Auth
- Command palette (`Ctrl/⌘ + K`)
- Dark and light themes
- Responsive mobile drawer navigation
- Empty states and missing-value placeholders for optional theory content

## Supabase configuration

The application is configured with:

- URL: `https://ummhohozmpwltbgeczsf.supabase.co`
- Publishable key: `sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6`

### Expected tables

The app expects the following tables and columns.

#### `profiles`

- `id` (uuid, primary key, references auth.users)
- `username` (text, unique)
- `full_name` (text)
- `bio` (text)
- `avatar_url` (text)
- `website` (text)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

#### `theories`

- `id` (uuid, primary key)
- `user_id` (uuid, references profiles)
- `title` (text)
- `slug` (text, unique)
- `excerpt` (text)
- `content` (text)
- `cover_image_url` (text)
- `line_picture` (jsonb)
- `tags` (text[])
- `status` (text: `draft`, `published`, `private`)
- `views` (integer)
- `reading_minutes` (integer)
- `published_at` (timestamptz)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

#### `theory_objects`

- `id` (uuid, primary key)
- `theory_id` (uuid, references theories on delete cascade)
- `user_id` (uuid, references profiles)
- `kind` (text)
- `title` (text)
- `description` (text)
- `image_url` (text)
- `link_url` (text)
- `position` (integer)
- `metadata` (jsonb)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

#### `theory_likes`

- `theory_id` (uuid, references theories on delete cascade)
- `user_id` (uuid, references profiles)
- Primary key: (`theory_id`, `user_id`)

#### `theory_bookmarks`

- `theory_id` (uuid, references theories on delete cascade)
- `user_id` (uuid, references profiles)
- Primary key: (`theory_id`, `user_id`)

### Storage

Create a public storage bucket named `theory-images`.

Suggested folders (created automatically by upload paths):

- `{userId}/covers/...`
- `{userId}/avatars/...`

### Optional RPC

The app attempts to call an RPC named `increment_theory_views` with a `theory_id` argument. If it does not exist, the app falls back to a normal update query.

```sql
create or replace function increment_theory_views(theory_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update theories
  set views = coalesce(views, 0) + 1
  where id = theory_id;
end;
$$;
```

## Running

Serve the project root with any static server. The app uses hash-based routing, so no server rewrite rules are required.

```bash
# example
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Project structure

```
index.html
css/
  tokens.css
  base.css
  layout.css
  components.css
  views.css
  responsive.css
js/
  app.js
  shell.js
  config.js
  supabase.js
  api.js
  router.js
  store.js
  utils.js
  date.js
  icons.js
  components.js
  ui.js
  command.js
  rich-editor.js
  line-editor.js
  views/
    auth.js
    landing.js
    explore.js
    theory.js
    editor.js
    dashboard.js
    profile.js
    settings.js
    notfound.js
```
