# cv

A package for curricula vitae kept as data. Personal information lives in one frontend object, the **profile**, and the **papers** drawn from it in another; a paper is drawn by reading the information through **query paths**, so one fact is written once and shown in every paper. A paper has one of two **forms**: the Japanese-style CV (cv-jp), and the Japanese-style work experience (we-jp).

```text
frontend object: a profile (type cv.profile)        frontend object: the papers (type cv.jp)
  data items, kind info, kind badge                   data items, kind template   a form: its sections, what each cell says
    /example/info/name    { "{jp/first/}": { kanji: 太郎 } }  data items, kind cv         a CV (cv-jp)
    /example/info/birth   { year: 2000, month: 1, day: 1 }    data items, kind we         a work experience (we-jp)
    /example/info/edu/... dated entries                         each: a template, a profile, what differs
    /example/info/work/.. employers, their projects              │
         ▲                                                       ▼
         │                                            a cell's text: words, with tokens: queries in {{ }},
         └───────────── name/first/jp/kanji ───────── {{name/jp/first/kanji}}     links, views of objects
```

- [Query paths](cv-query.md): how information is stored and read, and where segments may come in any order. **Read this first.**
- [The sheet](cv-sheet.md): what both forms share: templates, papers, sections, blocks (a title line and a free area, made freely), cells, editing in place, pages.
- [Japanese-style CV](cv-jp.md) and [Japanese-style work experience](we-jp.md): what is each form's own. The work experience draws a career read off the folders of the profile.
- [Badges](cv-badge.md): a certification badge of the profile shown in a line of a paper, at any size, alone or as a grid with text under each, and changed where it stands.
- [The portals](cv-portal.md): the papers as an app of their own in the whole window, in two looks over one state: a desk in Material UI, and an archive room in 3D.

Two objects on purpose: the same person has many papers, of several forms, and a profile can be copied without any of them. Each is a self-contained folder (react-doc: `main/doc_page_impl_obj_frontend.md#the-folder-of-an-object`). The papers of both forms are in **one** object: they read one profile, share their templates' sections, and are listed and drawn by the same two modes.

## Using it in a doc page

1. Name the package in the entry of the doc page by its folder, relative to the entry: `packageList: [{ dir: ../../cv }]`. By name, `{ name: cv }`, it is found when its parent folder is searched (`react-doc dev --package-dir`).
2. Make the two objects: copy the two folders `.doc-page/object-frontend/*--Profile` and `*--Papers` of this package as a start (new ids are not needed in another workspace), or create them in the Frontend objects tab. Their types, `cv.profile` and `cv.jp`, come with the package (`type.yaml`), each declaring the kinds of data items it holds, with the shape of their data: `cv.profile.info`, `cv.profile.badge`; `cv.jp.template`, `cv.jp.cv`, `cv.jp.we`, `cv.jp.view` ([Kinds](#kinds)).
3. Place them in a document:

````md
<!--renderComp=ObjectFrontend-->
```yaml
object: frontend:{id of the papers object}
mode: sheet
param:
  instance: /example/cv/general       # a CV; /example/we/general: a work experience
```
````

The package is also a doc page ([Demonstration](cv-demo.md)). Served alone, `react-doc dev <this folder>`, it is edited in place once the page is in edit mode, its sample objects included (in reading mode its modes only read); listed in a workspace or mounted, it is read-only.

**To try things without touching the example**, open **Playground** in the side panel: a document git ignores (`doc/cv.playground.md`, made from `.doc-page/playground/cv.md`; react-doc: `main/doc_page_impl_test.md`), showing the profile, a CV and a work experience of the partition `playground`, which git ignores too. After a clone both are empty: the page offers to create the document, its first block to fill the partition with a copy of the example, and its second to make the two papers.

**Your own papers** are in the partition `real`, shown by **My papers** in the side panel (`doc/cv-real.playground.md`, made from `.doc-page/playground/cv-real.md`): your profile, the list of your papers, your CV and your work experience. Both the partition and the document are kept out of git.

## Partitions

The data of both objects is split into **partitions** (react-doc: `main/doc_page_impl_obj_frontend.md#partitions`), each a folder of the object's item folder with its own item list, declared by the types of the package (`partitionList` in `type.yaml`), and the first folder of every path:

```text
item/                         the item folder of the profile (the same in the papers object)
├── {entry}/                  the entry: name, type, metadata
├── example/                  the made-up person of the demonstration        tracked by git
│   ├── item-list.yaml          /example/info/name, /example/info/edu/bachelor, ...
│   └── history/edu/...
├── real/                     your own data                                   kept out of git
│   └── item-list.yaml          /real/info/name, ...
└── playground/               anything tried out                              kept out of git
    └── item-list.yaml
```

- **A paper reads the profile of its own partition**: `/real/cv/2026` and `/real/we/2026` read `/real/info/...`, never the example. A paper names its template by its whole path, so a paper of `real` may use a template of `example`.
- **What is new goes into a partition, and the page says which**: the mode Papers makes a paper in the partition chosen beside its name, the mode Information shows and adds values in the partition chosen at its top (`param: { partition: real }` chooses one for a block), each with a line saying the folder and whether git keeps it; a value added from a cell of a paper (a new project of a career too) goes into the paper's partition, which the editor names.
- **`real/` and `playground/` are ignored by git** (`.gitignore` of this repository; the types say so with `isGitIgnored`, and the page refuses to write there while git does not ignore them). Each holds its items and the item list naming them, so a clone has the example only, and nothing of your data is left in a list git keeps. In a fresh clone the two folders do not exist; the first value written into one makes it, with its list.

## Kinds

What a data item of the package is, is declared in `type.yaml` as a **kind**, a type of react-doc's registry (react-doc: `main/doc_page_impl_type.md#kinds-of-data-items`), not left to the code that reads it:

| kind | held as | what an item is |
| --- | --- | --- |
| `cv.profile.info` | `info` in a profile | the values of one subject: a tree of mappings, lists and plain values, a mapping with a `year` a dated entry ([Query paths](cv-query.md#how-the-information-is-stored)), a mapping holding `$version` one value kept with its versions ([Versions of a value](cv-query.md#versions-of-a-value)) |
| `cv.profile.badge` | `badge` in a profile | `{ name, caption?, issuer?, url?, image }` ([Badges](cv-badge.md)) |
| `cv.jp.template` | `template` in a papers object | `{ name, form, isEra?, sectionList, cellById }`, a section of the type basic, head, history, career, text or closing ([The sheet](cv-sheet.md#the-data)) |
| `cv.jp.cv` | `cv` in a papers object | a CV: `{ name, template, profile, asOf, isEra?, valueByCell, rowExtraByGroup, rowHiddenByGroup, rowOrderByGroup, sectionExtraList, sectionHiddenList, sectionOrderList }` |
| `cv.jp.we` | `we` in a papers object | a work experience: the same shape |
| `cv.jp.view` | `view` in a papers object | how the table of the mode Papers is shown: one line a row or wrapped, its columns in order with their widths and whether hidden ([The table of papers](cv-sheet.md#the-table-of-papers)) |

- **A write that does not fit is refused**, a mode's and an agent's alike, with where it does not fit; a file changed by hand is read as it is, and what does not fit is said where it is drawn.
- **A paper reads a profile by its kind.** A paper reads the items of the kind `cv.profile.info` (and `cv.profile.badge`) of the object it names, under whatever name that object's type holds the kind: a `cv.profile`, or a type of another package holding the kind, are read alike. An object holding no such item is said, not read as an empty profile.
- **The kind of a paper is its form.** `cv` and `we` hold one shape; the kind says which form draws the paper, and a path says it too (`/real/cv/…`, `/real/we/…`). A template is of one form (`form`), and a paper naming a template of the other form is told so and drawn in its own.
- The code reading the items (`query/CvProfile.js`, `query/CvQuery.js`) is shared by the profile's own mode and the sheet, so the two read one shape; the kind is that shape written down, for everyone else and for the checks.

## Folder

```text
cv/
├── doc-package.yaml, package.json   package.json: what the portals are drawn with (npm install)
├── type.yaml           the types cv.profile and cv.jp, with their modes and the kinds of their data items (schemas)
├── doc/                README.md, cv-demo.md, cv-query.md, cv-sheet.md, cv-jp.md, we-jp.md, cv-badge.md;
│                       cv.playground.md (ignored by git)
├── .doc-page/          makes the package a doc page; object-frontend/ holds its objects, their partitions inside;
│                       playground.yaml and playground/: the playground document and the document of your
│                       own papers (My papers), with their templates
├── vue-legacy/         the former Vue project of this repository, kept for reference; not part of the package
└── comp-mdx/
    ├── comp.yaml, cv-comp.js   the components: modes of frontend objects
    ├── query/          CvQuery.js (the leaves, resolving, entries, writing), CvText.js (kana, romaji, era, age),
    │                   CvProfile.js (a profile read through its object's api, and from outside: its inner paths),
    │                   CvBadge.js (the badges of a profile), CvInfoExplore.js and CvInfoTree.js (the values walked
    │                   as an explorer walks folders, and as a tree). Knows no form of CV
    ├── profile/        CvProfileInfo.jsx: the mode "information" of a profile, a panel of limited height; its two
    │                   views of the values (CvProfileExplore.jsx, CvProfileTree.jsx, their rows CvProfileRow.jsx),
    │                   its badges (CvProfileBadgeList.jsx), CvProfileStore.js, CvProfile.css
    ├── portal/         the portals of a papers object (cv-portal.md): archive/ (the state both draw), desk/
    │                   (Material UI), room/ (three.js)
    └── jp/             the Japanese-style forms. CvJp*: the sheet both forms share, and the top of the CV;
                        WeJp*: what is the work experience's own (cv-sheet.md#files).
                        CvJpData.js (templates, papers, forms, the sheet as data), WeJpData.js (the career),
                        CvJpStore.js (its state and writes), CvJpSection.jsx and WeJpSection.jsx (the sections
                        drawn: cells, rows, lines, tables), CvJpSheet.jsx (the sheet edited in place, its cards,
                        its pages), CvJpPagination.jsx (a paper on pages), cv-query-cell.js (the query as a
                        token of a cell: written, drawn, typed with {{ or /query), cv-badge-cell.jsx (the badge
                        as a token: drawn, typed with /badge, its card), cv-era-cell.jsx (a year with its era
                        above it: drawn, typed with /era), cv-period-cell.jsx (a period, its start over a
                        vertical line over its end: drawn, typed with /period), CvJpImagePick.jsx (an image chosen or pasted),
                        CvJpList.jsx, CvJp.css, WeJp.css
```

## Not here yet

Forms in other languages (an English CV) are further kinds of paper reading the same profile; none is written yet. A row of a history, a project of a career or a paragraph of a block taller than a page is not cut. The employers and projects of a career come in order of time only: a paper leaves some out, it does not reorder them.
