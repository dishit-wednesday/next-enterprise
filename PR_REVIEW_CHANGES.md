# PR Review Changes

Summary of all comments from reviewer **Anurag-Wednesday** and the changes made in response.

---

## ✅ Addressed

### 1. SVGs should come from assets / components

**Comment:** All inline SVGs in components (MiniPlayer, SongCard, SearchBar, TopNav, Sidebar) should be moved to a shared asset location.

**Change:** Created `components/icons/index.tsx` with named React components for every icon:
- `PlayIcon`, `PauseIcon`, `CloseIcon`, `SearchIcon`, `SpinnerIcon`
- `HomeIcon`, `MusicNoteIcon`, `AlbumIcon`, `ArtistIcon`, `DiscoverLogoIcon`

All icons use `currentColor` for fill/stroke so Tailwind `text-*` classes control color. Each accepts `className`, `width`, `height` props.

All inline SVGs in `MiniPlayer`, `SongCard`, `SearchBar`, `TopNav`, and `Sidebar` replaced with the corresponding icon components.

---

### 2. `formatDuration` should be in utils

**Comment (SongCard):** `formatDuration` is a display utility and should live in a shared utils file, not inline in the component.

**Change:** Moved `formatDuration` from `components/SongCard/SongCard.tsx` to `lib/itunes/utils.ts`. `SongCard` now imports it from there.

---

### 3. `extractReleaseYear` should be in utils

**Comment (AlbumCard):** "This should be in utils as other components will also need this."

**Change:** Moved `extractReleaseYear` from `components/AlbumCard/AlbumCard.tsx` to `lib/itunes/utils.ts`. `AlbumCard` now imports it from there.

---

### 4. `shouldShow*` conditions should be in a util

**Comment (HomeContent):** `shouldShowAlbums`, `shouldShowArtists`, etc. are repeated boolean conditions that belong in a util.

**Change:** Added `isVisibleInView(activeView, sectionView)` to `lib/itunes/utils.ts`:

```ts
export function isVisibleInView(activeView: string, sectionView: string): boolean {
  return activeView === "home" || activeView === sectionView
}
```

`HomeContent` now calls `isVisibleInView(activeView, "songs")`, `isVisibleInView(activeView, "albums")`, etc.

---

### 5. Text should come from translations

**Comment (HomeContent):** Section headings ("🔥 Trending Right Now", "💿 Top Albums", etc.) should come from a translations/i18n file.

**Change:** Created `lib/translations.ts` with:
- `HOME_SECTION_TITLES` — object keyed by section, mapping view name → display string
- `getSectionTitle(titles, activeView)` — helper to pick the correct label

`HomeContent` imports and uses both. Section titles now have context-aware labels (e.g. "🔥 Trending Right Now" on Home, "Trending Songs" on the Songs view).

---

### 6. Import order is incorrect

**Comment (MiniPlayer, and others):** Imports should follow the project's ESLint rule — external packages first, then internal imports sorted alphabetically by path (`components/` < `lib/` < `store/`).

**Change:** Fixed import order in:
- `components/MiniPlayer/MiniPlayer.tsx`
- `components/SongCard/SongCard.tsx`
- `components/Sidebar/Sidebar.tsx` (regression fixed — `lib/constants` moved after `components/icons` and `lib/cn`)
- `components/HomeContent/HomeContent.tsx` (regression fixed — `lib/constants` moved after all `components/` imports)
- `components/TopNav/TopNav.tsx`
- `components/SearchBar/SearchBar.tsx`

---

### 7. `ActiveView` should come from constants

**Comment (page.tsx):** `ActiveView` type was defined inline in `app/page.tsx`. It should be a single source of truth.

**Change:** Created `lib/constants.ts` with:

```ts
export const ACTIVE_VIEWS = ["home", "search", "songs", "albums", "artists"] as const
export type ActiveView = (typeof ACTIVE_VIEWS)[number]
```

Type is now derived from the runtime constant array — a single source of truth. `app/page.tsx`, `Sidebar`, and `HomeContent` all import from `lib/constants`.

---

### 8. `isHomeView` condition should use a util

**Comment (page.tsx):** `const isHomeView = activeView !== "search"` is an inline boolean — should be a named util.

**Change:** Added `isHomeView` type predicate to `lib/constants.ts`:

```ts
export function isHomeView(view: ActiveView): view is Exclude<ActiveView, "search"> {
  return view !== "search"
}
```

`app/page.tsx` now calls `isHomeView(activeView)` — and TypeScript narrows the type correctly for `HomeContent`'s `activeView` prop.

---

### 9. Ternary render in JSX should be a util function

**Comment (page.tsx):** The inline ternary `{isHomeView ? <HomeContent /> : <SearchResults />}` should be extracted into a named function.

**Change:** Extracted `renderContent()` inside `HomePage`:

```ts
function renderContent() {
  if (isHomeView(activeView)) {
    return <HomeContent activeView={activeView} />
  }
  return <SearchResults songs={songs} albums={albums} artists={artists} ... />
}
```

JSX now calls `{renderContent()}` — cleaner and easier to extend.

---

### 10. Hardcoded `ITUNES_BASE_URL` in API routes

**Comment (implicit — identified during review):** Each of the three API route files defined its own `const ITUNES_BASE_URL = ...`.

**Change:** Added `ITUNES_BASE_URL` to `lib/itunes/constants.ts`. All route files (`search/route.ts`, `rss/route.ts`, `lookup/route.ts`) now import from there.

---

## ❌ Not Addressed (intentionally skipped)

### Debounce in SearchBar

**Comment:** Add debounce to the search input.

**Decision:** Skipped per explicit team decision — the current submit-on-Enter UX is intentional. The search only fires when the user presses Enter or clicks the Search button, so debouncing the input value is not needed.
