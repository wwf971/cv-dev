---
title: Badges
description: A certification badge or any small image of a profile, shown in a line of a paper, selected and changed where it stands
---

# Badges

A **badge** is a small image a paper (a CV, a work experience) shows beside a line: the badge of a certification next to the licence it belongs to, a logo. It belongs to the **profile**, like every fact about the person, so one badge is drawn in every paper reading that profile, and a paper only says where.

```text
the profile (cv.profile)                              a paper (cv.jp)
  data item, kind badge                                 a row of 免許・資格, its text:
    /playground/badge/aws/saa/v1                          AWS SAA 取得 {{/badge/aws/saa}}
      name:    AWS Certified Solutions Architect – Associate      │
      caption: AWS SAA / 2023.06                                  │
      image:   data:image/png;base64,…      ◄──── /badge/aws/saa ─┘   drawn as the image, in the line

several in one row, each with text under it:            ⬡          ⬡          ⬡
  {{/badge/aws/clf|size=56,caption}}{{/badge/aws/saa|size=56,caption}}…   AWS CLF    AWS SAA    AWS DVA
                                                      2022.11    2023.06    2024.02
```

## In the profile

A badge is one data item of the kind `cv.profile.badge` (`badge` in a profile; `type.yaml`), not a value among the information: an image is large, and is replaced on its own.

```yaml
# the data item at /playground/badge/aws/saa/v1
name: AWS Certified Solutions Architect – Associate
caption: |-                      # optional: the text under it where a paper asks for the badge's own,
  AWS SAA                        #   a line under another: what it is, when it was earned
  2023.06
issuer: Amazon Web Services      # optional
url: ''                          # optional: where the credential is shown
image: data:image/png;base64,…   # the image, scaled down to at most 400px, kept as text
```

- **Its path** is `/{partition}/badge/…`, and inside its partition it is named by what follows `/badge`: `aws/saa/v1`. Give it the folders a reader would look under (the issuer, the certification) and a last segment telling versions apart (`v1`, `2024`).
- **A folder names its first badge.** `aws/saa` is the first badge below that folder, in the order the profile lists them, so a CV writes `/badge/aws/saa` and shows whichever version the profile puts first; `/badge/aws/saa/v1` names one exactly.
- **A CV reads the badges of its own partition**, as it reads the information ([Partitions](README.md#partitions)).
- **The image is given** by choosing a file or pasting it. A badge made without one gets a stand-in drawn by this package: a plain hexagon with the letters of its name, not the artwork of any issuer.
- **The sample profile carries the badges of the twelve AWS certifications**, `aws/{code}/v1`, in its partition `example` (and a playground copied from it): `clf`, `aif` (foundational), `saa`, `dva`, `soa`, `dea`, `mla` (associate), `sap`, `dop`, `aip` (professional), `ans`, `scs` (specialty). The images are those of aws.amazon.com/certification, their empty margin cut off and scaled to 240px high. They are AWS's artwork: a CV shows the badge of a certification its person holds.

The mode **Information** of a profile lists the badges of a partition in its tab **Badges** ([the mode Information](cv-query.md#the-mode-information)): a row a badge, with its image, its path, its name (edited in place), **Image…** to replace the image, **Copy** (the `{{/badge/…}}` a CV writes) and a remove button. **Add a badge** at the top of the tab opens a row there: its path, then an image chosen or pasted, or none.

## In a CV

A badge is a **token** of a cell, the sheet's second kind in react-doc's cell editing kit beside the query ([The cells](cv-sheet.md#the-cells)):

```text
{{/badge/aws/saa}}                    the badge, at its usual size
{{/badge/aws/saa/v1|size=l}}          one version exactly, large here
{{/badge/aws/saa|size=64}}            64px high: any height, as a number
{{/badge/aws/saa|size=s,name}}        small, with its name written beside it
{{/badge/aws/saa|size=56,caption}}    with text under it: the badge's own caption, kept in the profile
{{/badge/aws/saa|caption=AWS SAA\n2023/06 ~ 2026/06}}    with text of this place under it, two lines
```

| parameter | says | |
| --- | --- | --- |
| `size` | its height: `s` (18px, the height of a line), `m` (30), `l` (46), or **any number of px** | absent: `m`; 60 with text under it, so that what the badge says can be read |
| `name` | its name beside the image | |
| `caption` | **text under it**: alone, the badge's own caption of the profile (its name while it has none); `caption=…`, this place's own | lines are parted by `\n` as written, since a token is never broken over lines; any number of them. The first line is set heavier. A `,` or `\|` typed in the card is kept in its full-width form, a parameter not holding them |

**A grid of badges.** A badge with text under it is a **tile**, the image over its lines, and tiles written one after another stand side by side and wrap: a row of certifications, each saying what it is and when it was earned, needs nothing more than its tokens. The text is free, so a date may be a range (`2026/01 ~ 2026/04`).

```yaml
# /example/info/license/aws: one row of 免許・資格 for all of them
year: 2024
month: 2
jp: "{{/badge/aws/clf|size=56,caption}}{{/badge/aws/saa|size=56,caption}}{{/badge/aws/dva|size=56,caption}}"
```

A row of a history holds several lines (Shift+Enter while it is typed; a list in the profile), so a line of words can stand over the tiles: `jp: [AWS 認定資格（3件）, "{{/badge/aws/clf|size=56,caption}}…"]`.

It may stand in any cell: in the text or the note of a row of a history, in a line of a block, in a value of a career. What follows `|` is how **this** token is drawn in this place, never part of the badge: `size` (`s` the height of a line, `m`, `l`), `name` (its name beside the image). A row holding a badge taller than its text grows to it. On the pages of the paper it is drawn as on the sheet, and so printed. A value of the profile may hold one itself (the text of a licence: `… 合格 {{/badge/aws/saa}}`): every paper listing that licence then shows it.

**Typing one.** In a cell or a row being edited: `/badge` (or `/bd`), then its path a folder at a time (`aws/`, `saa/`, `v1`), each folder also offered as itself (its first badge); or type `{{/badge/` directly. A whole path nothing is at (`aws/dva/v1`) offers **New badge at aws/dva/v1**: the badge is made in the profile with a stand-in image, and the token is written.

**Changing one.** While the sheet is edited, a click on a badge selects it (a ring around it; the row does not open), and its card stands to its right:

```text
Here            Size [S|M|L] [ 64 ] px       the three usual heights, or any height typed
                Text under it [None | The badge's | Own]
                                              Own: its lines, a field a line; the field after the last adds one,
                                              an emptied one goes
                Its name [Hidden|Beside it]   (while it has no text under it)
                Take out of the text
                (written into the token: {{/badge/aws/saa|size=64,caption}}, saved at once)
The badge, in the profile: for every paper of the partition
                Name   Caption (its lines, a field a line)   Replace its image… (a file, or paste one)
                (a text is clicked and typed in place: Enter, or leaving it, saves it; Esc keeps the old one)
```

Nothing in the card is a button that saves: what is changed is written at once, and **the badge on the sheet shows it at once**, in every place of the paper drawing it. A write the profile refused is said in the card (`Not saved: …`); the text typed stays in its field.

The card stays open while it is used, so a size is typed and then a caption. Escape, the close button or a click elsewhere closes it. This is the cell editing kit's mechanism for a token with a card (react-doc: `main/doc_page_impl_edit_cell.md#a-token-selected-its-card`); the badge only says what its card holds.

## Files

```text
comp-mdx/query/CvBadge.js        the badges of a profile: reading a partition's, a path resolved (a folder: its first),
                                 completion, a new badge, the stand-in image; how one is drawn in a place (its
                                 height, the lines under it); pure
comp-mdx/query/CvBadge.test.js   npm test
comp-mdx/jp/cv-badge-cell.jsx    the badge as a token kind: written, drawn, typed (/badge), its card
comp-mdx/jp/CvJpImagePick.jsx    an image given by a file or a paste, scaled down to be kept as text
comp-mdx/profile/CvProfileBadgeList.jsx   the badges of a partition, a tab of the mode Information
```
