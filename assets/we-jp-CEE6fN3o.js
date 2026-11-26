var e=`---
title: Japanese-style work experience (we-jp)
description: The form of the Japanese-style work experience: its head, its career read off the folders of the profile, its blocks, and how its facts are kept
---

# Japanese-style work experience (we-jp)

The Japanese-style work experience (we-jp) is the form of the documents of the kind \`we\`: the document telling what a person has worked on, handed in beside a CV. It reads the **same profile** as a CV, and is drawn by the sheet both forms share: templates, cells, editing in place, blocks and pages are described in [The sheet](cv-sheet.md). This page says what is its own: its head, its **career**, and where the profile keeps what it reads.

<!--renderComp=DiagramText-->
\`\`\`text
                     職 務 経 歴 書                    head
                                   2026年11月19日現在
                                   氏名    山田 太郎
┌────────────────────────────────────────────────┐
│ 職務要約                                       │   block      {{summary/jp}}
├────────────────────────────────────────────────┤
│ 期間    │ 職務経歴                 │ 環境・役割│   career     work/…
│ 2022.4〜│ サンプルシステムズ株式会社    正社員 │     an employer
│ 2022.5〜│ 蔵書検索システムの新規開発│ 環境 Java│     a project
│ 2023.4〜│ 在庫管理システムの機能追加│ 役割 …   │     a project
├────────────────────────────────────────────────┤
│ 活かせる経験・知識・技術                       │   block      {{skill/jp}}
│ 語学                                           │   block      this document's own
│ 資格    2023  6  AWS 認定 …  (badge)           │   history    license/jp
│ 自己PR                                         │   block      {{pr/jp}}
└────────────────────────────────────────────────┘
                                             以上   closing
\`\`\`

\`\`\`yaml
# its standard template (WE_JP_TEMPLATE_DEFAULT), drawn when a work experience names none
name: 職務経歴書
form: we
sectionList:
  - { id: head, type: head, title: 職 務 経 歴 書 }
  - { id: summary, type: text, title: 職務要約, text: '{{summary/jp}}' }
  - { id: career, type: career, title: 職務経歴, list: work }
  - { id: skill, type: text, title: 活かせる経験・知識・技術, text: '{{skill/jp}}' }
  - { id: license, type: history, title: 資格, isNote: true, groupList: [{ id: license, list: license/jp, isNote: true }] }
  - { id: pr, type: text, title: 自己PR, text: '{{pr/jp}}' }
  - { id: closing, type: closing, text: 以上 }
\`\`\`

Only the head and the career are sections of its own. Everything else is a [block](cv-sheet.md#blocks) or a [history](cv-sheet.md#a-history): what a work experience says beyond its career differs from person to person, so it is free text with a title, not a fixed table. A list of skills is a block whose lines start with labels; qualifications are the licences of the profile with their [badges](cv-badge.md), the same rows a CV shows, where several certifications of one kind are one row, their badges a grid with what each is and when it was earned under it ([A grid of badges](cv-badge.md#in-a-cv)).

## The head

The section \`head\`: the title in the middle (the \`title\` of the section, a cell), then at the right the date (\`date\`: \`{{date/jp}}現在\`) and the name (\`name-full\`: \`{{name/jp/kanji}}\`, the last and first name joined).

## The career

The section \`career\` draws the employers of the profile, each with its projects. It holds no list of them: **it reads the folders of the profile**, so an employer or a project added to the profile is in every work experience, and a CV reading \`work/jp\` lists the same employers as rows of its 職歴.

<!--renderComp=DiagramText-->
\`\`\`text
the profile, /{partition}/info/…      the career
work/                                  section.list: the employers
├── sample-systems/             ────►  2022年4月  サンプルシステムズ株式会社
│   ├── start, end                     its period (no end: 現在)
│   ├── jp/name, jp/…                  its values
│   └── project/                       section.projectFolder
│       ├── library-search/     ────►  2022年5月  蔵書検索システムの新規開発
│       │   ├── start, end
│       │   └── jp/title, …
│       └── inventory/          ────►  2023年4月  在庫管理システムの機能追加
└── sample-robotics/            ────►  2021年7月  サンプルロボティクス株式会社
\`\`\`

- **An employer is every folder below \`list\`** (\`work\`), **a project every folder below its \`project\`**. Each is usually a data item of its own (\`/example/info/work/sample-systems/project/inventory\`), but how the data is cut into items changes nothing ([Query paths](cv-query.md#how-the-information-is-stored)).
- **They come in order of time**, by their \`start\`; \`isNewestFirst: true\` in the section turns both orders around. **A project without a \`start\`** is other work of the employer that belongs to no period (その他の業務経験: 社内勉強会の運営): it comes last, has no period drawn and no number.
- **Every value drawn is a cell** whose text is, by default, the query of that value: the name of the employer above is the cell \`career:sample-systems:name\` saying \`{{work/sample-systems/jp/name}}\`. So it is typed in place, saved to the profile from its card, or given other words in one document, exactly as a cell of the top of a CV. **A period is one cell too**, saying the period token of its folder, \`{{period:work/sample-systems}}\` ([A period](cv-sheet.md#a-period)).

### What the profile keeps

\`\`\`yaml
# an employer: the data item at /example/info/work/sample-systems
start: { year: 2022, month: 4, jp: サンプルシステムズ株式会社 入社, note: { jp: 現在に至る } }
# end: { year: 2025, month: 3 }        absent: to the present (現在)
jp:
  name: サンプルシステムズ株式会社
  employment: 正社員
  fact:                          # the facts of the company: entries of its own, as many as it has
    business: { label: 事業内容, text: 業務システムの受託開発、クラウド導入支援 }
    capital: { label: 資本金, text: 1億円 }
    employee: { label: 従業員数, text: 300名 }
    w6c0x1k2ab: { label: 設立, text: 2001年 }     # one added from the sheet: its key means nothing
\`\`\`

\`\`\`yaml
# a project: the data item at /example/info/work/sample-systems/project/inventory
start: { year: 2023, month: 4 }
end: { year: 2024, month: 9 }
jp:
  title: 小売業向け在庫管理システムの機能追加
  summary:                                   # a list is several lines, each drawn as a line of a block
    - 既存の在庫管理システムに、店舗間の在庫移動と発注提案の機能を追加。
    - ・顧客との打ち合わせに同席し、要望を画面仕様にまとめた
    - ・新人2名のコードレビューと育成を担当
  env: [TypeScript / React, Node.js / MySQL]
  role: サブリーダー
  team: 8名
  phase: 要件定義〜リリース
  result: 発注作業にかかる時間を、店舗あたり週3時間削減。
\`\`\`

| value | drawn | |
| --- | --- | --- |
| \`start/year\`, \`start/month\`, \`end/year\`, \`end/month\` | the period, at the left: \`2023年4月\`, a short vertical line under it, \`2024年9月\` under that | no \`end\`: \`現在\` in its place. With the era above the years ([the switch of the document](cv-sheet.md#a-year-with-its-era)): \`令和5\` over \`2023\` |
| \`jp/name\`, \`jp/employment\` | the line of an employer: its name, and how the person was employed at its end | |
| \`jp/fact/{id}/label\`, \`jp/fact/{id}/text\` | the facts of the company, small, under its name: each its label, then what it says, in the order of the data | each drawn when it says something, unless the document leaves it out |
| \`jp/title\`, \`jp/summary\` | a project: its title, and what was done, drawn as the [lines of a block](cv-sheet.md#blocks) | |
| \`jp/env\`, \`role\`, \`team\`, \`phase\` | the facts beside a project: 環境, 役割, 規模, 工程, their labels in a column | each drawn when it says something |
| \`jp/result\` | under the text of a project: 実績・取り組み | drawn when it says something |

- **The start of an employer is the entry a CV lists.** \`start\` is a dated entry with a text (\`jp: … 入社\`), so \`work/jp\` of a CV draws it as a row of 職歴. The period of a project is dated too and holds no text, so it is no row there.
- **The facts of a company are the company's.** Nothing of the form names them: each is an entry below \`jp/fact\` of the employer, a label and what it says, and a company has those somebody gave it (事業内容 and 資本金 for one, 設立 and 拠点 for another). Its key (\`business\`, or one made by the sheet) only keeps the two together; the label is what is read. Both are values of the profile, so both are cells: \`career:sample-systems:fact/business:label\` says \`{{work/sample-systems/jp/fact/business/label}}\`. A document holds of them only which it leaves out.
- **The facts of a project are the section's.** A section names its own with \`projectFactList\`, each \`{ id, label, place }\`: the key of the value under the language, its label on the form, and where it stands, beside the text (\`side\`, the default) or under it (\`main\`). The head of the third column says the first labels of those beside (環境・役割・規模).
- \`lang\` (\`jp\`) is the language of the values; \`projectFolder\` (\`project\`) the folder of an employer's projects.

\`\`\`yaml
# a section with its own facts of a project
- id: career
  type: career
  title: 職務経歴
  list: work
  isNewestFirst: true
  projectFactList:
    - { id: env, label: 開発環境 }
    - { id: role, label: 役割 }
    - { id: result, label: 成果, place: main }
\`\`\`

### Editing it

While the sheet is edited ([Editing in place](cv-sheet.md#editing-in-place)):

\`\`\`text
a value        a click: the cell opens showing its query; its card holds the value in the profile, of
               one line or several (Save to the profile: for every document), or type words in the cell
               for this document only
a period       a click opens its cell; the card holds its four numbers in the profile (the year and the
               month of its start and of its end), each typed in place; an end emptied is 現在 again.
               Era above years (the bar) draws each year with its era above it
an empty fact  drawn with its label, to be typed (read, it is not drawn)
a fact of a company       its label and what it says are two cells, each typed as any value. With the
                          pointer on it, two buttons over its end: the eye leaves it out of this document
                          (More fields draws it again, or removes it), the bin takes it out of the
                          profile, for every document
+ 項目 at the end of a company's facts  a new entry of that company in the profile, its label and
                                       what it says to type
+ at the end of an employer's line     a new project of it, a data item of the profile in the partition
                                       of the document, starting at the date of the document, its title to type
+ in the head of the table             a new employer, the same way
the eye in the left margin             the employer or the project left out of this document
                                       (rowHiddenByGroup of the section: sample-systems,
                                       sample-systems/inventory, and for a fact
                                       sample-systems#business); the profile keeps it, and
                                       More fields draws it again
\`\`\`

A work experience usually differs from another one by **which projects it shows**, so leaving out is what a document holds of a career; what a project says is the profile's, shared.

## 最終学歴

Some work experiences ask for the last school, briefly. The part **最終学歴** (type \`education\`, among the parts a work experience offers: [Parts](cv-sheet.md#parts)) is a small table: its title across it, a row naming the columns, then one row:

\`\`\`text
                              最 終 学 歴
年 月        学 校 名                                 状 況     学 位
2022年3月   サンプル大学大学院 情報理工学系研究科     修了      修士（情報理工学）
\`\`\`

- **Which education**: the latest of the profile under \`edu\` (\`list\` of the section), by its end, else its start for one still going on (\`cvJpEducationLastGet\`, \`jp/CvJpData.js\`). A profile without any says so on its cells while the document is edited.
- **Its cells**: 年月 \`{{edu/{…}/end/year}}年{{edu/{…}/end/month}}月\`, the school \`{{edu/{…}/school/jp}}\`, the status \`{{edu/{…}/status}}\`, the degree \`{{edu/{…}/degree/jp}}\` ([An education](cv-query.md#an-education)); each a cell of the document (\`{id}:date\`, \`:school\`, \`:status\`, \`:degree\`), so a click on it changes the value in the profile from its card, the status from its common values (卒業, 卒業見込み, 修了, 修了見込み, 中退, 在学中, 単位取得満期退学), and a document may say any of them otherwise. The school is written with its faculty or graduate school (サンプル大学 理学部 物理学科, サンプル大学大学院 情報理工学系研究科). The title (\`最 終 学 歴\`) is a cell of the part (\`{id}:title\`), across the table.
- **Its options**: 学位 \`isDegree\` (On by default): the column of the degree ([The options of a part](cv-sheet.md#the-options-of-a-part)).
- On pages it is never cut.

## The look

It keeps the document of the CV (the same rules, greys and type), so that the two documents of one person read as a pair, and sets three things its own way: its titles are written without spaces and spaced by the form (\`職務要約\`, a long title and a short one set alike); its blocks are a little denser, being read rather than filled in by hand; and its years are written without their era unless the document asks for it.

**The career says its two levels by a frame, not by a darker tone.** It is a table of the period, what was done, and the facts beside it. The line of an employer runs across all of them, and its grey goes on as a narrow band down the left of its projects, with no rule between the two: the grey is a frame open to the right, and the rows standing in it are that employer's.

<!--renderComp=DiagramText-->
\`\`\`text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   a heavier rule
░░ 2022年4月  サンプルシステムズ株式会社   正社員 ░░   the employer
░░  〜現在    事業内容 …  資本金 …                ░░
░░┌─────────┬───────────────────────────┬──────────┐
░1│2022年5月│ 蔵書検索システムの新規開発│ 環境 Java│   a project,
░░│         │ 複数の図書館の蔵書を…     │ 役割 …   │   numbered
░░├─────────┼───────────────────────────┼──────────┤
░2│2023年4月│ 在庫管理システムの機能追加│ 環境 …   │
░░└─────────┴───────────────────────────┴──────────┘
\`\`\`

**A period stands upright**: its start, a short vertical line, its end, in the middle of its column. The two dates are set in the same fixed columns, the year, 年, the month, 月, in the line of an employer and in every row of a project, so every year of the table stands under the one above it (each with its era above it when the document asks for that) and the months end at one edge.

Four things say it together, none of them a dark fill: the frame; a heavier rule above each employer; the name and the period of the employer set heavier than a project's; and the projects numbered in the band, 1, 2, 3, among those this document draws. Cut by a page, the band of an employer goes on to the bottom of the page and down the projects of the next.
`;export{e as default};