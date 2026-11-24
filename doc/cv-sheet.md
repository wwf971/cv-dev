---
title: The sheet
description: What the Japanese-style CV and work experience share: templates, papers, sections, blocks, cells, editing in place, pages
---

# The sheet

A **paper** is one document drawn from a profile: a Japanese-style CV (cv-jp), or a Japanese-style work experience (we-jp). The two are **forms** of one thing, drawn by one **sheet**, so whatever one of them can do, the other can too. This document says what they share; what is a form's own is in [Japanese-style CV](cv-jp.md) and [Japanese-style work experience](we-jp.md).

<!--renderComp=DiagramText-->
```text
the profile (type cv.profile)          the papers object (type cv.jp)
┌──────────────────────────┐           ┌─────────────────────────────────────┐
│ info   name, birth, work │   query   │ template   the sections of a form   │
│ badge  aws/saa, …        │ ◄ paths ─ │ paper      a template, a profile,   │
└──────────────────────────┘           │            and what differs         │
 {{name/jp/last/kanji}}                │   kind cv  a CV                     │
                                       │   kind we  a work experience        │
                                       └──────────────────┬──────────────────┘
                                                          ▼
                        the sheet    its sections in order, every text a cell,
                                     edited in place, laid out on A4 pages
```

- A **template** says what a form looks like: its **sections**, in order, and what each cell says.
- A **paper** names a template and a profile, and holds only **what differs**: a cell saying something else, a row of its own, a section left out, a block of its own.
- A **form** is the kind of a paper (`cv`, `we`). It decides the template drawn when the paper names none, and how the paper is set.
- A **cell** is one text of the sheet: words, with tokens in them ([The cells](#the-cells)). Every text of every section is one, so everything is typed the same way.

## The data

The shapes below are declared in `type.yaml` as the kinds `cv.jp.template`, `cv.jp.cv` and `cv.jp.we` ([Kinds](README.md#kinds)): a write that does not fit is refused, and every key may be left out, read as the form's default. The two kinds of paper hold one shape.

```yaml
# a template: data item of kind template, /example/template/cv-jp-standard
name: 履歴書
form: cv                                       # the form it is a template of: cv (the default), we
isEra: true                                    # the era above the years the form draws; absent: the form's way
sectionList:                                   # its sections (#sections)
  - { id: basic, type: basic }
  - id: history
    type: history
    title: 学 歴・職 歴
    groupList:
      - { id: edu, title: 学 歴, list: edu/jp }
      - { id: work, title: 職 歴, list: work/jp, isNote: true }
  - { id: motivation, type: text, title: 志 望 の 動 機, text: '{{motivation/jp}}', heightMin: 120, isIndent: true }
cellById: {}                                   # optional: other texts of cells
```

```yaml
# a paper: data item of kind cv or we, /example/cv/general, /example/we/general
name: 履歴書（汎用）
template: /example/template/cv-jp-standard   # its whole path: a template of any partition
profile: frontend:w5p4...                      # absent: metadata.profile of the object
asOf: 2026-11-08                               # the date on the form and of the age; absent: today
isEra: false                                   # the era above the years, for this paper; absent: its template's way
valueByCell:                                   # what differs from the template: words, or other queries
  name-last: '{{name/jp/last/romaji/uppercase-all}}'
  motivation: この履歴書のためだけの文章
alignByCell: { email: left }                   # how the text of a cell stands in its box (#the-alignment-of-a-cell)
rowExtraByGroup:                               # rows only this paper has, each with an id of its own
  work: [{ id: rmh3k2a7, year: 2024, month: 4, text: 副業, note: 個人 }]
rowHiddenByGroup:                              # what of the profile this paper leaves out
  edu: ['edu-1:start']                         #   of a history: entries; of a career: employers, projects
rowOrderByGroup:                               # the order of the rows, when not the order of time (dragged)
  work: ['extra:work:rmh3k2a7', 'info-9:', 'info-10:']
sectionExtraList: [{ id: mi5u0c4x7k, type: text }]   # parts only this paper has, each a whole section (#parts)
sectionHiddenList: [motivation]                # parts of its template this paper leaves out
sectionOrderList: [basic, mi5u0c4x7k, history] # the order of the parts, when not the template's
```

**What a cell says** is the first of: the paper's `valueByCell`, the template's `cellById`, what its section says of it (the `text` of a block, the query of a value of a career), the default of the form. A cell of a section is named by the section: `motivation` is the text of that block, `motivation:title` its title.

**The sections of a paper** are those of its template, then its own blocks, in the template's order or in the order the paper gives; a section the order does not name (added to the template since) follows at the end.

## Sections

| type | draws | cut on pages | of |
| --- | --- | --- | --- |
| `basic` | the top of a CV: name, birth, address, contacts, photo (`isPhoto: false`: without it, the form the whole width) | never | [cv-jp](cv-jp.md#the-top) |
| `head` | the top of a work experience: its title, the date, the name | never | [we-jp](we-jp.md#the-head) |
| `history` | a table of dated entries of the profile: 年, 月, the text, sometimes 備考 | between rows | both ([below](#a-history)) |
| `career` | the employers of the profile, each with its projects | between projects | [we-jp](we-jp.md#the-career) |
| `text` | a **block**: a title line, and a free area below it | between its lines | both ([Blocks](#blocks)) |
| `closing` | one line at the right under everything: 以上 | never | both |
| `education` | 最終学歴: the latest education of the profile in one row, 年月, the school, its status, the degree | never | [we-jp](we-jp.md#最終学歴) |

A template may hold any of them in any order, whatever its form: a CV with a block for 自己PR, a work experience with a second history. The form only decides the default. A paper changes its own: [Parts](#parts).

### A history

`groupList` names its groups, each the dated entries a query lists (`list: edu/jp`, [Dated entries](cv-query.md#dated-entries)), with a heading of its own when it has a `title`, and a column 備考 with `isNote`. The rows of a group are those entries and the paper's own rows, in order of time; `rowOrderByGroup` gives them another order, by their ids, and a row it does not name (added since) follows in order of time. A row of the paper keeps its `id`, so that its place survives a row before it being removed.

## Blocks

A **block** is the general-purpose section: a title line, and a free area whose text is typed freely. 志望の動機 of a CV is one; 職務要約, 活かせる経験・知識・技術 and 自己PR of a work experience are three more; and a paper adds as many of its own as it wants, anywhere (語学, 得意な分野, 本人希望記入欄).

```yaml
- { id: skill, type: text, title: 活かせる経験・知識・技術, text: '{{skill/jp}}' }   # in a template
```

- **Its text is a cell**, so it is words, a query of the profile, or both. A fact every paper should say is kept in the profile and read (`{{skill/jp}}`); words only this paper says are typed in place.
- **A block without a title has no title line.**
- `heightMin` is the least height of its free area in px (the box of a paper form, 120 for 志望の動機); without it the area is as tall as its text. `isIndent` starts every paragraph with an indent.

**How a line starts says what it is.** The text stays one plain string, written as such a text is written by hand, and each line is drawn by its start:

```text
written                                     drawn
■ 得意な分野  【業務内容】  ＜強み＞          a small heading (the mark alone on its line)
・要件を画面仕様にまとめた                   an item of a list: its next lines go on under its text,
- item   (1) item   1. item   ① item         not under its mark
【言語】Java／Python                         a label, then what it says. labels one under another
[GitHub] https://github.com/example           stand in a column as wide as the widest: a table
                                              without rules; ［GitHub］…, the brackets of full
                                              width, says the same
(an empty line)                             a gap between paragraphs
anything else                               a paragraph
```

So a list of skills needs no table and no section type of its own: it is a block whose lines start with labels.

```text
【言語】Java（3年）／TypeScript（2年）        言語            Java（3年）／TypeScript（2年）
【フレームワーク】Spring Boot／React     ->   フレームワーク  Spring Boot／React
【工程】要件定義／設計／実装                  工程            要件定義／設計／実装
```

Every line is drawn with its tokens, on the sheet and on its pages: a badge in a line is the image, a link a link.

**A block of the paper's own** is a record of `sectionExtraList` (its id, made by the page), and its title and its text are cells of the paper like any other (`{id}:title`, `{id}`). It is one of the [parts](#parts) a paper adds.

## Parts

**A paper is its parts stacked from top to bottom**: the top with the name, a history, a block, the closing line, each a section. Its template gives the parts it starts with; the paper then moves any of them anywhere (the top too: nothing keeps a part first), deletes any of them, and adds new ones, each made of **a part template**. A CV without a photo is one whose top is deleted and replaced by the top without a photo.

```text
a right click on a part, or ⋯ in its right margin,        Move up, Move down, Add a part above ▸, Add a part below ▸,
while the sheet is edited                                   Options… (The options of a part), Delete {part}
+ in the right margin of a part                             add a part under it: the menu of part templates
a paper with no part                                        Add a part
```

**A part template** is one of:

| | where it comes from | of a CV | of a work experience |
| --- | --- | --- | --- |
| of the form | `partList` of the form (`CV_JP_PART_LIST`, `WE_JP_PART_LIST`) | 基本情報（写真あり）, 基本情報（写真なし）, 学歴・職歴, 免許・資格, 志望の動機, 自己PR, a block, 以上 | the head, 職務要約, 職務経歴, 活かせる経験・知識・技術, 資格, 最終学歴, 自己PR, a block, 以上 |
| of the object | a data item of the kind `part`, `/{partition}/part/{name}`: `{ name, form, section }` | those whose `form` is `cv` (the default) | those whose `form` is `we` |

```yaml
# /example/part/wish: a part template of the object
name: 本人希望記入欄
form: cv
section: { type: text, title: 本人希望記入欄, text: 貴社の規定に従います。, heightMin: 80 }
```

- **A part added is the paper's own**: a copy of the template's section with an id of its own, kept whole in `sectionExtraList` (its type and everything its type reads: a title, the groups of a history, `isPhoto`), and placed in `sectionOrderList`. Changing the part template later changes no paper made with it.
- **Its cells are the paper's.** A block's title and text are cells of its id (`{id}:title`, `{id}`); the cells of a top (the name, the address) are the paper's, whichever top draws them, so a top replaced by another keeps what was typed; the groups of a history keep their ids, so its rows of the paper and the rows it hides go on.
- **Deleting a part**: one of the paper's own is deleted with what it says; one of its template is left out (`sectionHiddenList`), the template keeping it, and **More fields** draws it again. Both are steps of the history (Ctrl/⌘ + Z).
- **Nothing is fixed**: two tops, a closing line in the middle, 自己PR before the top. The form draws what the paper says, in its order.

### The options of a part

A part of some types lets a paper change what it draws: **Options…** in its menu opens **the card of its options** beside the part, at the right of the paper when the window has room for it, else at its left, so the paper stays in sight. It is the edit card of the card-diagram framework (cloud-dev-vis `DiagramEditCard`, given a card of its own), the options drawn by the page's PropEditor under the headings of their groups: a check box, a few choices side by side, a number. A change is written at once and drawn on the sheet, for this paper only, and is a step of the history (Ctrl/⌘ + Z). Escape, its close button or a click elsewhere than the card and the part closes it.

| part | option | values |
| --- | --- | --- |
| the top (`basic`) | 写真欄 `isPhoto` | Off, On (default): without it the form takes the whole width |
| | 在留資格 `rowVisa` | If filled (default), Always, Never: a row of `{{visa/jp}}` and `{{visa/expiry/jp}}` |
| | 国籍 `rowNationality` | the same: a row of `{{nationality/jp}}` |
| | リンク `rowLink` | the same: a row of `{{github}}`, `{{homepage}}` under the top |
| | 見出し `widthKey`, 右の欄 `widthEnd` | the width in px of a column of headings (115) and of the column at the right: 電話番号, 在留期限, the gender (118). The e-mail address and 在留資格 take the rest |
| a block (`text`) | 段落の字下げ `isIndent`, 最小の高さ `heightMin` | Off, On; a number of px (0: as tall as its text) |
| a career (`career`) | 新しい順 `isNewestFirst` | Off (default), On |
| 最終学歴 (`education`) | 学位 `isDegree` | Off, On (default): the column of the degree |

- **If filled** draws a row when one of its cells says something (the profile holds a status of residence), **Always** draws it empty too (a place to write by hand, or to type a value of the paper's own), **Never** leaves it out whatever the profile holds. A row not drawn because it says nothing is offered in **More fields**; one set to Never is not.
- **Where a value comes from**: the paper's (`optionBySection: { {partId}: { rowVisa: always } }`), else the part's (its section in the template, or the part as it was added: `rowVisa: always` on the section), else the default. The paper keeps only what differs from the part, so choosing what the part says takes the paper's away, and **As the part says** in the card takes every one away. The card marks an option the paper sets itself with `*`.
- **Which options a type has** is `CV_JP_PART_OPTION_LIST_BY_TYPE` (`jp/CvJpData.js`): `{ key, label, description, group, kind: boolean | choice | number, choiceList, min, max, default }`, the key being the key of the section its type reads, so a new option is a line there and what the part draws reading it; `group` is the heading it stands under in the card (`CV_JP_PART_OPTION_GROUP_LABEL`).

## The modes

| mode | component | |
| --- | --- | --- |
| `sheet` | `CvJpSheet` | one paper; `param.instance` names it (a path, a key). Without it, the first paper of `param.kind` (`cv`, `we`) in `param.partition`. It is the mode showing one thing of the object (`pathParam: instance` in `type.yaml`), so a reference to a paper from elsewhere, `frontend:{id}#/example/we/general`, is drawn by it |
| `list` | `CvJpList` | **Papers**: the papers and templates walked by their paths ([below](#the-papers)) |

```yaml
# in a document: one paper, by its path
object: frontend:{id of the papers object}
mode: sheet
param:
  instance: /example/we/general
```

### The papers

The mode **Papers** is a path bar over a panel of one height (`param.height`, 640 px). The bar is the path-based view of the switch layer of react-doc's package `cloud-dev-vis` (react-doc: `package/cloud-dev-vis/doc/card-diagram-flexible-switch.md#a-path-based-view-anywhere`), so it walks as a block of scenes does: **back** and **forward** over the places visited, **up** one level, a click on a segment to go there, the chevron before a segment listing what lies beside it, the last one what lies below. The top has no name of its own and is a house (its title: every paper and template).

```text
[← → ↑]  ⌂ › Example › CVs › 履歴書（汎用） ›                            tracked by git
[⌕ Find by name    ] [Wrap|One line] [▥ Columns 5/7]          (View not kept · Keep · ↺)
┌─────────────────────────────────────────────────────────────────────────────┐
│ a folder: one table of what lies under it; a paper: its sheet               │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Place | Path | Shows |
| --- | --- | --- |
| the top | `/` | every paper and template of the object, each partition's |
| a partition | `/example` | those of the partition; the bar says whether git keeps it |
| a folder | `/example/cv`, `/example/we`, `/example/template` | the papers of a form, or the templates |
| a paper | `/example/cv/general` | its sheet, as the mode `sheet` draws it; its bar (Pages…, Edit) stays at the top while the paper scrolls |
| the parts | `/example/part` | the gallery of the parts a paper may be made of ([The gallery of parts](#the-gallery-of-parts)) |
| a part | `/example/part/cv-jp:basic-no-photo`, `/example/part/wish` | the part at the top of a page |

The places are the object's own asset paths, so a path seen in the bar is the path a block names (`CvJpPaperTree.js`). A template is listed where it lies, never opened alone. The panel keeps its height wherever it is, and each place keeps how far it was scrolled, so back arrives where the reader was. While what it shows is taller than the panel, the wheel stays in it at both ends: the page moves only when nothing in the panel can scroll.

### The gallery of parts

**Parts** (a place of every partition, `/{partition}/part`, and a button in the tools of the table) shows the parts a paper may be made of ([Parts](#parts)) as a gallery: a tile for each, the part itself drawn small from the profile of the partition, grouped by where it comes from (the parts of a CV, of a work experience: their form's `partList`; the part templates of the partition: items of the kind `part` lying there). A click on a tile opens the part, a place of its own (`/{partition}/part/{form}:{id}` for a part of a form, the item's path for a part template), drawn at the top of an A4 page as a paper starting with it draws it, read from the profile as of today (`jp/CvJpPartGallery.jsx`). A part is only shown there; it is added to a paper from the paper (+ beside a part, or a right click on it).

### The table of papers

A folder shows what lies under it in **one table**, the list of react-comp-misc (`FolderView`, drawn in the page's colors and type by `CvJp.css`): a heading row for each part (**CVs (2)**, **Work experiences (1)**, **Templates (2)**, a part holding nothing saying so), then its items, so a column stands at one place for all of them. Its head stays on top while the rows scroll inside the panel. A click on a paper's name opens it, as does a double-click on its row; the words of a row can be selected and copied. A right click on a paper or a template opens the menu of its row: **Open**, **Rename** ([Renaming a paper](#renaming-a-paper)), **Duplicate** ([Duplicating a paper](#duplicating-a-paper)).

| Column | Says |
| --- | --- |
| name | the paper's name, which opens it; a template's |
| path | its path in the object; it breaks before a `/`, never inside a segment |
| form | `cv-jp` or `we-jp` (hidden by default) |
| template | the template a paper names, or `(the form itself)` |
| profile | the profile a paper reads |
| as of | the date the paper is written at, with its zone, as every time the page shows (`2026-11-08 +09`); a paper naming none: the day it is opened, and `today` |
| partition | the partition it lies in (hidden by default) |

**Its tools** stand above it, always: **Find by name** keeps the items whose name holds every word typed (a part with no match leaves, the others say how many of how many match); **Wrap** or **One line**: a cell's text breaks into lines, or every row is one line and what does not fit is cut (its whole text in its tooltip); **Columns**: which are shown and in which order, each with its width, and **Default view**. A column is made wider by dragging the border at its right in the head, and moved by dragging its head.

**The view is a data item** of the object, of the kind `view` (`cv.jp.view`, `/example/view/papers`, `CvJpPaperTable.js`), so every block showing the papers shows them alike, and it travels with the object:

```yaml
name: the table of papers
lineMode: line                      # wrap (the default) | line
columnList:                         # in their order; a column it does not name is added as by default
  - { id: name, width: 170 }
  - { id: path, width: 200 }
  - { id: form, width: 72, isHidden: true }
```

A change is shown at once. While the document is edited it is kept a moment after the last change (a column dragged wider is one write); while the document is read it is held by the panel and said **not kept**, and **Keep** writes it once the document is edited, ↺ puts the kept view back ([Reading and editing](#editing-in-place)). A view that does not fit (an unknown column, a width under its column's least) is read as far as it fits and the rest said beside the tools. A block may name another item for its view, `param.view`.

**A new paper** is offered at the top of a folder while the document is edited: its form, its name, its partition, as far as the place does not say them already (in `/example/cv`, the name alone). The first paper of a form in a partition writes the standard template of that form there. The new paper opens in the panel, and back returns to where it was made.

```yaml
object: frontend:{id of the papers object}
mode: list
param:
  path: /example       # the place shown first (/ when absent)
  height: 640          # px, the panel under the bar
  view: /example/view/papers   # the item holding the view of the table (this one when absent)
```

## The cells

The cells of a sheet are cells of react-doc's **cell editing kit** (react-doc: `main/doc_page_impl_edit_cell.md`), which every component uses for the small texts typed in place, so a cell of a paper is typed like a cell of any other object and may hold the same things. Its text is words with **tokens**, each drawn by what it belongs to:

```text
{{name/jp/last/kanji}}                    a query of the profile the paper reads: the sheet's own token (cv-query-cell.js)
{{/badge/aws/saa}}                        a badge of the profile, drawn as its image: its second token (cv-badge.md)
{{era:2019/5}}  {{era:birth}}             a year with its Japanese era above it: its third (#a-year-with-its-era)
{{period:work/sample-systems}}            a period, its start over a vertical line over its end: its fourth (#a-period)
[the project](~docs:root/project.md)      a link to a document, resolved and followed as a link of a document
{{@frontend:w5p…#example/name/en/first}}  a view of an object of the page, or of something inside one
東京都千代田区                              words only this paper says
```

- **A brace token without a sigil is a query.** It is the sheet's own kind of token: written `{{path}}`, drawn as the value the query reads, typed with `/query` or by typing `{{`. One starting with `/badge/` is a [badge](cv-badge.md), one starting with `era:` a year with its era, one starting with `period:` a period. The other kinds are react-doc's, and a cell accepts them all. What follows a `|` in a token is how it is drawn in its place (the size of a badge), never part of what it names.
- **The plain text of a cell** (`cell.text`: every token as text, a link as its label, a badge as its name) is what is compared and what decides whether something optional is drawn; `missingList` names the queries nothing answers.
- **A value of any profile can be named from anywhere**, not only from a paper reading it: `frontend:{profile id}#example/name/jp/first` is a reference of the page's object registry, which a paragraph or a cell of another object writes with `/object`, walking Profile → the profile → its partition → the path. The profile answers that walk itself ([Query paths: from outside a CV](cv-query.md#from-outside-a-cv)).

## A year with its era

A Japanese form often writes a year with its era above it, `平成28` over `2016`. That is a **token**, not a place of a form, so it is drawn wherever a text is typed: a cell, a row, a line of a block.

```text
written                         drawn                 its plain text
{{era:2019/5}}                  令和元 over 2019      2019     a year written out; its month decides the era
{{era:2019}}                    平成31 over 2019      2019     (2019/4 is still 平成31)
{{era:birth}}                   平成12 over 2000      2000     a date of the profile: a mapping with a year
{{era:edu/bachelor/start}}年    平成28 over 2016, 年           what follows the year is the text's own
```

- **Typed with `/era`** (or `/nengo`), or by typing `{{era:`: a year of four digits typed is offered as itself; anything else lists the dates of the profile whose path holds what is typed, each with what it draws.
- **A date of the profile stays one query.** A cell holding `{{era:work/sample-systems/start}}` alone is, for everything but its drawing, the query of that year: its card shows the value in the profile and saves it there.
- **The years a form draws itself follow one switch.** The rows of a history and the periods of a career have their era above them or not: the way of the form (a CV does, a work experience does not), of its template (`isEra`), or of the paper, set from the sheet while it is edited (**Era above years**: Off, On). The periods of a career then ask their token for it (`{{period:…|era}}`); a row of a history, whose year is typed as a number, is drawn with the same look.

## A period

A period is a **token** too: its start, a short vertical line under it, and its end under that, so a range of time needs the width of one date only. The line says what 〜 says in a line of text; it is drawn, a thin straight rule like those of the form, not a 〜 turned upright, which reads as a scribble at this size. As plain text a period is still `start〜end`.

```text
written                                   drawn            its plain text
{{period:work/sample-systems}}            2022年 4月       2022年4月〜現在          a folder of the profile holding
                                              │                                      start and end; no end: 現在
                                             現在
{{period:edu/x/start~edu/x/end}}          2016年 4月       2016年4月〜2020年3月     two dates of the profile
{{period:2026/5~2026/10}}                     │                                      dates written out
{{period:2026/5~}}                        2026年10月                                 written out, going on
{{period:work/sample-systems|era}}        each year with its era above it
```

- **Typed with `/period`** (or `/range`), or by typing `{{period:`: a period typed (`2026/5~2026/10`) is offered as itself; anything else lists the folders of the profile holding a `start` whose path holds what is typed, each with what it reads. In a paper that writes its years with their era, the token is written with `|era`.
- **Its two dates are set in the same columns**, the year, 年, the month, 月, so the years stand one under the other and the months end at one edge, in one period and from one period to the next.
- **A period of the profile is changed from its card.** A cell holding one such token alone shows, in its card, the four numbers it reads (the year and the month of its start and of its end), each typed in place and saved to the profile for every paper; an end emptied is 現在 again. A folder holding no date at all draws nothing.
- The career of a work experience draws its periods with this token ([The career](we-jp.md#the-career)).

## Editing in place

**Edit** above the sheet (offered while the document is edited) turns the sheet editable. Every cell is then typed **in the cell itself**: a click makes it a surface (react-doc's `CellEdit`, the same surface as a paragraph of a document) showing its own text, words and tokens as written, while every other cell keeps showing what it reads. What the cell says is this paper's: Enter (or a click elsewhere) keeps it, Esc puts it back. **A token is one thing in that text** (react-doc: `main/doc_page_impl_edit_cell.md#a-token-marked-in-the-typed-text`): a click on its words marks it (a blue ground under them) and opens **its card** under it, the value it reads typed in place and kept in the profile; Backspace or Delete take the whole token out; a click on it again types its words as any text. A cell of one value opens with that value marked, so its card is one click away. A small bar floats above the right end of the open cell, in the look of the page's Save and Cancel: **Save** (Enter), **Cancel** (Esc), **Template** (back to the template, when this paper has its own text there), **Keep in profile…** (with words selected). Nothing of the sheet moves when a cell opens: the surface keeps the width the cell had, so a long text breaks into more lines (the only thing that makes a cell taller); a cell too narrow to read a query in (a name, a day, a year inside a line) keeps its box and its surface floats over it, growing to the right.

```text
a cell     the text in the cell                           Enter saves, Shift+Enter a new line (a block:
                                                          Enter a new line, Ctrl+Enter saves), Esc cancels,
                                                          a click elsewhere saves
           {{ in it, or /query (or /q)                    a value of the profile, chosen a segment at a time:
                                                          {{name/ lists jp/, en/, last/, first/ with how many
                                                          values each holds; a folder chosen goes on inside it,
                                                          a value (shown with what it reads) writes {{name/jp/last/kanji}}
           /badge in it                                   a badge of the profile, a folder at a time (cv-badge.md)
           /era in it                                     a year with its era above it: one typed, or a date of the profile
           /period in it                                  a period, its start over a vertical line over its end: one typed,
                                                          or a folder of the profile with a start
           /link in it                                    a link to a document of the workspace
           /object in it                                  a view of an object: a type, an object, what is inside it
           a click on a token                             marks it, its card under it; a second click types its
                                                          words; ← from after it, → from before it mark it as
                                                          well; marked, Backspace or Delete take it out whole
           the card of a query                            the value it reads, in the profile: typed in place,
                                                          kept there by Save (or Enter, or leaving it), for every
                                                          paper of the partition, put back by Cancel (or Esc); one
                                                          value of one line saved by Save or Enter closes the card
                                                          (a click on the token opens it again); a
                                                          value of several lines: Ctrl/⌘ + Enter; a value made of others (a
                                                          whole name, name/jp/kanji: its last and its first part)
                                                          each of them typed in place; nothing holding it: a place
                                                          to type one, added where its path names it. It is the
                                                          same card a token naming the value from any page has
                                                          ({{@frontend:{profile}#example/address/jp/postal}})
           the card of a period                           its dates in the profile, a number a field, with
                                                          Save and Cancel as the card of a query
           the bar above the cell                         ⟸ ≡ ⟹ its text left, centered or right (alignByCell,
                                                          The alignment of a cell); Save the text in this paper (Enter), Cancel (Esc),
                                                          Template: back to it, and with words selected, Keep in
                                                          profile…: type the path they are kept at
                                                          (address/jp/building), they are written there and
                                                          replaced in the cell by {{that path}}. only words: a
                                                          selection holding a token, in part or whole, is
                                                          refused; so is a path holding another value
a title    the title of a section                         a cell as any other: typed in place
a photo    a click on the photo box                       a card of its own: an image, so nothing is typed, and no
                                                          Slash switch. Choose a photo…, or paste an image (Ctrl/⌘ + V)
                                                          while the card is open: scaled down and kept as text in the
                                                          profile (photo), for every CV of the partition. the card
                                                          says whether git sees that partition; Remove the photo
a row      every field in place at once: 年 (the era above follows), 月, the text, 備考
                                                          Tab and Shift+Tab go through them, Enter saves, Shift+Enter
                                                          a new line. the text and 備考 are cells: {{, /badge, /link,
                                                          /object work in them
           the bar above the row                          where the row is kept (In the profile: what is typed
                                                          changes every paper reading it; Only this paper), then
                                                          Hide in this paper (a row of the profile: rowHiddenByGroup;
                                                          the profile keeps it, the other papers still show it,
                                                          More fields shows it here again) or Delete (a row only
                                                          this paper has: rowExtraByGroup), Order by time when the
                                                          list has an order of its own, Save (Enter), Cancel (Esc)
           the grip in the left margin                    drags the row to another place in its list: rowOrderByGroup
           + on a heading                                 a new row of this paper, typed in place at the end of the list
a badge    a click on it                                  selects it; its card stands to its right: its size here,
                                                          its name and image in the profile, taking it out. In a
                                                          cell being typed, the same card stands under the badge's
                                                          token, marked
the bar    Name [履歴書（汎用）]                          the name of the paper, typed in place (Renaming a paper)
           Era above years [Off | On]                     whether the years of the rows of a history and of the periods
                                                          of a career have their era above them, in this paper (isEra)
           ↶ ↷                                            undo and redo of what was changed here (Undo and redo)
a part     ⋯ in the right margin, or a right click on it  a place up, a place down (sectionOrderList; any part,
                                                          the top too); a part above or below it; deleting it
           + in the right margin                          a part under it, made of a part template (Parts)
More fields   what is not drawn now: the optional rows of a CV (their text is typed in a card under the list), and what was
              left out: rows, sections, employers and projects, each drawn again by a click. a block of the
              paper's own left out can also be deleted for good there, with what it says
```

The query is the sheet's own token kind (`jp/cv-query-cell.js`: how a query is written, drawn and typed; its items are `cvQuerySlashItemListGet` of `query/CvQuery.js`), handed to react-doc's cell editing kit with the cell (`useCell({ tokenList: [cvQueryToken, cvBadgeToken, cvEraToken, cvPeriodToken], context: { info, dateNow, profileAccess, … } })`; `profileAccess`, one object for the life of the sheet, is the profile the cards change); `/link` and `/object` are the kinds every cell of the page has. In a cell, `/` and `{{` work anywhere, also right after `}}` or a Japanese word, since the words of a cell are not set apart by spaces (react-doc: `main/doc_page_impl_edit_cell.md#drawing-and-typing`). The year and the month of a row are plain text.

**An empty cell** shows what it is for while the sheet is edited (会社名, タイトル), so that there is something to click; read, it is nothing. **More fields** closes on a click anywhere else.

### The alignment of a cell

A cell drawing its own text in a box of its own (a cell of a table: the e-mail address, the phone number, a title; a line such as the address) may have its text stand **left**, **centered** or **right**: three buttons at the start of the bar above the open cell, the way it stands now pressed. A press writes it at once, for this paper (`alignByCell` of the paper: `{ email: left }`), and is a step of the history. A template may give its own (`alignByCell` of the template); a paper names only what differs from its template, else from its form, so choosing the way the form draws a cell takes the paper's away. A cell drawn by the sheet's own layout (the gender, the photo, a block of lines) and a piece inside a line (a year in 生年月日) have no buttons: their place is the form's. The pages draw a cell as the sheet does.

### Renaming a paper

A paper (or a template) is renamed where its name is shown: in **the table of papers**, Rename in the menu of its row (a right click), its name then typed in the row; and in **the bar of its sheet** while the sheet is edited, its name typed there. Enter or a click elsewhere keeps it, Esc puts it back, an empty name is not written. The name is the name of its item and the `name` written in it, both written as one step (`jp/CvPaperName.jsx`); **its path stays**, so a block or a token naming the paper by its path still finds it. A name is written while the document is edited.

### Duplicating a paper

**Duplicate** in the menu of a row of the table makes a copy of a paper (or a template) at once, beside it: in the same folder of the same partition, at its path with `-copy` (`/example/cv/general-copy`, then `-copy-2`, …), named after it with （コピー） (then （コピー 2）, …), a copy of a copy named after the paper it copies (`cvJpPaperCopyGet`, `jp/CvJpData.js`). It holds what the paper holds: its template, its profile, its own cells, rows and parts, and which rows and parts it leaves out; only its name is new. Its row then shows its name typed in place and selected, so typing names it and Enter keeps it (Esc keeps the name given). The copy is one step of the history: Ctrl/⌘ + Z removes it. A copy of a template is named by no paper until a paper is set to it.

### Undo and redo

What is changed from a block of papers is undone with **Ctrl/⌘ + Z** and put again with **Ctrl/⌘ + Shift + Z** while the author is at the block (pointed at it or clicked in it last), and with the two buttons ↶ ↷ in the bar of a sheet being edited and in the tools of the table: the text of a cell, a row (written, hidden in this paper, deleted, dragged), a part (moved, deleted, added), the way of the years, a name, a copy of a paper, and the values of the profile written from the sheet (a query's card, a period, a badge, a photo). While a field is being typed the keys are the field's own, as anywhere on the page.

The data of the objects is not the text of the document, so the page's history does not hold it: the block keeps a history of its own (`jp/cv-edit-history.js`) and answers the undo the page delivers to it (react-doc: `main/doc_page_impl_edit_history.md#a-component-with-changes-of-its-own`). With nothing of its own to take back, the page undoes the document instead.

- **A step** is what one action wrote, each item with its data before and after: a badge's data and its name are one step, as are the two writes of a name. Its label says the paper it was made in (`履歴書（汎用）: a row of 学歴 hidden in this paper`), shown by the page's notice and the buttons' tooltips.
- **One history a block**, kept while the page is open: the table and the sheets opened in it share it, and a sheet opened again keeps its steps. A step made in another paper of the block is taken back too, and its label says which.
- **Only what is still there.** A step is taken back only while every item it wrote still holds what it wrote: an item changed since by something else (the profile's own page, another tab) is left as it is, and the step is dropped, said so (`Not undone: …`). An item it made is removed by the undo and made again, under the same key, by the redo.
- **What is open closes.** A cell or a row being typed when a step is taken is closed, its draft not kept.
- **Not in it:** the view of the table (its columns and widths, kept on their own), a new paper made from its form, and what the profile's own page changes.

## When something does not fit

A sheet reads three things it does not own the shape of: its profile (another object), its template and its own data, all written by hand as often as by the page. Nothing checks their shape on the way in (react-doc: `main/doc_page_impl_obj_frontend.md#what-a-type-accepts`), so the sheet reads them defensively, **draws what it can, and says what does not fit**, never an empty paper without a word:

| what | where it is said | what is drawn |
| --- | --- | --- |
| the paper names no profile, or one no doc page has | a line above the sheet | the form, its cells reading nothing |
| the profile is an object whose type holds no item of the kind `cv.profile.info` (a papers object, say; any type holding the kind is a profile) | a line: what its type holds, and that nothing is read from it | the same: it is not read as a profile |
| the profile holds no information in the partition of the paper | a muted line naming the partitions that hold some | the same |
| an item of the profile it lists is gone from the store, or deleted | a line per item | the other items |
| the template named is not there, names an asset of another kind, or is a template of the other form | a line | the default form |
| a section of the template is no mapping, of a type the sheet does not know, or has the id of a section before it | a line per section | the template without it |
| `param.instance` names a template (anything but a paper) | one line in the place of the sheet | nothing |
| a write (a cell saved, a value kept in the profile, a row, a block) that does not fit the kind of its item (`type.yaml`) | the message of the card: where it does not fit | nothing is written |
| a query of a cell nothing answers | the cell marked while the sheet is edited, its tooltip saying which | the cell empty |
| the photo reads a text that is no image | the photo box marked while the sheet is edited, its tooltip quoting the text | the empty photo box |
| the query of a history's rows reads no entry, the folder of a career holds no employer | its empty row says so while the sheet is edited | the empty row |

The rule: a problem of **what the paper reads** (its profile, its template, the partition) is a line above the sheet, in reading mode too, since every reader of the paper sees its consequence; a problem of **one cell** is marked on the cell while the sheet is edited, and the printed paper only lacks the value. A value the form is whole without (a fact of a project, the end of a period) is never marked: empty, it is just not drawn. Should the sheet throw anyway, react-doc draws the block as one line saying so and leaves the rest of the page alone (react-doc: `main/doc_page_impl_mdx_comp.md#a-component-that-fails-to-draw`).

## Pages

**Pages…** in the bar of a sheet opens the paper on A4 pages, as it is printed, in a dialog over the page (react-doc's `PanelPopup`: moved, resized, maximized, closed by Escape), laid out by react-doc's pagination (react-doc: `main/doc_page_impl_pagination.md`); the sheet stays where it is. A page draws a cell, a row and a line as the sheet does, tokens included: a badge is on the printed page, a link reads as its label. The sheet declares it in the registry (`expose.pagination` in `cv-comp.js`), and `jp/CvJpPagination.jsx` is all of it: the flow of a paper is its sections, each a piece of plain, resolved data, drawn by the components of the sheet read-only.

```text
piece     cut                                   a part going on              a part cut below
basic     never
head      never
closing   never
history   between rows (never after a group's   the head row of the table    its rules drawn to the bottom
          heading, which stays with its rows);  again; a group cut in two    of the page, no margin under it
          a row of badges in lines that does    without its heading again; a
          not fit whole: between its lines      row cut in two goes on with
                                                年, 月 and 備考 blank
career    between projects (an employer's line  the head row again; an       the same
          stays with its first project)         employer cut in two without
                                                its line again
text      between its lines                     its title line again         its box drawn to the bottom
```

**A row of badges is cut between its lines.** A row that does not fit in what is left of a page goes to the next one whole, unless its text holds badges in more than one line (各種IT資格取得 and a dozen certifications): then it is cut after the last line of badges that fits, so a page is not left mostly empty above a tall row. The part on the page keeps its year, month, words and 備考, and runs on to the bottom of the page, with no rule under it (`isCutInside`: the rules drawn under it to the bottom are its own); the part going on, at the top of the next page under the head row of the table again, has the rest of the badges, its 年, 月 and 備考 blank. A badge drawn in a row marks the place after it (`data-page-break`, named by the row and where the badge ends in its text: `jp/cv-page-break.js`), and the cut is after a badge that ends a line, where the next starts lower: never inside a line, and not at all when not even the first line fits (`cvJpHistorySplit`).

**A block is cut between lines as its author wrote them**, a paragraph or an item of a list, so a paragraph is never cut in two. The cut moves up until both parts read well: a heading stays with what follows it, labels one under another stay together (up to 8 of them), and neither part is one stray line (a part keeps two lines, or one as tall as a few). A block that cannot be cut so goes to the next page whole. The last section of a paper keeps no margin under it, so it is never sent to a page of its own for the sake of that margin.

**The title of the PDF** is typed in the bar of the pages, beside **Download PDF**: what a PDF reader shows as its title, and what its file is named (what a file name cannot hold, `/` or `:`, made `_`). It is a cell of the paper (`valueByCell['pdf-title']`), so it holds words and queries, `履歴書_{{name/jp/last/kanji}}{{name/jp/first/kanji}}` reading 履歴書_山田太郎, and is drawn as it reads; a template may give one to its papers (`cellById['pdf-title']`). Empty, the title is the paper's name. It is typed while the document is edited (read, it is shown), and is a step of the history.

The page is A4 with the margins of the common form (`CV_JP_PAGE_SPEC`). **Download PDF**, in the header of the dialog, makes the file at once, without a dialog: the pages are printed by a browser of the development server's machine, so the text of the PDF is text and its rules are lines, whatever it is zoomed to (react-doc: `main/doc_page_impl_pagination.md#downloading-a-pdf`). Where that cannot be done (a built page, no Chrome or Edge on that machine) the PDF is one of page images, and the bar says so. **Print / PDF** prints the pages through the browser's own dialog, whose "Save as PDF" makes the same file of text; the button's hint says what Firefox and Safari need set there. A row taller than a page is not cut (it is placed alone and reported); the paper's own fields are edited on the sheet.

## The look

One paper for both forms: an A4 width of 794px, black rules on white in every theme of the page, grey head cells, the same type. What a form sets differently is its own ([cv-jp](cv-jp.md#the-look), [we-jp](we-jp.md#the-look)), under the class of its form (`doc-cv-jp-form-cv`, `doc-cv-jp-form-we`), which the paper of the sheet and every piece of a page stand in.

**Every rule of a table has one weight in a PDF too.** No cell of the sheet is positioned (`position: relative`) while it is read or printed: Chrome paints a positioned cell after the rules of its table, so its grey, clipped at the edge of a rule, lands on the pixels the rule shares with it, and a PDF viewer shows that rule thinner (the head of a history lighter than its rows; the heavier rule under the head of a career thinner except over the band, a step). What floats at the edge of a cell while the sheet is edited (the + of a heading, the grip of a row, the eye in the margin) is why a cell is positioned, and only then (`.doc-cv-jp-paper[data-editing]`).

## Files

```text
comp-mdx/jp/CvJpData.js             the sheet as data: templates, papers, forms, cells, the lines of a block, the
                                    sections of a paper and their order; pure
comp-mdx/jp/WeJpData.js             what is the work experience's own: its default template, its career; pure
comp-mdx/jp/CvJpStore.js            the state of a drawn sheet and its writes: cells, rows, sections, the career
comp-mdx/jp/CvJpSheet.jsx           the mode sheet: the paper edited in place, its cards, its section buttons, its pages
comp-mdx/jp/CvJpSection.jsx         the sections both forms draw (history, block, closing), the cell, the lines; the top of a CV
comp-mdx/jp/WeJpSection.jsx         the head and the career of a work experience
comp-mdx/jp/CvJpPagination.jsx, CvJpPaginationData.js   the paper on pages: its pieces, their cuts (pure)
comp-mdx/jp/CvJpList.jsx            the mode list
comp-mdx/jp/cv-query-cell.js, cv-badge-cell.jsx, cv-era-cell.jsx, cv-period-cell.jsx
                                    the tokens of a cell: a query, a badge, a year with its era, a period
comp-mdx/jp/CvJpImagePick.jsx       an image chosen or pasted
comp-mdx/jp/CvJp.css, WeJp.css      the paper and what both forms share; what is the work experience's own
comp-mdx/jp/CvJpData.test.js, WeJpData.test.js          npm test
```

A mode reaches a second object through `otherGet` of its api (react-doc: `main/doc_page_impl_obj_frontend.md#the-entry-component`), never the asset store.
