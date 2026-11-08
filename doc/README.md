# cv

A package for curricula vitae kept as data. Personal information lives in one frontend object, and CVs in another; a CV is drawn by reading the information through **query paths**, so one fact is written once and shown in every CV. The first form is the Japanese-style CV (cv-jp).

```text
frontend object: a profile (type cv.profile)        frontend object: CVs (type cv.jp)
  data items, kind info                               data items, kind template    the form: sections, what each cell says
    /example/info/name    { "{jp/first/}": { kanji: 太郎 } }  data items, kind instance    a template, a profile, what differs
    /example/info/birth   { year: 2000, month: 1, day: 1 }       │
    /example/info/edu/... dated entries                          ▼
         ▲                                            a cell's text: words, or queries in {{ }}
         └───────────── name/first/jp/kanji ───────── {{name/jp/first/kanji}}
```

- [Query paths](cv-query.md): how information is stored and read, and where segments may come in any order. **Read this first.**
- [Japanese-style CV](cv-jp.md): templates, instances, the sheet and editing it in place.

Two objects on purpose: the same person can have many CVs, in other forms later (an English CV is another type reading the same profile), and a profile can be copied without any CV. Each is a self-contained folder (react-doc: `main/doc_page_impl_obj_frontend.md#the-folder-of-an-object`).

## Using it in a doc page

1. Name the package in the entry of the doc page by its folder, relative to the entry: `packageList: [{ dir: ../../cv }]`. By name, `{ name: cv }`, it is found when its parent folder is searched (`react-doc dev --package-dir`).
2. Make the two objects: copy the two folders `.doc-page/object-frontend/*--Profile sample` and `*--CV sample` of this package as a start (new ids are not needed in another workspace), or create them in the Frontend objects tab. Their types, `cv.profile` and `cv.jp`, come with the package (`type.yaml`), each saying which kinds of assets it holds (`info`; `template`, `instance`).
3. Place them in a document:

````md
<!--renderComp=ObjectFrontend-->
```yaml
object: frontend:{id of the CV object}
mode: sheet
param:
  instance: /example/instance/sample
```
````

The package is also a doc page ([Demonstration](cv-demo.md)). Served alone, `react-doc dev <this folder>`, it is edited in place once the page is in edit mode, its sample objects included (in reading mode its modes only read); listed in a workspace or mounted, it is read-only.

## Partitions

The data of both objects is split into **partitions** (react-doc: `main/doc_page_impl_obj_frontend.md#partitions`), each a folder of the object's item folder with its own item list, declared by the types of the package (`partitionList` in `type.yaml`), and the first folder of every path:

```text
item/                         the item folder of the profile (the same in the CV object)
├── {entry}/                  the entry: name, type, metadata
├── example/                  the made-up person of the demonstration        tracked by git
│   ├── item-list.yaml          /example/info/name, /example/info/edu/bachelor, ...
│   └── history/edu/...
├── real/                     your own data                                   kept out of git
│   └── item-list.yaml          /real/info/name, ...
└── playground/               anything tried out                              kept out of git
    └── item-list.yaml
```

- **A CV reads the profile of its own partition**: `/real/instance/2026` reads `/real/info/...`, never the example. A CV names its template by its whole path, so a CV of `real` may use the template of `example`.
- **What is new goes into a partition, and the form says which**: the mode CVs makes a CV in the partition chosen beside its name, the mode Information shows and adds values in the partition chosen at its top (`param: { partition: real }` chooses one for a block), each with a line saying the folder and whether git keeps it; a value added from a cell of a CV goes into the CV's partition, which the editor names.
- **`real/` and `playground/` are ignored by git** (`.gitignore` of this repository; the types say so with `isGitIgnored`, and the page refuses to write there while git does not ignore them). Each holds its items and the item list naming them, so a clone has the example only, and nothing of your data is left in a list git keeps. In a fresh clone the two folders do not exist; the first value written into one makes it, with its list.

## Folder

```text
cv/
├── doc-package.yaml, package.json
├── type.yaml           the types cv.profile and cv.jp, with their modes and kinds of assets
├── doc/                README.md, cv-demo.md, cv-query.md, cv-jp.md
├── .doc-page/          makes the package a doc page; object-frontend/ holds its objects, their partitions inside
├── vue-legacy/         the former Vue project of this repository, kept for reference; not part of the package
└── comp-mdx/
    ├── comp.yaml, cv-comp.js   the components: modes of frontend objects
    ├── query/          CvQuery.js (the leaves, resolving, entries, writing), CvText.js (kana, romaji, era, age),
    │                   CvProfile.js (a profile read through its object's api). Knows no form of CV
    ├── profile/        CvProfileInfo: the mode "information" of a profile
    └── jp/             CvJpData.js (templates, instances, the sheet as data), CvJpStore.js (its state and writes),
                        CvJpSheet.jsx, CvJpList.jsx, CvJp.css
```

## Not here yet

Pagination is left out on purpose: a sheet is one long A4-wide page. It is planned as a capability of MDX components in general, not of this package. Printing to a PDF therefore has no page breaks of its own.
