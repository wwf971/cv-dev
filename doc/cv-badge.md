---
title: Badges
description: A certification badge or any small image of a profile, shown in a line of a CV, selected and changed where it stands
---

# Badges

A **badge** is a small image a CV shows beside a line: the badge of a certification next to the licence it belongs to, a logo. It belongs to the **profile**, like every fact about the person, so one badge is drawn in every CV reading that profile, and a CV only says where.

```text
the profile (cv.profile)                              a CV (cv.jp)
  data item, kind badge                                 a row of 免許・資格, its text:
    /playground/badge/aws/saa/v1                          AWS SAA 取得 {{/badge/aws/saa}}
      name:  AWS Certified Solutions Architect – Associate        │
      image: data:image/png;base64,…        ◄──── /badge/aws/saa ─┘   drawn as the image, in the line
```

## In the profile

A badge is one data item of the kind `badge` (`type.yaml`), not a value among the information: an image is large, and is replaced on its own.

```yaml
# the data item at /playground/badge/aws/saa/v1
name: AWS Certified Solutions Architect – Associate
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

A badge is a **token** of a cell, the CV's second kind in react-doc's cell edit layer beside the query ([The cells](cv-jp.md#the-cells)):

```text
{{/badge/aws/saa}}               the badge, at its usual size
{{/badge/aws/saa/v1|size=l}}     one version exactly, large here
{{/badge/aws/saa|size=s,name}}   small, with its name written beside it
```

It may stand in any cell, and in the text or the note of a row of a history. What follows `|` is how **this** token is drawn in this place, never part of the badge: `size` (`s` the height of a line, `m`, `l`), `name` (its name beside the image). A row holding a badge taller than its text grows to it. On the pages of the CV it is drawn as on the sheet, and so printed.

**Typing one.** In a cell or a row being edited: `/badge` (or `/bd`), then its path a folder at a time (`aws/`, `saa/`, `v1`), each folder also offered as itself (its first badge); or type `{{/badge/` directly. A whole path nothing is at (`aws/dva/v1`) offers **New badge at aws/dva/v1**: the badge is made in the profile with a stand-in image, and the token is written.

**Changing one.** While the sheet is edited, a click on a badge selects it (a ring around it; the row does not open), and its card stands to its right:

```text
Here            Size [S|M|L]   Its name [Hidden|Beside it]   Take out of the text
                (written into the token: {{/badge/aws/saa|size=l}}, saved at once)
The badge, in the profile: for every CV of the partition
                Name (edited in place)   Replace its image… (a file, or paste one)
```

Escape, the close button or a click elsewhere closes the card. This is the cell edit layer's mechanism for a token with a card (react-doc: `main/doc_page_impl_edit_cell.md#a-token-selected-its-card`); the badge only says what its card holds.

## Files

```text
comp-mdx/query/CvBadge.js        the badges of a profile: reading a partition's, a path resolved (a folder: its first),
                                 completion, a new badge, the stand-in image; pure
comp-mdx/query/CvBadge.test.js   npm test
comp-mdx/jp/cv-badge-cell.jsx    the badge as a token kind: written, drawn, typed (/badge), its card
comp-mdx/jp/CvJpImagePick.jsx    an image given by a file or a paste, scaled down to be kept as text
comp-mdx/profile/CvProfileBadgeList.jsx   the badges of a partition, a tab of the mode Information
```
