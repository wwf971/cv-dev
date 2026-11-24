---
title: CV playground
description: A profile, a CV and a work experience of your own to try everything on, kept out of git
---

This document is yours: git ignores it, and the bar above sets it back to its template. What it shows lies in the partition **playground** of the two sample objects, which git ignores too ([partitions](README.md#partitions)), so nothing done here touches the example or reaches a commit. Switch the page to **Edit** first; the blocks below then offer their own controls.

## 1. The profile

The playground partition is empty after a clone. Press **Start from a copy of Example** to fill it with the made-up person (values and badges), then change anything. The folder `work` holds the employers and their projects, which a work experience draws as its career. The values are walked like folders: a click goes into one, the path bar goes back, and segments that come in any order are one item (**View** switches to a tree). A value is changed in its row; **Add a value** adds one where you are. The tab **Badges** holds the badges of the twelve AWS certifications; a badge gets another image by **Image…**.

<!--renderComp=ObjectFrontend-->
```yaml
object: frontend:w5pbeilkczg
mode: info
param:
  partition: playground
```

## 2. The papers

Make a CV and a work experience in the partition **Playground**: go to **Playground** by the path bar (then **CVs** or **Work experiences**), type a name. Each names the template of its form and opens in the panel; the path bar goes back, up, or to any of its segments.

<!--renderComp=ObjectFrontend-->
```yaml
object: frontend:w5pbej9gcnn
mode: list
param:
  path: /playground
  partition: playground
```

## 3. A CV (cv-jp)

The first CV of the partition playground. Press its **Edit**, then try:

- a click on a cell: type words, `{{` for a value of the profile, `/badge` for a badge, `/link` for a link, `/object` for an object of the page;
- select some words of a cell: the card offers to keep them in the profile and name them here by a path;
- a click on a row of a history: its text takes the same tokens, so a licence can show its badge: `AWS SAA 取得 {{/badge/aws/saa}}`;
- a click on a badge: its card stands to its right (any size in px and the text under it here; its name, caption and image in the profile: a text is typed in place and saved by Enter or by leaving it, and the badge shows it at once); badges with text under them, written one after another, stand as a grid;
- **Era above years** in the bar: the era above the years of the rows, off or on; `/era` in a cell: a year with its era, typed or read from a date of the profile;
- the photo: choose a file, or paste an image;
- the buttons in the right margin of a section: move it, leave it out, or add a **block** under it (a title line and a free area, as 志望の動機 is);
- **Pages…**: the CV on A4 pages, in a dialog; **Download PDF** makes a PDF whose text is text.

<!--renderComp=ObjectFrontend-->
```yaml
object: frontend:w5pbej9gcnn
mode: sheet
param:
  partition: playground
  kind: cv
```

## 4. A work experience (we-jp)

The first work experience of the partition playground: the same profile, drawn in the other form ([Japanese-style work experience](we-jp.md)). Its career is read off the folders of the profile, `work/{employer}/project/{project}`; the line of an employer and the numbered band beside its projects are one grey frame. Press its **Edit**, then try:

- a click on a company, a title, a fact (環境, 役割, 規模, 工程): each is one value of the profile; the card under it changes it for every paper (**Save to the profile**), or type words in the cell for this paper only;
- the small line under a company (事業内容, 資本金, …) is its own entries in the profile, none of them fixed by the form: **+ 項目** adds one, its label and what it says typed as any value; with the pointer on one, the eye leaves it out of this paper and the bin removes it from the profile;
- a click on a period: its card holds its four numbers in the profile, the year and the month of its start and of its end (an end emptied is 現在); `/period` in any cell writes a period of its own, its start over a vertical line over its end;
- **+** at the end of an employer's line: a new project of it, made in the profile, its title to type; **+** in the head of the table: a new employer;
- the eye in the left margin: an employer or a project left out of this paper (the profile keeps it; **More fields** draws it again);
- **Era above years** in the bar: every year of the periods and of 資格 with its Japanese era above it, or without;
- a block: write lines starting with `・`, `【ラベル】` or `■` and see them set as a list, as labels in a column, as a small heading;
- **+** in the right margin: a block of your own, anywhere, such as 語学 here.

<!--renderComp=ObjectFrontend-->
```yaml
object: frontend:w5pbej9gcnn
mode: sheet
param:
  partition: playground
  kind: we
```
