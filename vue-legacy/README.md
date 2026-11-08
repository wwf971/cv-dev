# vue-legacy

The former Vue 3 project of this repository (Dec 2025 to Jan 2026), which drew a Japanese-style CV and printed it to a PDF. It is deprecated and kept for reference only. The package at the root of this repository replaces it ([../README.md](../README.md)).

## What it did

- **The Japanese-style CV** (`src/content/CvJp/`): the title, basic information, education and work history, motivation and projects, as Vue components with a shared stylesheet (`styles-shared.css`). The package's sheet borrows its look from these.
- **Remote data** (`src/remote/`): a cell could hold `{{remote:path}}` or `{{mongo:db/coll/docId/field}}`, which was replaced by a value fetched from a server (`remoteDataFetcher.js`). The server address and token are in `src/config.js`; `src/config.0.js` is a local, untracked copy.
- **Pagination** (`src/pagination/`, `src/panels/`): measured each piece and split text, lists, tables and images across A4 pages, with test panels for each case and a print preview (`PrintWrapper.vue`).
- **Printing to a single html** (`script/convert-to-single-html-iffe.js`, `pnpm run build:single-html`): one html file that opens from disk. Puppeteer then turned it into a PDF, using the scripts in `2025/cv-dev/pdf-script/` outside this repository.

## State

It no longer starts as is: it imports `@wwf971/vue-comp-misc` from the local pnpm workspace (`setup.sh`), which no longer resolves. The scripts are in `package.json`: `dev`, `build`, `build:single-html`.
