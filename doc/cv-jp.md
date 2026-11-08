# Japanese-style CV (cv-jp)

The Japanese-style CV as an object of the type `cv.jp`: its **templates** say what the form looks like and what each cell says, its **instances** are the CVs, and a CV reads a profile ([query paths](cv-query.md)).

## The data

```yaml
# a template: data item of kind template, /example/template/jp-standard
name: 履歴書
sectionList:
  - { id: basic, type: basic }                 # the top of the form: name, birth, address, contacts, photo
  - id: history
    type: history                              # a table of 年, 月, the text
    title: 学 歴・職 歴
    groupList:
      - { id: edu, title: 学 歴, list: edu/jp }           # its rows: the entries of a query
      - { id: work, title: 職 歴, list: work/jp, isNote: true }   # with the column 備考
  - { id: license, type: history, title: 免 許・資 格, isNote: true, groupList: [{ id: license, list: license/jp, isNote: true }] }
  - { id: motivation, type: text, title: 志 望 の 動 機, text: '{{motivation/jp}}' }
cellById: {}                                   # optional: other texts of the cells of the top
```

```yaml
# an instance: data item of kind instance, /example/instance/sample
name: サンプルの履歴書
template: /example/template/jp-standard      # its whole path: a template of any partition
profile: frontend:w5p4...                      # absent: metadata.profile of the object
asOf: 2026-11-08                               # the date on the form and of the age; absent: today
valueByCell:                                   # what differs from the template: words, or other queries
  name-last: '{{name/jp/last/romaji/uppercase-all}}'
  motivation: この履歴書のためだけの文章
rowExtraByGroup:                               # rows only this CV has, each with an id of its own
  work: [{ id: rmh3k2a7, year: 2024, month: 4, text: 副業, note: 個人 }]
rowHiddenByGroup:                              # entries of the profile this CV leaves out
  edu: ['edu-1:start']
rowOrderByGroup:                               # the order of the rows, when not the order of time (dragged)
  work: ['extra:work:rmh3k2a7', 'info-9:', 'info-10:']
```

The rows of a group are the entries of its query and the CV's own rows, in order of time; `rowOrderByGroup` gives them another order, by their ids, and a row it does not name (added since) follows in order of time. A row of the CV keeps its `id`, so that its place survives a row before it being removed.

A cell says the first of: the instance's `valueByCell`, the template's `cellById` (or the text of a text section), the default of the form (`CV_JP_CELL_DEFAULT`). The cells of the top are `date`, `name-furigana-last`, `name-furigana-first`, `name-last`, `name-first`, `birth-era`, `birth-year`, `birth-month`, `birth-day`, `age`, `gender`, `postal`, `address`, `email`, `phone`, `photo`, and the optional `visa`, `nationality`, `github`, `homepage`, whose rows are drawn only when they say something.

## The modes

| mode | component | |
| --- | --- | --- |
| `sheet` | `CvJpSheet` | one CV; `param.instance` names it (a path, a key), the first otherwise |
| `list` | `CvJpList` | the CVs and templates; a click opens one, a form makes a new CV |

## Editing in place

**Edit** above the sheet (offered while the document is edited) turns the sheet editable. Every cell is then typed **in the cell itself**: a click makes it a surface (react-doc's `EditSourceSurface`, the same as a paragraph of a document) showing its own text, words and `{{queries}}`, while every other cell keeps showing what it reads. A **card** under the cell, its left edge at the cell's, holds what is not the text. Nothing of the sheet moves when a cell opens: the surface keeps the width the cell had, so a long text breaks into more lines (the only thing that makes a cell taller); a cell too narrow to read a query in (a name, a day, a year inside a line) keeps its box and its surface floats over it, growing to the right.

```text
a cell     the text in the cell                           Enter saves, Shift+Enter a new line (the motivation:
                                                          Enter a new line, Ctrl+Enter saves), Esc cancels,
                                                          a click elsewhere saves
           /query (or /q) in it                           a value of the profile, chosen a segment at a time:
                                                          /q name/ lists jp/, en/, last/, first/ with how many
                                                          values each holds; a folder chosen goes on inside it,
                                                          a value (shown with what it reads) writes {{name/jp/last/kanji}}
           the card                                       where the text comes from; what it reads; the value in
                                                          the profile when the cell is one query (Save to the
                                                          profile, for every CV reading it; added at the place its
                                                          path names when missing); Back to the template;
                                                          the Slash switch of the page; Save in this CV
a photo    the card                                       a file chosen is scaled down and kept as text in the profile
a row      every field in place at once: 年 (the era above follows), 月, the text, 備考
                                                          Tab and Shift+Tab go through them, Enter saves, Shift+Enter
                                                          a new line; the card is under the field focused
           the card                                       of the profile: written there, Leave out of this CV hides it
                                                          from this one; of this CV: Remove; Order by time when the
                                                          list has an order of its own
           the grip in the margin                         drags the row to another place in its list: rowOrderByGroup
           + on a heading                                 a new row of this CV, typed in place at the end of the list
More fields   the optional rows not drawn now (their text is typed in the card), and the rows left out
```

`/query` is the cell's own slash action (`jp/cv-query-slash.js`, its items `cvQuerySlashItemListGet` of `query/CvQuery.js`): the cells offer it and nothing else, and the page's actions (`/link`) are not offered there (react-doc: `main/doc_page_impl_edit_slash.md#beyond-the-document-editors`). Like every slash action it starts at the start of a word: after a space or at the start of a line, not right after `}}`.

A cell with a query nothing answers is marked in edit mode and empty in reading mode.

## The look

The form follows the common Japanese CV form: an A4 width of 794px, black rules on white in every theme of the page, the title with the date at its right, a photo box of 150 by 200 pixels, the era above the year in small type, rows of 年, 月, the text and sometimes 備考. It is not paginated yet ([README](README.md#not-here-yet)).

A mode reaches a second object through `otherGet` of its api (react-doc: `main/doc_page_impl_obj_frontend.md#the-entry-component`), never the asset store.
