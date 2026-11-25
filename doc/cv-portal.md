# The portals: the archive of a person's papers

The papers of a person are a small archive: CVs and work experiences, the templates they are made of, and the profile they read. In a document they are blocks among text. As a **portal** (react-doc: `main/doc_page_impl_portal.md`) they are an app of their own in the whole window, opened from the control at the top left of the page.

The package has **two portals over one state**: the same archive, in two looks.

```text
                         comp-mdx/portal/archive/        what both draw: no look in it
                           CvArchiveModel.js              the archive as places (pure)
                           CvArchiveStore.js              where the reader is, what is found, the paper being made, the folders
                                  ▲                 ▲
              ┌───────────────────┘                 └───────────────────┐
   comp-mdx/portal/desk/                                    comp-mdx/portal/room/
     Desk: a desktop app in Material UI                       Archive room: a room of file cabinets in 3D
     cabinets and drawers at the left,                        walked with the keyboard and the mouse,
     a paper on its sheet at the right                        a folder taken out is its paper
```

Both are provided by a **papers object** (type `cv.jp`, `portalList` in `type.yaml`), so every papers object has them; an object leaves one out or names it differently in the `portal.yaml` of its folder.

## The archive

What the portals show is said once, in words no look owns (`CvArchiveModel.js`), level by level:

| level | what it is | in the data | path | in the room |
| --- | --- | --- | --- | --- |
| **archive** | everything a papers object keeps | the object | `/` | the room |
| **cabinet** | where the data comes from, who sees it | a partition ([Partitions](README.md#partitions)) | `/example` | a file cabinet, its sign above it |
| **drawer** | one sort of thing kept | a kind of data item | `/example/cv` | a drawer of that cabinet |
| **folder** | papers the reader keeps together ([Folders](#folders)) | the item *arrange* of the partition | `/example/cv/folder:{id}` | a darker, thicker hanging folder |
| **file** | one thing | a data item | `/example/cv/general` | a hanging folder, its name on its tab |

- **A path of the archive is the path of the data item** it names, the object's own asset path: a place seen in a portal is the place a block of a document names (`instance: /example/cv/general`), and the address of the portal holds it as it is.
- **The drawers are declared** (`CV_ARCHIVE_DRAWER_LIST`): CVs (履歴書), work experiences (職務経歴書), templates (様式), and the **profile** (個人情報), whose files are the subjects of the profile the papers read (`name`, `birth`, `edu`, …), with how many values each holds. A further sort of paper is one more entry there. Every cabinet has every drawer, also while it is empty: a cabinet looks the same wherever it stands, and a new paper has its place.
- **What the archive keeps no drawer for is left out** (the view of the table of papers, a part template), and a paper filed under no partition lies in a cabinet of its own.
- **It is pure**: handed what the objects say (their items, the data of those read so far, the folders of each partition), it answers places, counts, the way down to a place, a search by words, the path a new paper would lie at, and what a filing makes of the folders. `CvArchiveModel.test.js` reads it without a page.

## Folders

A drawer can hold **folders**, and a folder more folders and papers: the reader's own filing, kept in the order things are put in.

- **Where it is kept.** One data item a partition, of the kind **arrange** (`type.yaml`), at `/{partition}/arrange/archive`, made the first time something of that partition is filed. It says which folders each drawer holds (an id, a name, its drawer, the folder it lies in), where each paper lies, by the key of its item, and a **rank** for everything:

  ```yaml
  folderList:
    - { id: mwwb0spn0k, name: Applied, drawer: cv, rank: "7" }
    - { id: mwwc2a41q7, name: Shortlist, drawer: cv, parent: mwwb0spn0k, rank: i }
  placeByKey:
    cv-1: { folder: mwwb0spn0k, rank: c }
    instance-2: { rank: l }
  ```

- **A paper is not changed by being filed.** It keeps its item and its path, so a block naming `/example/cv/general` still names it wherever it is filed, and the mode *Papers* of a document lists it as before. A folder is named by its id (`/example/cv/folder:{id}` in the address), so renaming it moves nothing.
- **The order is by rank** (LexoRank: react-doc's `lib/doc-rank.js`, `main/doc_page_impl_config.md#ranks`, imported as `@wwf971/react-doc/rank`). A thing put between two others gets a rank between theirs and nothing else is written; while the place has things without a rank (nothing ordered yet), every thing of it is ranked anew in the order shown. The unranked come after the ranked, folders first, then papers in the order of the object.
- **Within a partition and a drawer.** A folder holds papers of its drawer only, a folder never lies in itself, and nothing is moved to another partition: a partition keeps its own filing, so data kept out of git is never named in a tracked one. What cannot be put somewhere is not offered there while dragging.
- **A folder taken away** leaves what it holds where it stood, in its order; nothing of a paper is removed. A paper whose item is gone is dropped from the filing the next time it is written.
- **The store writes it** (`folderCreate`, `folderRename`, `folderRemove`, `move` of `CvArchiveStore`): what is written is shown at once, and stays shown until the write is answered; a write that fails says why and the filing shows what the item says. Filing is offered wherever the page writes (`isWritable`), with or without the switch Edit (which changes what the papers say), as **New paper** is.

In the desk:

- **New folder** in a drawer or a folder makes one first there, its name typed in place (the grey *New folder* is kept when none is typed).
- **Dragging a row** puts it elsewhere in the list (a line between rows), into a folder when it is dropped on the middle of the folder's row (the row is outlined), or into a drawer or folder of the left or a step of the path above when dropped there (outlined while it would take it). Rows are the shared table of react-comp-misc, whose drop onto a row is `config.rowDropIntoCheck` and the event `rowDropInto`.
- **A right click on a row** (or `⋯` beside a folder's name): Open, Rename, Move out of the folder, Delete folder.
- **New** inside a folder files the new paper there.
- The left lists the folders of each drawer under it; a file's row says its cabinet, its drawer and its folders; finding a file finds it by the names of its folders too.

In the room, the folders hang in their drawers in their order, of kraft board with a dark tab saying how many papers they hold. Taking one out lists what it holds beside the room; a paper of it is laid there as any other, the folder still lifted, and `Esc` puts back the paper, then the folder.

## The state

One class holds the state of a portal of the archive, `CvArchiveStore`, and each look holds an instance of it:

| the truth of | is |
| --- | --- |
| what the archive holds | the objects (the papers object providing the portal, the profile it names in `metadata.profile`), read through their apis |
| where the reader is | the address of the portal (`config.portal.at`): `path`. `go(path)` writes it there, so a place is a link and Back is the browser's |
| whether things are changed | the portal's own edit mode (`config.portal.isEditing`) |
| how the papers are filed | the item *arrange* of each partition ([Folders](#folders)), written by the store |
| the words finding a file, the paper being named, the folder named in place, what is dragged | the store |

A look keeps only what it adds: the desk the widths of its columns, the room where the reader stands and what the pointer is on (`CvRoomStore.js`). So a third look is a third folder beside the two, with no state to restate.

**A paper is drawn by the mode that draws it in a document**: both portals lay the mode *sheet* of the papers object beside their own chrome (react-doc's `ObjectFrontendMode`), and the profile's mode *Information* for a subject of the profile. With **Edit** on, the sheet has its own Edit, a cell is typed in place, a token has its card, a value keeps its versions ([Query paths](cv-query.md#versions-of-a-value)): nothing of that is rebuilt for a portal.

## The desk

The portal **Desk** (`comp-mdx/portal/desk/`) is the archive as a desktop app in Material UI, in the look of the desktop apps built on react-doc (db-migration-tool): the neutral colors of the page, dense controls of one height, thin outlines (`cv-desk-theme.js`; light and dark follow the page's own switch).

```text
┌ [▣ Desk ⌃⌄] │ Papers · 7 files   [⌕ find a file      ]          [Edit] [+ New paper] [Documents] ┐
├──────────────┬────────────────────────────────────────────────────────────────────────────────────┤
│ Archive    7 │ Archive › Example › CVs                                                             │
│ CABINETS     │                                                                                     │
│ ▸ Example  7 │ the place: cards of the cabinets or of the drawers of one, the table of the files  │
│    CVs     2 │ of a drawer, a paper on its sheet, the profile at its values, a template by its    │
│    Work …  1 │ facts and the papers made of it                                                     │
│    Templa… 2 │                                                                                     │
│    Profile 9 │                                                                                     │
└──────────────┴────────────────────────────────────────────────────────────────────────────────────┘
```

- **A click enters**: a cabinet, a drawer, a folder, a file; the way down to the place is at the top, every step a click away. A drawer or a folder is filed by dragging ([Folders](#folders)).
- **The table of files** is the shared table of react-comp-misc (`FolderView`), in the look of the desk: its columns resized, a click on a row entering the file.
- **Find a file** lists the files whose name, path, drawer or cabinet hold every word typed.
- **New paper** asks only what the place does not say: its form, its name (the name used when none is typed is shown in grey), its cabinet when there are several; it says where the paper goes and whether git keeps it, makes it, and opens it.

## The archive room

The portal **Archive room** (`comp-mdx/portal/room/`) is the archive as a room one walks in, drawn with three.js: a file cabinet at the back wall for every cabinet, each with a drawer for every sort of paper, the folders of a drawer hanging in it with their names on their tabs.

| | |
| --- | --- |
| walk | `W` `A` `S` `D` or the arrows (← → turn); the wheel steps forward and back |
| look | drag with the mouse |
| act | a click on a cabinet, a drawer or a folder (`Enter` or `E`: on what the pointer is on, else on what is in the middle of the view) |
| back | `Esc` or `Backspace`: the folder back, the drawer shut, the cabinet left |

- **The place of the address is the state of the furniture.** `/example` : the reader stands at that cabinet; `/example/cv`: that drawer is out and the reader bends over it; `/example/cv/general`: that folder is lifted, and its paper lies beside the room on its sheet. Acting on the furniture writes the address; an address opened (a link, Back) walks the reader there.
- **The room is the archive given a body** by one pure module (`CvRoomLayout.js`): where each cabinet, drawer and folder stands, in meters, and where a reader stands to look at a place. The scene (`CvRoomScene.js`) builds meshes from that layout and knows nothing else of the archive; `CvRoomLayout.test.js` reads the geometry without a canvas.
- **Words stay words**: the way down to the place is at the top of the room, every step a click away, and what the pointer is on is said beside it; a window that cannot draw 3D (no WebGL) lists the places instead.
- A drawer shows as many folders as have room in it (15); the rest are in the archive, and the desk lists them.
- **What a frame costs** is little (measured on an Apple M4: 7.6 ms of GPU for the whole room with its shadows at 3840 x 2160 pixels; React draws nothing while the reader moves). What makes a room stutter is elsewhere, and is avoided: a frame is drawn only when something changed; the wheel asks for a walk that is made over the next frames (a notch of a mouse wheel is a glide, not a jump); the canvas keeps one density (a change of its size reallocates its buffers and drops a frame), lowered once only when frames keep coming slowly; every shader is compiled when the furniture is built, not at the first sight of a drawer's contents. The line of keys names what draws the room, and says so when the browser draws it without the GPU (graphics acceleration off, a remote desktop, no driver: `chrome://gpu` says *WebGL: Software only*). The CPU then draws it (SwiftShader, some 45 ms a frame at 1920 x 1080), so the room is drawn plainly: no antialiasing and no shadows (17 ms a frame), and a density down to 0.5.

## Files

```text
comp-mdx/portal/
├── comp.yaml, cv-portal-comp.js    the two components, each exposing "portal", with their icons
├── archive/                         what the portals share
│   ├── CvArchiveModel.js, .test.js    the archive as places: levels, drawers, folders, files, search, a new paper's path,
│   │                                  the folders and their ranks as written (arrange)
│   └── CvArchiveStore.js              the state of a portal of the archive, the writes of the folders; useCvArchive(config)
├── desk/                            the portal Desk
│   ├── CvPortalDesk.jsx, .css         the bar, the cabinets, the place shown, the table of files, folders and dragging, a new paper
│   └── cv-desk-theme.js               the Material UI theme, light and dark
└── room/                            the portal Archive room
    ├── CvRoomLayout.js, .test.js      the geometry: what stands where, where a reader stands for a place
    ├── CvRoomScene.js                 three.js: the meshes of a layout, the drawer out, the folder lifted, picking
    ├── CvRoomStore.js                 what the room keeps of its own
    └── CvPortalRoom.jsx, .css         walking and looking, acting, the words over the room, the paper or folder taken out
```

The portals need Material UI and three.js: `npm install` in the folder of the package (`package.json`; `.npmrc` keeps react and react-dom the page's own). `script-build/pages-deploy.sh` installs them before it builds.
