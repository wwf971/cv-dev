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

While a cell is edited, the query at the caret completes: the segments that can follow what is typed (in every order a group allows), with how many values lie below each, and the values themselves, each with the query reaching it the way it was typed.

## Who writes it

Everything goes through the object's api: the mode **Information** (`CvProfileInfo`) shows every value with its pattern, edits a value in place, removes one, and adds one at the place a path names (the value at that path; else below the deepest mapping or item a start of the path names, the rest of the path becoming keys; else a new item named by its first segment). The Japanese-style CV can write a value of the profile from its cell. Agents use the standard apis (react-doc: `main/doc_page_impl_obj_frontend.md#in-the-object-registry`).

## Files

```text
comp-mdx/query/CvQuery.js        the information of a profile (leaves, mappings, entries, the index), queries, completion,
                                 entries, where a value goes
comp-mdx/query/CvProfile.js      a profile read through its object's api, partitions
comp-mdx/query/CvText.js         scripts, eras, ages
comp-mdx/query/CvQuery.test.js   npm test; test/react-doc-resolve.js finds react-doc's asset-path for node
```
