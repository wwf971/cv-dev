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

A cell says the first of: the instance's `valueByCell`, the template's `cellById` (or the text of a text section), the default of the form (`CV_JP_CELL_DEFAULT`). What it says is a **cell text**: words with tokens in them ([The cells](#the-cells)). The cells of the top are `date`, `name-furigana-last`, `name-furigana-first`, `name-last`, `name-first`, `birth-era`, `birth-year`, `birth-month`, `birth-day`, `age`, `gender`, `postal`, `address`, `email`, `phone`, `photo`, and the optional `visa`, `nationality`, `github`, `homepage`, whose rows are drawn only when they say something.

## The modes

| mode | component | |
| --- | --- | --- |
| `sheet` | `CvJpSheet` | one CV; `param.instance` names it (a path, a key); without it `param.partition` asks for the first CV of a partition; else the first. It is the mode showing one thing of the object (`pathParam: instance` in `type.yaml`), so a reference to a CV from elsewhere, `frontend:{id}#/example/instance/sample`, is drawn by it |
| `list` | `CvJpList` | the CVs and templates; a click opens one, a form makes a new CV |

## The cells

The cells of a CV, and the text and the note of every row of a history, are cells of react-doc's **cell edit layer** (react-doc: `main/doc_page_impl_edit_cell.md`), which every component uses for the small texts typed in place, so a cell of a CV is typed like a cell of any other object and may hold the same things. Its text is words with **tokens**, each drawn by what it belongs to:

```text
{{name/jp/last/kanji}}                    a query of the profile the CV reads: the CV's own token (cv-query-cell.js)
{{/badge/aws/saa}}                        a badge of the profile, drawn as its image: the CV's second token (cv-badge.md)
[the project](~docs:root/project.md)      a link to a document, resolved and followed as a link of a document
{{@frontend:w5p…#example/name/en/first}}  a view of an object of the page, or of something inside one
東京都千代田区                              words only this CV says
```

- **A brace token without a sigil is a query.** It is the CV's own kind of token: written `{{path}}`, drawn as the value the query reads, typed with `/query` or by typing `{{`. One starting with `/badge/` is a [badge](cv-badge.md). The other kinds are react-doc's, and a cell accepts them all.
- **The plain text of a cell** (`cell.text`: every token as text, a link as its label, a badge as its name) is what the gender marks compare and what decides whether an optional row is drawn; `missingList` names the queries nothing answers.
- **A value of any profile can be named from anywhere**, not only from a CV reading it: `frontend:{profile id}#example/name/jp/first` is a reference of the page's object registry, which a paragraph or a cell of another object writes with `/object`, walking Profile → the profile → its partition → the path. The profile answers that walk itself ([Query paths: from outside a CV](cv-query.md#from-outside-a-cv)).

## Editing in place

**Edit** above the sheet (offered while the document is edited) turns the sheet editable. Every cell is then typed **in the cell itself**: a click makes it a surface (react-doc's `CellEdit`, the same surface as a paragraph of a document) showing its own text, words and tokens as written, while every other cell keeps showing what it reads. A **card** under the cell, its left edge at the cell's, holds what is not the text. Nothing of the sheet moves when a cell opens: the surface keeps the width the cell had, so a long text breaks into more lines (the only thing that makes a cell taller); a cell too narrow to read a query in (a name, a day, a year inside a line) keeps its box and its surface floats over it, growing to the right.

```text
a cell     the text in the cell                           Enter saves, Shift+Enter a new line (the motivation:
                                                          Enter a new line, Ctrl+Enter saves), Esc cancels,
                                                          a click elsewhere saves
           {{ in it, or /query (or /q)                    a value of the profile, chosen a segment at a time:
                                                          {{name/ lists jp/, en/, last/, first/ with how many
                                                          values each holds; a folder chosen goes on inside it,
                                                          a value (shown with what it reads) writes {{name/jp/last/kanji}}
           /badge in it                                   a badge of the profile, a folder at a time (cv-badge.md)
           /link in it                                    a link to a document of the workspace
           /object in it                                  a view of an object: a type, an object, what is inside it
           words selected in it                           the card offers to keep them in the profile: type the
                                                          path they are kept at (address/jp/building) and they are
                                                          written there, and replaced in the cell by {{that path}}.
                                                          only words: a selection holding a token, in part or
                                                          whole, is refused; so is a path holding another value
           the card                                       where the text comes from; what it reads; the value in
                                                          the profile when the cell is one query (Save to the
                                                          profile, for every CV reading it; added at the place its
                                                          path names when missing); Back to the template;
                                                          the Slash switch of the page; Save in this CV
a photo    a click on the photo box                       a card of its own: an image, so nothing is typed, and no
                                                          Slash switch. Choose a photo…, or paste an image (Ctrl/⌘ + V)
                                                          while the card is open: scaled down and kept as text in the
                                                          profile (photo), for every CV of the partition. the card
                                                          says whether git sees that partition; Remove the photo
a row      every field in place at once: 年 (the era above follows), 月, the text, 備考
                                                          Tab and Shift+Tab go through them, Enter saves, Shift+Enter
                                                          a new line; the card is under the field focused. the text
                                                          and 備考 are cells: {{, /badge, /link, /object work in them
a badge    a click on it                                  selects it; its card stands to its right: its size here,
                                                          its name and image in the profile, taking it out
           the card                                       of the profile: written there, Leave out of this CV hides it
                                                          from this one; of this CV: Remove; Order by time when the
                                                          list has an order of its own
           the grip in the margin                         drags the row to another place in its list: rowOrderByGroup
           + on a heading                                 a new row of this CV, typed in place at the end of the list
More fields   the optional rows not drawn now (their text is typed in the card), and the rows left out
```

The query is the CV's own token kind (`jp/cv-query-cell.js`: how a query is written, drawn and typed; its items are `cvQuerySlashItemListGet` of `query/CvQuery.js`), handed to the cell layer with the cell (`useCell({ tokenList: [cvQueryToken], context: { info, dateNow } })`); `/link` and `/object` are the kinds every cell of the page has. In a cell, `/` and `{{` work anywhere, also right after `}}` or a Japanese word, since the words of a cell are not set apart by spaces (react-doc: `main/doc_page_impl_edit_cell.md#drawing-and-typing`). The year and the month of a row are plain text.

**More fields** lists what is not drawn; it closes on a click anywhere else.

A cell with a query nothing answers is marked in edit mode and empty in reading mode.

## Pages

**Pages…** in the bar of a sheet opens the CV on A4 pages, as it is printed, in a dialog over the page (react-doc's `PanelPopup`: moved, resized, maximized, closed by Escape), laid out by react-doc's pagination (react-doc: `main/doc_page_impl_pagination.md`); the sheet stays where it is. A page draws a cell and a row as the sheet does, tokens included: a badge is on the printed page, a link reads as its label. A section of text, which pages cut between its lines, is its plain text there. The sheet declares it in the registry (`expose.pagination` in `cv-comp.js`), and `jp/CvJpPagination.jsx` is all of it: the flow of a CV is its sections, each a piece of plain, resolved data, drawn by the components of the sheet (`jp/CvJpSection.jsx`) read-only.

```text
piece     cut                                 a part going on                 a part cut below
basic     never                               -                               -
history   between rows (never after a group's  the head row of the table again; its rules drawn to the bottom
          heading, which stays with its rows)   a group cut in two without its  of the page, no margin under it
                                                heading again
text      between lines of its text             no indent of its first line     its box drawn to the bottom of the page
```

The page is A4 with the margins of the common form (`CV_JP_PAGE_SPEC`). **Print / PDF**, in the header of the dialog, prints the pages through a document of their own, so "Save as PDF" in the print dialog makes a PDF whose text is text; the button's hint says what Firefox and Safari need set in their dialog. **Download PDF** makes a PDF of page images in the page, the same in every browser. A row taller than a page is not cut (it is placed alone and reported); the CV's own fields are edited on the sheet.

## The look

The form follows the common Japanese CV form: an A4 width of 794px, black rules on white in every theme of the page, the title with the date at its right, a photo box of 150 by 200 pixels, the era above the year in small type, rows of 年, 月, the text and sometimes 備考. On pages it is cut as [Pages](#pages) says.

A mode reaches a second object through `otherGet` of its api (react-doc: `main/doc_page_impl_obj_frontend.md#the-entry-component`), never the asset store.
