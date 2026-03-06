# Code Review Learnings

What we learned about how maintainers want code structured in this project, based on PR review comments from **Anurag-Wednesday**.

---

## 1. SVGs belong in a shared icons file, not inline

- Never put `<svg>` directly in component JSX
- All icons go in `components/icons/index.tsx` as named React components
- Use `currentColor` for fill/stroke so Tailwind `text-*` classes control color
- Accept `className`, `width`, `height` props

## 2. Utility functions belong in utils files

- Any reusable logic (even simple one-liners) should be extracted to a util
- **iTunes/data utils** → `lib/itunes/utils.ts` (`formatDuration`, `extractReleaseYear`, `parseRssEntryToAlbum`)
- **App-level utils** → `lib/utils.ts` (`isHomeView`, `isVisibleInView`, `ternary`)
- Even inline booleans like `const isHomeView = activeView !== "search"` should be named util functions

## 3. Constants and types belong in dedicated files

- Don't define types inline in page files
- Use `as const` arrays + `typeof` derivation for string union types (single source of truth)
- Constants file: `lib/constants.ts`
- iTunes-specific constants: `lib/itunes/constants.ts`

## 4. Text/labels belong in translations

- Hardcoded UI strings (section titles, labels) go in `lib/translations.ts`
- Even if not doing full i18n, centralizing text makes it easy to change later

## 5. No hardcoded URLs

- API base URLs use constants with env var fallbacks: `process.env.ITUNES_BASE_URL ?? "https://itunes.apple.com"`
- Shared across route files via a single export

## 6. Import order matters

```
1. react              (core library)
2. next/*             (framework)
3. external packages  (npm — zustand, etc.)
── blank line ──
4. components/*       (internal UI)
5. lib/*              (internal utilities — alphabetical: lib/cn < lib/constants < lib/itunes < lib/translations < lib/utils)
6. store/*            (internal state)
```

## 7. Conditional rendering should use util functions

- Don't use raw ternaries in JSX for view switching
- Extract to named functions: either a `ternary()` util or a local `renderContent()` helper
- Boolean conditions like `activeView === "home" || activeView === sectionView` → named util `isVisibleInView()`

## 8. Keep files focused by domain

- `lib/itunes/` — iTunes API types, fetchers, data parsing
- `lib/` — app-level constants, utils, translations
- `components/icons/` — SVG icon components
- `store/` — Zustand stores
- Don't mix app-level navigation logic into iTunes-specific utils

## TL;DR

> Extract everything. Inline nothing. Group by domain. Name every condition.
