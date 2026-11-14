---
title: CV playground
description: A profile and a CV of your own to try everything on, kept out of git
---

This document is yours: git ignores it, and the bar above sets it back to its template. What it shows lies in the partition **playground** of the two sample objects, which git ignores too ([partitions](README.md#partitions)), so nothing done here touches the example or reaches a commit. Switch the page to **Edit** first; the blocks below then offer their own controls.

## 1. The profile

The playground partition is empty after a clone. Press **Start from a copy of Example** to fill it with the made-up person (values and badges), then change anything. The values are walked like folders: a click goes into one, the path bar goes back, and segments that come in any order are one item (**View** switches to a tree). A value is changed in its row; **Add a value** adds one where you are. The tab **Badges** holds the badges of the twelve AWS certifications; a badge gets another image by **Image…**.

<!--renderComp=ObjectFrontend-->
```yaml
object: frontend:w5pbeilkczg
mode: info
param:
  partition: playground
```

## 2. A CV

Make a CV in the partition **Playground** (its name, the partition, a template of the example), then open it below.

<!--renderComp=ObjectFrontend-->
```yaml
object: frontend:w5pbej9gcnn
mode: list
```

## 3. The sheet

The first CV of the partition playground. Press its **Edit**, then try:

- a click on a cell: type words, `{{` for a value of the profile, `/badge` for a badge, `/link` for a link, `/object` for an object of the page;
- select some words of a cell: the card offers to keep them in the profile and name them here by a path;
- a click on a row of a history: its text takes the same tokens, so a licence can show its badge: `AWS SAA 取得 {{/badge/aws/saa}}`;
- a click on a badge: its card stands to its right (its size here, its name and image in the profile);
- the photo: choose a file, or paste an image;
- **Pages…**: the CV on A4 pages, in a dialog, to print or download.

<!--renderComp=ObjectFrontend-->
```yaml
object: frontend:w5pbej9gcnn
mode: sheet
param:
  partition: playground
```
