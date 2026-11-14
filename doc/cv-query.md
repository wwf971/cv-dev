# Query paths

A **query path** names one piece of information of a profile: `name/jp/first`. It is a path, read like a folder path, in the order the information is written; where the profile says that some segments have no order, a query may give them in any order (`name/first/jp` too: [Order-free segments](#order-free-segments)).

```text
name/jp/first      name/first/jp                               one value: 太郎 (an unordered group {jp/first/})
name/jp/first/kanji                                            太郎
name/first/jp/hiragana                                         たろう
name/first/jp/katakana                                         タロウ    (derived from the hiragana)
name/jp/first/romaji/uppercase-all                             TARO
name/jp/first/romaji/uppercase-first                           Taro
name/jp/kanji                                                  山田 太郎 (joined from its parts)
birth/era      birth/age                                       平成12    26
first/name/jp                                                  nothing: name comes first
```

The grammar of the paths is react-doc's **asset paths** (react-doc: `main/doc_page_impl_obj_frontend_asset_path.md`), the same that indexes the data items of every frontend object; this package uses its utility (`@wwf971/react-doc/asset-path`) and adds what is the CV's own: the spellings, the default, the derived values.

## How the information is stored

A profile is a frontend object whose data items have the kind `info`, in partitions ([Partitions](README.md#partitions)). An item is a small yaml file holding the values of one subject; each value is a key path inside it, not an item of its own, since a value is too small to be versioned, locked and listed by itself:

```yaml
# the data item at /example/info/name
"{jp/last/}":  { kanji: 山田, hiragana: やまだ }
"{jp/first/}": { kanji: 太郎, hiragana: たろう, romaji: Taro }
"{en, last}": Yamada
"{en, first}": Taro
```

Every value (a **leaf**) has a **path pattern**: the path of its item after its partition and `/info`, then the keys leading to it, each key a pattern of its own. `太郎` has the pattern `name/{jp/first/}kanji`, and the keys `{jp/first/}`, `kanji` say where it is in the data. So storing and querying are two layers (react-doc: `main/doc_page_impl_obj_frontend_asset_path.md#two-layers-that-do-not-touch-where-an-item-lies-and-its-paths`): the key path is where the value is kept, the pattern is how it is found. How the data is cut into items changes nothing about the queries: an item `/info/name/jp` holding `{ first: 太郎 }`, or one item `/info/name` holding `{ jp: { first: 太郎 } }`, read the same.

- **A key is a piece of a pattern**: a plain key (`jp`) is one segment, `jp/first` two in that order, `{jp/first/}` two in any order with keys below them, `{en, first}` two in any order holding a value, `[addr, address]` either. As in every asset path, `/` ends a segment that something follows (below), so a key with keys below it may end going on; written the other way (`{jp, first}` above keys) it reads the same. A key with a `/`, `{`, `[` or `,` is quoted in yaml. A key that is no pattern (a `{` not closed, `{jp/first}` mixing the two forms) is read as one segment and reported.
- **An item's paths are patterns too**, all of them read: `/example/info/[address, addr]` is the item of `address/…` and `addr/…`.
- **A path names one value.** Two values whose patterns stand for the same path (`{p, q}` and a key `q` holding `p`) are a problem shown in the mode **Information**; the first in the order of the data keeps the path.

## Order-free segments

This is the one place where a path is not read in order, and it is local: **only the members of one unordered group `{…}` may come in any order**. Everything else keeps its place.

**How it is written.** In a pattern, `/` is not a separator but the end of a segment that something follows: `name/jp/last/kanji` is `name/`, `jp/`, `last/` and the last segment `kanji`. A group stands where segments stand, so the `/` goes after each of its members, inside the braces:

- **a group the path goes on after** has every member end with `/`, which also separates them: `name/{jp/last/}kanji`;
- **a group ending the path** has no `/` in its members, which are separated by commas: `name/{en, last}`.

Every member agrees, so whether a group ends the path is written in it rather than inferred from what follows; `{jp/last}`, half one and half the other, is refused, and so is a `/` after the brace (`{jp/last}/kanji`).

```text
pattern of a value              the queries reaching it
name/{jp/last/}kanji            name/jp/last/kanji   name/last/jp/kanji
name/{en, last}                 name/en/last         name/last/en
name/jp/last/kanji              name/jp/last/kanji   (nothing else)
{[jp/last/]kanji/}x             jp/last/kanji/x      kanji/jp/last/x      (a member of two segments, kept together)
a/b/{c/d/}{e, f}                a/b/c/d/e/f  a/b/c/d/f/e  a/b/d/c/e/f  a/b/d/c/f/e   (two groups, each on its own)
```

**Why locality.** A profile is a tree: a name has languages, a language has parts, a part has scripts. Some levels of it describe one thing by two independent properties, where neither is inside the other: the *Japanese last* name is as much the *last Japanese* one. There the order is arbitrary, and the author says so with a group. Elsewhere order is meaning: `name` is first because every query of a name starts there, `kanji` is last because it is a script of what comes before it, and `kanji/name` means nothing. A whole query read as a set of words would let words of different levels mix (a word that belongs below another matching above it), make two values indistinguishable by where a word is, and leave completion nothing to say about what comes next. So order-free is a property of a place in a path, declared once by the author of the data, never a property of the query.

**How to write it.** Group exactly the segments that are independent properties of one level, usually two or three, and keep in the group's written order the canonical path, the one shown and recorded (`name/jp/last/kanji` for `name/{jp/last/}kanji`). Nest a fixed run inside a group as a choice of one (`{[jp/last/]x/}y` keeps `jp/last` together). In the data, a key with keys below it is a group going on (`"{jp/last/}"`), a key holding a value a group ending the path (`"{en, last}"`). Several groups in one path are independent. A group has at most 6 members; a profile wanting more is a set of tags, better kept as values of their own.

**What follows from it.** The default of a folder and completion work in every order a group allows (`name/last/` lists `jp` and `en`); a value added at a path in another order goes into the group's mapping (`name/last/jp/katakana` is written under `"{jp/last/}"`), never a second copy beside it; the derived scripts stand in the place of the script they derive from, so `katakana` is read where `hiragana` is.

## How a query answers

A query is a concrete path, no group or choice in it, then **modifiers** at its end (formats, a derivation: below). Segments are compared through the spellings below, case aside.

```text
1. the leaf at exactly that path
2. a name asked for as a whole (no first, no last in the query): its last and first parts joined,
   each found by putting last / first into the query at the latest place where both are found
   (name/jp/kanji reads name/jp/last/kanji); an English name first then last, otherwise last then first
3. the first leaf below that path, in the order of the data
4. a script no leaf holds, derived from another one at the same place of the path (below)
5. nothing: missing, with the reason
```

Rule 3 is how an author chooses a default: `name/jp/first` is the kanji because `kanji` is written first. The other leaves below the path are reported as `alternativeList`, shown when trying a query in the mode **Information**.

## Derived values and formats

| word | gives | from |
| --- | --- | --- |
| `uppercase-all`, `uppercase-first`, `lowercase-all` | the value in that case; at the end of a query, any number | any value |
| `era` | the Japanese era of a year (`平成10`, `令和元`); at the end of a query | `year` and `month` below the path |
| `age` | the age at the date the CV is written; at the end of a query | `year`, `month`, `day` below the path |
| `katakana`, `hiragana` | that script, when not stored; in the place of a script | the other kana |
| `romaji` | Hepburn romaji, when not stored; in the place of a script | kana |

A stored value always wins over a derived one, so a name with an unusual reading is written once by hand. A format before the end of a query is a segment like any other (and matches nothing): `name/jp/first/romaji/uppercase-all`, not `uppercase-all/name/…`.

**Spellings.** Several spellings are one segment: `ja`, `japanese` = `jp`; `english` = `en`; `family`, `surname` = `last`; `given` = `first`; `furigana`, `kana` = `hiragana`; `upper` = `uppercase-all`, `lower` = `lowercase-all`, `capitalize` = `uppercase-first`. Case does not matter. Spellings are a vocabulary of the package, in the data and in a query alike, not alternatives of a pattern: a choice `[jp, ja]` would make each spelling a path of its own.

## Dated entries

A mapping with a `year` is an **entry**: a row of a history. Its other keys are its text, by language, and its `note`:

```yaml
# /example/info/edu/bachelor
start: { year: 2016, month: 4, jp: サンプル大学 入学, en: Entered Sample University }
end:
  year: 2020
  month: 3
  jp: [サンプル大学 卒業, "  学士 取得"]    # a list is several lines
  note: { jp: 備考の文 }
```

A query for a list, `edu/jp`, answers every entry whose path it starts along, in order of time (`cvEntryListResolve`): it runs along `edu/bachelor/start` as far as it can (`edu`), and what is left (`jp`) chooses the text inside each entry, a key path of the entry starting so. An entry holding nothing chosen is left out (`work/en` lists the entries with an English text or note); a note in no language (`note: 現在に至る`) is the note of every language. `edu/bachelor/jp` lists the two entries of the bachelor, `edu/bachelor/start/jp` one. The parts of an entry stay ordinary leaves too: `edu/bachelor/start/year`, `edu/bachelor/start/era`.

## In a text

A text of a CV's cell is words, with queries in double braces wherever wanted. A text without braces is hard-coded, so both are one mechanism:

```text
{{name/jp/first/kanji}}
{{birth/month}}月{{birth/day}}日
東京都千代田区
```

A query in braces is the CV's kind of **token** in react-doc's cell edit layer, beside the kinds every cell has, a link and a view of an object ([The cells](cv-jp.md#the-cells)); a brace token starting with a sigil (`{{@…}}`) is one of those and not a query.

While a cell is edited, the query at the caret completes once `{{` is typed (or `/query`): the segments that can follow what is typed (in every order a group allows), with how many values lie below each, and the values themselves, each with the query reaching it the way it was typed.

## From outside a CV

A CV reads the profile it names, in its own partition. Anything else of the page names a value of a profile by a **reference**: the profile, `#`, the partition and the query.

```text
frontend:w5pbeilkczg#example/name/jp/first        the value 太郎, drawn as that text in a line
```

This is react-doc's convention for naming something inside a frontend object (react-doc: `main/doc_page_impl_obj_frontend.md#things-inside-an-object-inner-paths`), with one difference from most objects: what is inside a profile is its **values**, not its data items, since a value is what a reader looks for and how the data is cut into items is nobody else's business. So the profile says what an inner path is itself: its mode Information exposes `objectInner` (`cv-comp.js`), two functions of `query/CvProfile.js`:

```text
cvProfileInnerResolve(profile, 'example/name/jp/first')   what the path names: found, its text; else why not
cvProfileInnerComplete(profile, 'example/name/')          the candidates: the partitions holding information,
                                                          then what /query lists in the partition typed
```

With them, `/object` in any paragraph or cell walks Profile → the profile → `example/` → `name/` → `jp/` … and writes the reference, and the reference is drawn wherever it stands. A profile whose items have no partition is walked from the query directly.

## The mode Information

The mode **Information** (`CvProfileInfo`) of a profile is one panel showing a partition of it, never taller than it is told to be. Its values are shown in one of two views:

```text
[ Information 57 ][ Badges 12 ]                       Partition [ Playground ] kept out of git
[+ Add a value]  View [ Explorer | Tree ]  [ find a value, or try a query                    ]
[↑]  ⌂ › name                                                                        8 values
▭ ( ⇄ jp | last )   3   山田 · やまだ · Yamada                                              ›
▭ ( ⇄ jp | first )  3   太郎 · たろう · Taro                                                ›
  ( ⇄ en | last )       Yamada                                                 [copy][bin]
  ( ⇄ en | first )      Taro                                                   [copy][bin]
```

### The explorer

The **explorer** (the default) walks the values as a file explorer walks folders: a **path bar**, and under it what lies next to the path walked. A click on a folder goes into it; a value is read where it lies. The bar goes back: up a level, to the top, to any folder on the way.

What lies next is read off the path patterns, not off the canonical paths, so **segments that come in any order are one item**, as they are written: the unordered group `{jp/last/}` is one item holding `jp` and `last`, and each of them is a way forward.

```text
at name                                   jp of the first item          last of the first item
  ( ⇄ jp | last )   3                      ⌂ › name › jp                 ⌂ › name › last
  ( ⇄ jp | first )  3                        ▭ last    3                   ▭ jp   3
  ( ⇄ en | last )      Yamada                ▭ first   3                     en      Yamada
  ( ⇄ en | first )     Taro
```

- **A member chosen is walked first**, and what was the group is then a plain step: after `last`, the item is `jp`. The path bar says the order the reader took, which is one of the orders a query may have (`name/last/jp/kanji`).
- **The row of a group** (anywhere but on a member) goes past all of it, its members in the order written: `name/jp/last`.
- **A group ending its path** (`{en, last}`) is an item holding the value itself, shown and changed there; its members still lead on (`en`: to `name/en`, where `last` is the value).
- **A choice** (`[address, addr]`, other names of one thing) is walked by its first name.

### The tree

The **tree** draws every level under the one above it, by the canonical paths: `name/jp/last/kanji` is under `name`, `jp`, `last`. A click opens a folder, a level at a time; a closed folder says its first values and how many it holds. A tree has one order, so a level that comes in any order with another one is **marked ⇄** (its tooltip names the other): `jp` and `last` are two levels here and one step of a path.

### In both

- **Its height is limited.** The list scrolls inside the panel past `param.heightMax` pixels (360). The explorer is as tall as its top level needs, whatever folder it shows, so walking moves nothing below it.
- **The order is the order of the data**, since the first value below a path is what a query of that path answers with.
- **It stays where it was.** The tab, the view, the path walked, the folders opened, the words typed and how far the list is scrolled are the block's, not the mount's (react-doc: `main/doc_page_impl_mdx_comp_state.md#stores-kept-across-mounts`): the document entering or leaving edit mode mounts the panel again, and it is found as it was left.
- **One field finds and tries.** Words typed leave the values whose path or text holds them all, **each word marked where a row says it** (in a name, a path, a value, also one that can be edited; `cv-profile-highlight.js`, ranges given to the browser's highlight registry, so no row is drawn differently for it). `/` parts words as a space does, so a query finds what it names in whatever order its segments are. The tree keeps their folders, open; the explorer lists them with the folder each lies in, a click on which goes there. A query that reads something also says what a CV would get and how (`{{name/first/jp/katakana}} reads タロウ · written in another script of the value stored`), and the values it reads from stay listed.
- **A row is where a value is changed**, while the document is edited: its text in place, **Copy** (the `{{query}}` a CV writes), **Replace…** for an image, a remove button. They show when the row is pointed at. The tooltip of a value's name is its path pattern.
- **Up and Down go from a value being edited to the one above or below**, as in a sheet of cells, and the value left is saved when it was changed (Enter saves too, Esc puts it back). In a value of several lines the arrows first move inside it, and leave from its first or last line. The names of the badges are walked the same way.
- **A value is added where it will be.** **Add a value** at the top of the panel adds where the explorer is (in the tree: at the top level, and the **+** of a folder adds inside it). It opens a row at that place, the first of its folder: its name (one segment, or several, `jp/floor`), then its value; Enter goes on and adds, Esc gives up. It goes to the place its path names: below the deepest mapping or item a start of the path names, the rest of the path becoming keys; else a new item named by its first segment. A path that already holds a value is refused, since its own row changes it.
- **The second tab is the badges** of the partition ([Badges](cv-badge.md#in-the-profile)).

```yaml
# in a document: the block of the profile, its mode Information
param:
  partition: playground    # the partition shown first
  heightMax: 480           # px; the list scrolls past it
  view: tree               # the view shown first: explorer (the default) | tree
```

## Who writes it

Everything goes through the object's api: the mode Information above changes, removes and adds values. The Japanese-style CV can write a value of the profile from its cell. Agents use the standard apis (react-doc: `main/doc_page_impl_obj_frontend.md#in-the-object-registry`).

## Files

```text
comp-mdx/query/CvQuery.js        the information of a profile (leaves, mappings, entries, the index), queries, completion,
                                 entries, where a value goes
comp-mdx/query/CvProfile.js      a profile read through its object's api, partitions; a profile from outside: what an
                                 inner path names and completes
comp-mdx/query/CvText.js         scripts, eras, ages
comp-mdx/query/CvInfoExplore.js  the values walked: what lies next to a path, a group one item; what words find; pure
comp-mdx/query/CvInfoTree.js     the values as a tree: folders by shared paths, levels in any order, the rows drawn; pure
comp-mdx/query/CvQuery.test.js, CvInfoExplore.test.js, CvInfoTree.test.js   npm test; test/react-doc-resolve.js finds
                                 react-doc's asset-path for node
comp-mdx/profile/CvProfileInfo.jsx     the mode Information: its panel, tabs, tools, the choice of a view
comp-mdx/profile/CvProfileExplore.jsx  the explorer: its path bar, its items, a group with its members
comp-mdx/profile/CvProfileTree.jsx     the tree: its folders, the mark of a level in any order
comp-mdx/profile/CvProfileRow.jsx      the rows both views share: a value, a value being added; the arrows between values
comp-mdx/profile/cv-profile-highlight.js  the words found, marked in the rows
comp-mdx/profile/CvProfileBadgeList.jsx  the tab of the badges
comp-mdx/profile/CvProfileStore.js     what the panel shows and its writes into the profile
comp-mdx/profile/CvProfile.css
```
