---
title: Demonstration
description: A Japanese-style CV drawn from two frontend objects of this package, and edited in place
---

Two frontend objects of this package draw what follows: a **profile**, and the **CVs** that read it. The person is made up, and lives in the partition `example` ([partitions](README.md#partitions)). While the package is served alone (`react-doc dev <this folder>`) everything here is edited in place, and the edits are written into its sample objects; where a workspace lists or mounts the package, the same page is read-only.

## A CV

Every cell says words, or holds a query of the profile in double braces ([Japanese-style CV](cv-jp.md)). Switch the page to edit mode (**Edit** in its toolbar): the sheet then has an **Edit** of its own, at the right edge of the paper; press it and click a cell. In reading mode the sheet only reads, and so do the lists below. In the sheet's edit mode a click on a cell makes the cell itself editable, showing its words and `{{queries}}` while the others show what they read, and a card under it holds the rest; nothing of the sheet moves. Type words only this CV says, or `/q name/` to choose a value of the profile a segment at a time (a folder goes on, a value is written as `{{path}}`), or change the value in the profile for every CV from the card. A row of the history opens all its fields in place (Tab goes through them); drag the grip at its left to put it elsewhere in its list, or leave it out of this CV.

<!--renderComp=ObjectFrontend-->
```yaml
object: frontend:w5pbej9gcnn
mode: sheet
param:
  instance: /example/instance/sample
```

## Another CV, the same profile

This one draws the name in romaji and the furigana in katakana, by other words in its queries, and gives the motivation words of its own.

<!--renderComp=ObjectFrontend-->
```yaml
object: frontend:w5pbej9gcnn
mode: sheet
param:
  instance: /example/instance/name-in-romaji
```

## Its CVs and templates

<!--renderComp=ObjectFrontend-->
```yaml
object: frontend:w5pbej9gcnn
mode: list
```

## The information, and trying a query

A query path is a path, read in the order of the data, except inside an **unordered group** of a value's path pattern: the name is stored under `{jp/last/}` and `{jp/first/}` (a `/` ends every segment that something follows, so it goes after each member), so `name/jp/first` and `name/first/jp` read the same ([Order-free segments](cv-query.md#order-free-segments)). Try `name/first/jp/katakana` or `name/jp/first/romaji/uppercase-all`; a value that is not stored may be derived, a default is the first in the order of the data. The column **path** shows each value's pattern. Every value is edited in place here.

<!--renderComp=ObjectFrontend-->
```yaml
object: frontend:w5pbeilkczg
```
