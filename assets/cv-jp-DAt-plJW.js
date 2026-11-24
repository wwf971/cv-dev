var e=`---
title: Japanese-style CV (cv-jp)
description: The form of the Japanese-style CV: its top, its histories, its box of text, and the look of the common form
---

# Japanese-style CV (cv-jp)

The Japanese-style CV is the form of the papers of the kind \`cv\`. It is drawn by the sheet both forms share, so templates, cells, editing in place, blocks and pages are described once, in [The sheet](cv-sheet.md); this document says what is the CV's own.

\`\`\`yaml
# its standard template (CV_JP_TEMPLATE_DEFAULT), drawn when a CV names none
name: 履歴書
form: cv
sectionList:
  - { id: basic, type: basic }                 # the top of the form
  - id: history
    type: history                              # a table of 年, 月, the text
    title: 学 歴・職 歴
    groupList:
      - { id: edu, title: 学 歴, list: edu/jp }           # its rows: the entries of a query
      - { id: work, title: 職 歴, list: work/jp, isNote: true }   # with the column 備考
  - { id: license, type: history, title: 免 許・資 格, isNote: true, groupList: [{ id: license, list: license/jp, isNote: true }] }
  - { id: motivation, type: text, title: 志 望 の 動 機, text: '{{motivation/jp}}', heightMin: 120, isIndent: true }
\`\`\`

## The top

The section \`basic\` is the top of the form: the title with the date at its right, the name with its furigana, birth, gender, address, contacts, and the photo beside them. It is the one section whose layout is the form's and not data: its cells have fixed places and fixed names.

\`\`\`text
date                                          {{date/jp}}現在
name-furigana-last, name-furigana-first       {{name/jp/last/hiragana}}  {{name/jp/first/hiragana}}
name-last, name-first                         {{name/jp/last/kanji}}     {{name/jp/first/kanji}}
birth-era, birth-year, birth-month, birth-day, age     {{birth/era}} {{birth/year}} … {{birth/age}}
gender                                        {{gender}}: 男 or 女 is circled
postal, address                               {{address/jp/postal}}  {{address/jp/text}}
email, phone                                  {{email}}  {{phone/jp}}
photo                                         {{photo}}: an image kept as text in the profile
visa, visa-expiry                             在留資格・在留期限: {{visa/jp}}  {{visa/expiry/jp}}     ┐ optional rows: drawn if filled,
nationality                                   国籍: {{nationality/jp}}                                ├ always or never, as the options of
github, homepage                              GitHub ページ, ホームページ, under the top                ┘ the part say (cv-sheet.md#the-options-of-a-part)
\`\`\`

Each is a cell, so a paper says something else by its \`valueByCell\` (the name in romaji: \`name-last: '{{name/jp/last/romaji/uppercase-all}}'\`), and a template by its \`cellById\`. The optional rows not drawn because they say nothing are typed from **More fields**; whether the photo box and the optional rows are drawn at all, and how wide the columns of headings and the column at the right are, is chosen in **Options…** of the part ([The options of a part](cv-sheet.md#the-options-of-a-part)). A status of residence and its expiry are values of the profile like any other (\`visa/jp\`, \`visa/expiry/jp\`).

## Its histories and its box

学歴・職歴 and 免許・資格 are sections of the type \`history\` ([A history](cv-sheet.md#a-history)): their rows are the dated entries of the profile, so a licence added there is in every CV, and its text may hold the [badge](cv-badge.md) of its certification. 志望の動機 is a [block](cv-sheet.md#blocks) with the height of the box of the paper form; a CV wanting more boxes (自己PR, 趣味・特技, 本人希望記入欄) adds blocks of its own under it.

## The look

The form follows the common Japanese CV form: the title at the left with the date at its right, a photo box of 150 by 200 pixels, the era above the year in small type (\`平成28\` over \`2016\`; the way of this form, which a template or a paper may turn off: [A year with its era](cv-sheet.md#a-year-with-its-era)), rows of 年, 月, the text and sometimes 備考, titles spaced as they are written (\`学 歴・職 歴\`), and boxes of text as roomy as those filled in by hand.
`;export{e as default};