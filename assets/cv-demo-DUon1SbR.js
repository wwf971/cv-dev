var e=`---
title: Demonstration
description: A Japanese-style CV and a Japanese-style work experience drawn from two frontend objects of this package, and edited in place
---

Two frontend objects of this package draw what follows: a **profile**, and the **papers** that read it, a CV (cv-jp) and a work experience (we-jp). The person is made up, and lives in the partition \`example\` ([partitions](README.md#partitions)). While the package is served alone (\`react-doc dev <this folder>\`) everything here is edited in place, and the edits are written into its sample objects; where a workspace lists or mounts the package, the same page is read-only. To try all of it without changing the example, use the [playground](cv.playground.md).

## A CV

Every cell says words, or holds a query of the profile in double braces ([The sheet](cv-sheet.md), [Japanese-style CV](cv-jp.md)). Switch the page to edit mode (**Edit** in its toolbar): the sheet then has an **Edit** of its own, at the right edge of the paper; press it and click a cell. In reading mode the sheet only reads, and so do the lists below.

- **A cell** becomes editable itself, showing its words and \`{{queries}}\` while the others show what they read; a card under it holds the rest, and nothing of the sheet moves. Type words only this CV says, \`{{\` (or \`/q \`) to choose a value of the profile a segment at a time, \`/link\` for a link to a document, \`/object\` for a view of an object of the page, or change the value in the profile for every paper from the card.
- **Words selected** in a cell: the card offers to keep them in the profile and name them here by a path.
- **A row** of a history opens all its fields in place (Tab goes through them); drag the grip at its left to put it elsewhere in its list, or hide it in this CV (the profile keeps it). Ctrl/⌘ + Z takes back what was changed.
- **[Badges](cv-badge.md)** of the profile stand in the last licence, one row for the three AWS certifications: each token says \`{{/badge/aws/saa|size=56,caption}}\`, so they stand as a grid, each with its caption of the profile under it. Click one to select it, and its card stands to its right: any size in px, its text here or in the profile.
- **Era above years** in the bar turns the era above the years of the rows off and on, for this CV; \`/era\` in any cell writes a year with its era.
- **A section** has a few buttons in the right margin of the paper: move it, leave it out, or add a **block** under it, a title line and a free area as 志望の動機 is.
- **Pages…** opens the CV on A4 pages in a dialog; **Download PDF** there makes a PDF whose text is text, printed by a browser of the development server's machine.

<!--renderComp=ObjectFrontend-->
\`\`\`yaml
object: frontend:w5pbej9gcnn
mode: sheet
param:
  instance: /example/cv/general
\`\`\`

## A work experience, the same profile

The other form ([Japanese-style work experience](we-jp.md)): the same person, read from the same profile. Its **career** is not written in the paper: the employers and their projects are folders of the profile (\`work/sample-systems/project/inventory\`), and every value drawn, a company, a period, a title, a fact beside a project, is a cell reading one of them. In its edit mode a **+** at the end of an employer's line makes a new project in the profile, and the eye in the left margin leaves an employer or a project out of this paper.

The line of an employer and the numbered band down the left of its projects are one grey frame: what stands in it is that employer's ([The look](we-jp.md#the-look)).

Everything else is a **block**: 職務要約, 活かせる経験・知識・技術 and 自己PR read their text from the profile, and 語学 is a block only this paper has. How a line starts says how it is drawn: \`・\` an item of a list, \`【言語】\` a label (labels one under another stand in a column, so a list of skills needs no table), \`＜…＞\` a small heading ([Blocks](cv-sheet.md#blocks)). 資格 is the licences of the profile, with their badges.

<!--renderComp=ObjectFrontend-->
\`\`\`yaml
object: frontend:w5pbej9gcnn
mode: sheet
param:
  instance: /example/we/general
\`\`\`

## Another CV, the same profile

A CV for one kind of application: to a foreign-affiliated company it draws the name in romaji and the furigana in katakana, by other words in its queries, and writes motivation words of its own, which belong to that application rather than to the profile.

<!--renderComp=ObjectFrontend-->
\`\`\`yaml
object: frontend:w5pbej9gcnn
mode: sheet
param:
  instance: /example/cv/foreign-affiliated
\`\`\`

## The papers and templates

Every paper and template of the object, walked by their paths: a click on a name opens the paper here, the path bar goes back, forward, up, or to any segment ([The papers](cv-sheet.md#the-papers)).

<!--renderComp=ObjectFrontend-->
\`\`\`yaml
object: frontend:w5pbej9gcnn
mode: list
\`\`\`

## The information, and trying a query

A query path is a path, read in the order of the data, except inside an **unordered group** of a value's path pattern: the name is stored under \`{jp/last/}\` and \`{jp/first/}\` (a \`/\` ends every segment that something follows, so it goes after each member), so \`name/jp/first\` and \`name/first/jp\` read the same ([Order-free segments](cv-query.md#order-free-segments)). Try \`name/first/jp/katakana\` or \`name/jp/first/romaji/uppercase-all\`; a value that is not stored may be derived, a default is the first in the order of the data. Walk into \`work\` to see the employers and their projects as the career reads them. Every value is edited in place here.

<!--renderComp=ObjectFrontend-->
\`\`\`yaml
object: frontend:w5pbeilkczg
\`\`\`
`;export{e as default};