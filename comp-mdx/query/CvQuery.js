import {
	assetPathConcat, assetPathChoice, assetPathExpand, assetPathIndexBelowList, assetPathIndexBuild, assetPathIndexGet, assetPathIndexNodeGet,
	assetPathIndexPathOfEntryGet, assetPathJoin, assetPathMatch, assetPathParse, assetPathPrefixStrip, assetPathText,
} from '@wwf971/react-doc/asset-path';
import { cvAgeGet, cvHiraganaToKatakana, cvKanaToRomaji, cvKatakanaToHiragana, cvUppercaseFirst, cvYearEraGet } from './CvText.js';

// The information of a profile, and the query paths that read it (doc/cv-query.md).
//
// Every value of a profile (a leaf) has a path pattern, in the grammar of react-doc's asset paths
// (react-doc: main/doc_page_impl_obj_frontend_asset_path.md): the path of its data item after
// the partition and /info, then the keys leading to it in the data, each key a pattern of its own.
// So the order is the order of the data, except where a pattern says otherwise:
//
//   /info/name   { "{jp/last/}": { kanji: 山田 }, "{en, last}": Yamada }
//   -> the leaf name/{jp/last/}kanji, value 山田: read by name/jp/last/kanji and name/last/jp/kanji
//   -> the leaf name/{en, last}, value Yamada: read by name/en/last and name/last/en
// ("/" ends a segment that something follows: a key with keys below it goes on, {jp/last/}; a
// key holding a value ends the path, {en, last}. either is read either way)
//
// A query is a concrete path, then modifiers (uppercase-all, era, ...). It answers with the leaf
// at its path, or else the first leaf below it in the order of the data, which is how an author
// says what the default is. A word that no leaf holds may be derived: another script (katakana
// from hiragana, in place), the era or age of a date, a name joined from its parts.
//
// A value may be kept with versions (doc/cv-query.md#versions-of-a-value): one of them is its
// head, which a query reads; "@" and a version at the end of a query reads that version
// whatever the head is (pr/jp@2). A value written plainly is its version 1.

// other spellings of a segment, in the data and in a query: a vocabulary, not a pattern. a word
// a profile is likely to use as a key of its own is no spelling of anything: "title" is the title
// of a project, never a format
const CV_SEGMENT_ALIAS = {
	ja: 'jp', japanese: 'jp', english: 'en',
	family: 'last', surname: 'last', given: 'first',
	furigana: 'hiragana', kana: 'hiragana', ふりがな: 'hiragana', フリガナ: 'katakana',
	romanji: 'romaji', romnaji: 'romaji', roman: 'romaji', katanaka: 'katakana',
	upper: 'uppercase-all', uppercase: 'uppercase-all', capitalize: 'uppercase-first',
	lower: 'lowercase-all', lowercase: 'lowercase-all',
};

export const CV_FORMAT_LIST = ['uppercase-all', 'uppercase-first', 'lowercase-all'];
export const CV_DERIVE_LIST = ['era', 'age'];
const CV_SCRIPT_SOURCE_BY_SCRIPT = {
	katakana: [{ segment: 'hiragana', convert: cvHiraganaToKatakana }],
	hiragana: [{ segment: 'katakana', convert: cvKatakanaToHiragana }],
	romaji: [{ segment: 'hiragana', convert: cvKanaToRomaji }, { segment: 'katakana', convert: cvKanaToRomaji }],
};
// keys of a dated entry that are not its text
const CV_ENTRY_KEY_LIST = ['year', 'month', 'day', 'note'];
// the folder of a profile's data items after the partition: /info/...
export const CV_INFO_FOLDER = 'info';

export function cvSegmentNormalize(segment) {
	const text = String(segment ?? '').trim().toLowerCase();
	return CV_SEGMENT_ALIAS[text] ?? text;
}

function mappingIs(value) {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function scalarIs(value) {
	return value !== null && value !== undefined && typeof value !== 'object';
}

// what a leaf holds: a plain value, or a list of them (several lines)
function leafRawIs(value) {
	return scalarIs(value) || (Array.isArray(value) && value.every(scalarIs));
}

// ---------- a value kept with versions ----------
//
// In the data a value is written plainly (kanji: 太郎), or, once it has more than one version,
// as a mapping holding them under one reserved key:
//
//   kanji:
//     $version:
//       head: 2                       the version a query reads when it names none
//       versionList:
//         - { id: 1, value: 太郎, time: 20261120_21041000+09 }
//         - { id: 2, value: 太朗, time: 20261125_10123300+09, note: the registered spelling }
//
// The key starts with "$", which no segment of a path does, so it is never a level of a path.
// A version's id is a number given in order, never used again; a plain value is the short form
// of one version, id 1, which is its head.
export const CV_VERSION_KEY = '$version';
// the word naming the head where a version is named: name/jp/first@head is name/jp/first
export const CV_VERSION_HEAD = 'head';
// what parts a query from the version it names
export const CV_VERSION_MARK = '@';

export function cvVersionedIs(value) {
	return mappingIs(value) && mappingIs(value[CV_VERSION_KEY]) && Array.isArray(value[CV_VERSION_KEY].versionList);
}

// the versions of a value as the data says them: { head, versionList: [{ id, raw, time, note }] }.
// read defensively: an entry without a whole id or a value is left out, an id met twice keeps
// its first, a head naming no version is the last one. none left: undefined
function versionedRead(value) {
	const idSet = new Set();
	const versionList = [];
	for (const one of value[CV_VERSION_KEY].versionList) {
		const id = Number(one?.id);
		if (!mappingIs(one) || !Number.isInteger(id) || id < 1 || idSet.has(id) || !leafRawIs(one.value)) continue;
		idSet.add(id);
		versionList.push({ id, raw: one.value, time: typeof one.time === 'string' ? one.time : '', note: typeof one.note === 'string' ? one.note : '' });
	}
	if (versionList.length === 0) return undefined;
	const head = Number(value[CV_VERSION_KEY].head);
	return { head: idSet.has(head) ? head : versionList[versionList.length - 1].id, versionList };
}

// a plain value, or the head of one kept with versions: what a reader of the data that knows
// no versions is handed (the year of a dated entry)
export function cvValueHeadGet(value) {
	if (!cvVersionedIs(value)) return value;
	const versioned = versionedRead(value);
	return versioned?.versionList.find((one) => one.id === versioned.head)?.raw;
}

function leafTextOf(raw) {
	return Array.isArray(raw) ? raw.join('\n') : String(raw);
}

// the versions of a leaf, oldest first: [{ id, value, isList, time, note, isHead }]. a leaf
// written plainly has one, id 1, its head
export function cvLeafVersionListGet(leaf) {
	if (!leaf) return [];
	if (!leaf.version) return [{ id: 1, value: leaf.value, isList: leaf.isList === true, time: '', note: '', isHead: true }];
	return leaf.version.versionList.map((one) => ({ ...one, isHead: one.id === leaf.version.head }));
}

// the id of the head of a leaf
export function cvLeafHeadIdGet(leaf) {
	return leaf?.version?.head ?? 1;
}

// the pattern of a key of the data, a piece of a path: "jp", "{jp/last/}" (keys below it),
// "{en, last}" (a value), "[en, english]". a key that is no pattern (a "{" not closed, "{jp/last}")
// is the key as it is, one segment, and reported
function keyNodeGet(key, problemList, place) {
	const { node, message } = assetPathParse(String(key), { isFragment: true });
	if (!message && node) return node;
	problemList.push(`${place}: the key ${JSON.stringify(key)} is read as one segment (${message})`);
	return { kind: 'sequence', elementList: [{ kind: 'segment', name: String(key).trim() }] };
}

// the pattern of a data item from its paths in its partition (/info/name, /info/[addr, address]):
// the paths without /info, as a choice when several. undefined when none starts with /info
function itemNodeGet(source, problemList) {
	const pathList = source.pathList ?? (source.path ? [source.path] : []);
	const nodeList = [];
	for (const path of pathList) {
		const { node, message } = assetPathParse(path);
		const stripped = node ? assetPathPrefixStrip(node, [CV_INFO_FOLDER]) : undefined;
		if (message) problemList.push(`${path}: ${message}`);
		else if (!stripped) problemList.push(`${path}: the path of an item of information starts with /${CV_INFO_FOLDER} as a plain folder`);
		else nodeList.push(stripped);
	}
	return assetPathChoice(nodeList);
}

// the information of a profile from its data items, each { key, pathList, data } (pathList: its
// paths in its partition, /info/name; query/CvProfile.js takes the partition off). virtual:
// values no item holds, { date: { ... } }, which can be read and not written.
//   leafList     every value: { node, pathText, path, value, assetKey, keyPath, keyNodeList, isList, version? }
//                value: what its head says; version: { head, versionList: [{ id, value, isList, time, note }] }
//                of a value kept with versions (cvLeafVersionListGet reads either)
//   mappingList  every mapping and item, where a new value may go: { node, assetKey, keyPath }
//   entryList    every dated entry (a mapping with a year): { node, value, assetKey, keyPath, pathList }
//   index        the leaves by their paths (asset path index), problemList
export function cvInfoBuild(sourceList, virtual = {}) {
	const leafList = [];
	const mappingList = [];
	const entryList = [];
	const problemList = [];
	const walk = (value, node, keyPath, keyNodeList, source) => {
		if (leafRawIs(value)) {
			const isList = Array.isArray(value);
			leafList.push({ node, pathText: assetPathText(node), value: leafTextOf(value), assetKey: source.key, keyPath, keyNodeList, isList });
			return;
		}
		// a value kept with versions: one leaf, what its head says, its versions beside it
		if (cvVersionedIs(value)) {
			const versioned = versionedRead(value);
			if (!versioned) {
				problemList.push(`${source.label ?? source.key}: ${assetPathText(node)} is kept with versions, and none of them can be read`);
				return;
			}
			const versionList = versioned.versionList.map((one) => ({ id: one.id, value: leafTextOf(one.raw), isList: Array.isArray(one.raw), time: one.time, note: one.note }));
			const head = versionList.find((one) => one.id === versioned.head);
			leafList.push({ node, pathText: assetPathText(node), value: head.value, assetKey: source.key, keyPath, keyNodeList, isList: head.isList, version: { head: versioned.head, versionList } });
			return;
		}
		if (Array.isArray(value)) {
			value.forEach((one, index) => walk(one, node, [...keyPath, index], keyNodeList, source));
			return;
		}
		if (!mappingIs(value)) return;
		if (keyPath.length > 0) mappingList.push({ node, assetKey: source.key, keyPath });
		// a dated entry: its numbers as their heads say them, for whoever reads the entry itself
		if (value.year !== undefined) {
			const valueHead = { ...value, year: cvValueHeadGet(value.year), month: cvValueHeadGet(value.month), day: cvValueHeadGet(value.day) };
			entryList.push({ node, value: valueHead, assetKey: source.key, keyPath, pathList: assetPathExpand(node).pathList });
		}
		for (const key of Object.keys(value)) {
			const keyNode = keyNodeGet(key, problemList, source.label ?? source.key);
			walk(value[key], assetPathConcat(node, keyNode), [...keyPath, key], [...keyNodeList, keyNode], source);
		}
	};
	for (const source of sourceList) {
		const node = itemNodeGet(source, problemList);
		if (!node) continue;
		mappingList.push({ node, assetKey: source.key, keyPath: [], isItem: true });
		walk(source.data, node, [], [], source);
	}
	walk(virtual, assetPathConcat(), [], [], { key: '' });
	const index = assetPathIndexBuild(leafList.map((leaf) => ({ entry: leaf, pathList: [leaf.node] })), { segmentNormalize: cvSegmentNormalize, labelOf: (leaf) => leaf.pathText });
	for (const leaf of leafList) leaf.path = assetPathJoin(index.pathListByEntry.get(leaf)?.[0] ?? assetPathExpand(leaf.node).pathList[0] ?? []);
	return { leafList, mappingList, entryList, index, problemList: [...problemList, ...index.problemList] };
}

// a query: its path, then its modifiers (formats, a derivation), each a segment at the end, then
// "@" and the version it reads when it names one (pr/jp@2; none, or @head: the head):
//   { segmentList, formatList, derive, version, text }  (text: its canonical spelling)
export function cvQueryParse(text) {
	const { path, version } = cvQueryVersionSplit(text);
	const segmentList = path.split('/').map(cvSegmentNormalize).filter(Boolean);
	const formatList = [];
	let derive = '';
	while (segmentList.length > 0) {
		const last = segmentList[segmentList.length - 1];
		if (CV_FORMAT_LIST.includes(last)) formatList.unshift(segmentList.pop());
		else if (CV_DERIVE_LIST.includes(last) && !derive) derive = segmentList.pop();
		else break;
	}
	return { segmentList, formatList, derive, version, text: `${[...segmentList, ...(derive ? [derive] : []), ...formatList].join('/')}${version ? `${CV_VERSION_MARK}${version}` : ''}` };
}

// a query parted from the version it names: { path, version } (version '' for none and for
// @head, both reading the head; isVersionTyped: an "@" stands in it, a version being typed)
export function cvQueryVersionSplit(text) {
	const source = String(text ?? '');
	const index = source.lastIndexOf(CV_VERSION_MARK);
	if (index < 0) return { path: source, version: '', isVersionTyped: false };
	const version = source.slice(index + 1).trim().toLowerCase();
	return { path: source.slice(0, index), version: version === CV_VERSION_HEAD ? '' : version, isVersionTyped: true };
}

// a query with the version it reads set: (pr/jp@1, 3) -> pr/jp@3; none, or head: the head (pr/jp)
export function cvQueryVersionSet(text, version) {
	const { path } = cvQueryVersionSplit(text);
	const versionText = version === undefined || version === null ? '' : String(version).trim().toLowerCase();
	return versionText === '' || versionText === CV_VERSION_HEAD ? path : `${path}${CV_VERSION_MARK}${versionText}`;
}

// the leaf at a path, else the first below it in the order of the data
function leafOf(info, segmentList) {
	return assetPathIndexGet(info.index, segmentList) ?? assetPathIndexBelowList(info.index, segmentList)[0];
}

function formatApply(value, formatList) {
	let result = value;
	for (const format of formatList) {
		if (format === 'uppercase-all') result = result.toUpperCase();
		else if (format === 'lowercase-all') result = result.toLowerCase();
		else if (format === 'uppercase-first') result = cvUppercaseFirst(result);
	}
	return result;
}

function deriveResolve(info, parsed, dateNow) {
	const valueGet = (key) => leafOf(info, [...parsed.segmentList, key])?.value;
	const year = valueGet('year');
	if (year === undefined) return undefined;
	const month = valueGet('month');
	const day = valueGet('day');
	const value = parsed.derive === 'era' ? cvYearEraGet(year, month) : cvAgeGet({ year, month, day }, dateNow);
	return value === '' ? undefined : value;
}

// { status: found | missing, value, leaf?, leafList, by, alternativeList, version?, message, query }
//   by              how the value was come by: stored, script, derive, join
//   leaf            the one leaf the value is read from (absent when joined): what an editor writes
//   alternativeList what the same query could also mean: the other leaves below its path
//   version         of a value read from one leaf: { id, isHead, isPinned, count }: the version
//                   read, whether it is the head, whether the query names it (pr/jp@2: pinned,
//                   it reads that version whatever the head becomes), how many the leaf has
export function cvQueryResolve(info, text, context = {}) {
	const parsed = cvQueryParse(text);
	const { segmentList } = parsed;
	const dateNow = context.dateNow ?? new Date();
	const pathText = segmentList.join('/');
	const answer = (value, by, leaf, leafList, alternativeList = [], version = undefined) => ({
		status: 'found', value: formatApply(value, parsed.formatList), by, leaf, leafList, alternativeList, ...(version ? { version } : {}), message: '', query: parsed.text,
	});
	const missing = (message) => ({ status: 'missing', value: '', leafList: [], alternativeList: [], message, query: parsed.text });
	// the value one leaf holds: its head, or the version the query names
	const leafAnswer = (leaf, alternativeList = []) => {
		const versionList = cvLeafVersionListGet(leaf);
		const one = parsed.version ? versionList.find((version) => String(version.id) === parsed.version) : versionList.find((version) => version.isHead);
		if (!one) return missing(`${pathText} has no version ${parsed.version} (it has ${versionList.map((version) => version.id).join(', ')})`);
		return answer(one.value, 'stored', leaf, [leaf], alternativeList, { id: one.id, isHead: one.isHead, isPinned: parsed.version !== '', count: versionList.length });
	};
	if (segmentList.length === 0) return missing('an empty query');
	if (parsed.derive) {
		if (parsed.version) return missing(`${parsed.derive} is worked out of a date and has no versions: name one on the year (${pathText}/year${CV_VERSION_MARK}${parsed.version})`);
		const value = deriveResolve(info, parsed, dateNow);
		if (value !== undefined) return answer(value, 'derive', undefined, [leafOf(info, [...segmentList, 'year'])]);
		return missing(`no date holds ${pathText}`);
	}
	const exact = assetPathIndexGet(info.index, segmentList);
	if (exact) return leafAnswer(exact);
	// a name asked for as a whole: its last and first parts joined, in the order of its language.
	// the parts go where the query has none: name/jp/kanji reads name/jp/last/kanji
	if (!segmentList.includes('first') && !segmentList.includes('last')) {
		for (let at = segmentList.length; at >= 1; at -= 1) {
			const before = segmentList.slice(0, at);
			const after = segmentList.slice(at);
			const partLast = leafOf(info, [...before, 'last', ...after]);
			const partFirst = leafOf(info, [...before, 'first', ...after]);
			if (!partLast || !partFirst) continue;
			const partList = segmentList.includes('en') ? [partFirst, partLast] : [partLast, partFirst];
			if (parsed.version) return missing(`${pathText} is joined of ${partList.length} values and has no versions of its own: name one on a part (${partList[0].path}${CV_VERSION_MARK}${parsed.version})`);
			return answer(partList.map((leaf) => leaf.value).join(' '), 'join', undefined, partList);
		}
	}
	const belowList = assetPathIndexBelowList(info.index, segmentList);
	if (belowList.length > 0) return leafAnswer(belowList[0], belowList.slice(1));
	// another script of the same value, in the same place of the path. scripts derive from each
	// other (katakana from hiragana and back), so a query already being tried is not tried again
	const queryTriedSet = new Set([...(context.queryTriedSet ?? []), segmentList.join('/')]);
	for (let at = 0; at < segmentList.length; at += 1) {
		for (const source of CV_SCRIPT_SOURCE_BY_SCRIPT[segmentList[at]] ?? []) {
			const textSource = [...segmentList.slice(0, at), source.segment, ...segmentList.slice(at + 1)].join('/');
			if (queryTriedSet.has(textSource)) continue;
			// the version named is one of the value the script is read off
			const resolved = cvQueryResolve(info, cvQueryVersionSet(textSource, parsed.version), { ...context, queryTriedSet });
			if (resolved.status !== 'found') continue;
			return answer(source.convert(resolved.value), 'script', undefined, resolved.leafList, [], resolved.version);
		}
	}
	return missing(`nothing holds ${pathText}`);
}

// what can follow a query being typed: the segments that continue the path typed so far (the last
// segment, not finished, the start of the next), with how many values lie below each, and those
// values with the query reaching each the way it was typed:
//   { segmentList: [{ segment, count }], leafList: [{ leaf, query }], typedList }
export function cvQueryComplete(info, text, limit = 12) {
	const partList = cvQueryVersionSplit(text).path.split('/');
	const lastRaw = String(partList.pop() ?? '').trim().toLowerCase();
	const lastList = [...new Set([lastRaw, cvSegmentNormalize(lastRaw)])];
	const typedList = partList.map(cvSegmentNormalize).filter(Boolean);
	const node = assetPathIndexNodeGet(info.index, typedList);
	if (!node) return { segmentList: [], leafList: [], typedList };
	const segmentList = [];
	const leafSet = new Set();
	for (const child of node.childByKey.values()) {
		const segment = cvSegmentNormalize(child.segmentList[child.segmentList.length - 1]);
		if (lastRaw && !lastList.some((last) => segment.startsWith(last))) continue;
		segmentList.push({ segment, count: child.entryBelowList.length });
		for (const leaf of child.entryBelowList) leafSet.add(leaf);
	}
	const leafShown = lastRaw ? node.entryBelowList.filter((leaf) => leafSet.has(leaf)) : node.entryBelowList;
	return {
		segmentList: segmentList.slice(0, limit),
		leafList: leafShown.slice(0, limit).map((leaf) => ({ leaf, query: assetPathJoin(assetPathIndexPathOfEntryGet(info.index, leaf, typedList) ?? []) })),
		typedList,
	};
}

// ---------- choosing a query path: /query in a cell ----------

// the items of /query for the path typed so far (a slash action's itemListGet, jp/cv-query-cell.js):
// what is below the folder typed, one level at a time, each with its value, so that a path is
// chosen segment by segment:
//   name/        the folders below name (jp/, en/, last/, first/, ...), going on when chosen
//   name/jp/la   those starting with "la": last/; and the path itself when it reads a value
//   name/jp/last the path itself first ({{name/jp/last}}: 山田), then last/ to go on
//   pr/jp@       the versions of the value the path reads, the head first (#versions-of-a-value)
//   hobby/jp     a path nothing holds: offered as a new value (isNewOffered)
// -> [{ id, kind: 'dir' | 'value' | 'query' | 'version' | 'new', label, detail, query?, paramNext? }]
//   dir      a folder: paramNext is the parameter going on inside it (its values counted in detail)
//   value    a value below the folder typed: query is its path, detail its value
//   query    the typed path itself, when it reads a value (a default, a joined name, a script)
//   version  a version of the value the typed path reads: query names it (pr/jp@2)
//   new      the typed path, which nothing holds: query is the path of a value to be made
// option: isNewOffered (a path nothing holds is offered as a new value; default false)
export function cvQuerySlashItemListGet(info, param, context = {}, limit = 40, { isNewOffered = false } = {}) {
	const text = String(param ?? '').trimStart();
	const versionSplit = cvQueryVersionSplit(text);
	if (versionSplit.isVersionTyped) return cvQueryVersionItemListGet(info, versionSplit.path, text.slice(text.lastIndexOf(CV_VERSION_MARK) + 1), context).slice(0, limit);
	const indexSlash = text.lastIndexOf('/');
	const folderText = text.slice(0, indexSlash + 1);
	const prefixRaw = text.slice(indexSlash + 1).trim().toLowerCase();
	const prefixList = [...new Set([prefixRaw, cvSegmentNormalize(prefixRaw)])];
	const typedList = folderText.split('/').map(cvSegmentNormalize).filter(Boolean);
	const itemList = [];
	let isRead = false;
	if (prefixRaw) {
		const resolved = cvQueryResolve(info, text, context);
		if (resolved.status === 'found') {
			isRead = true;
			itemList.push({ id: `query:${text}`, kind: 'query', label: text, detail: cvValueShow(resolved.value), query: text });
			// a value kept in several versions: the walk goes on into them
			if (resolved.version && resolved.version.count > 1) {
				itemList.push({ id: `dir:${text}${CV_VERSION_MARK}`, kind: 'dir', label: `${text}${CV_VERSION_MARK}`, detail: `${resolved.version.count} versions, the head is ${resolved.version.id}`, paramNext: `${text}${CV_VERSION_MARK}` });
			}
		}
	}
	const node = assetPathIndexNodeGet(info.index, typedList);
	for (const child of node?.childByKey.values() ?? []) {
		const segment = cvSegmentNormalize(child.segmentList[child.segmentList.length - 1]);
		if (prefixRaw && !prefixList.some((prefix) => segment.startsWith(prefix))) continue;
		const leaf = child.entryList[0];
		const query = `${folderText}${segment}`;
		if (leaf && !(prefixRaw && query === text)) itemList.push({ id: `value:${query}`, kind: 'value', label: segment, detail: cvValueShow(leaf.value), query });
		if (child.childByKey.size > 0) {
			const count = child.entryBelowList.length;
			itemList.push({ id: `dir:${query}`, kind: 'dir', label: `${segment}/`, detail: `${count} value${count === 1 ? '' : 's'}`, paramNext: `${query}/` });
		}
	}
	// a path nothing holds, neither a value nor a folder: a value to be made there
	const itemNew = isNewOffered && prefixRaw && !isRead ? cvQueryNewItemGet(info, text) : undefined;
	return [...itemList.slice(0, itemNew ? limit - 1 : limit), ...(itemNew ? [itemNew] : [])];
}

// a value as a line of a menu shows it: an image named, line breaks as " / "
function cvValueShow(value) {
	return String(value).startsWith('data:') ? '(image)' : String(value).replace(/\n/g, ' / ');
}

// the versions of the value a path reads, as items of /query: the head first, then the others
// newest first, narrowed by what is typed after "@" (a number, or "head"); none when the path
// reads no single value
function cvQueryVersionItemListGet(info, path, typedInput, context) {
	const resolved = cvQueryResolve(info, path, context);
	const leaf = resolved.status === 'found' ? (resolved.leaf ?? (resolved.by === 'script' ? resolved.leafList[0] : undefined)) : undefined;
	if (!leaf) return [];
	const typed = String(typedInput ?? '').trim().toLowerCase();
	const versionList = cvLeafVersionListGet(leaf);
	const itemList = [];
	const head = versionList.find((one) => one.isHead);
	if (CV_VERSION_HEAD.startsWith(typed)) itemList.push({ id: `version:${path}@head`, kind: 'version', label: `${CV_VERSION_MARK}${CV_VERSION_HEAD}`, detail: `follows the head (now version ${head?.id}): ${cvValueShow(head?.value ?? '')}`, query: path });
	for (const one of [...versionList].reverse()) {
		if (typed && !String(one.id).startsWith(typed)) continue;
		itemList.push({
			id: `version:${path}@${one.id}`,
			kind: 'version',
			label: `${CV_VERSION_MARK}${one.id}`,
			detail: [one.isHead ? 'head' : '', one.note, cvValueShow(one.value)].filter(Boolean).join(' · '),
			query: `${path}${CV_VERSION_MARK}${one.id}`,
			time: one.time,
		});
	}
	return itemList;
}

// ---------- a new value: /new in a cell, a path nothing holds ----------

// why a value cannot be made at a path ('' when it can): its segments are words of a path, the
// last is no modifier (a format or a derivation, which names no value), and nothing is there
export function cvQueryNewProblemGet(info, text) {
	const source = cvQueryVersionSplit(text);
	if (source.isVersionTyped) return 'a new value has no version yet: its path ends before "@"';
	const rawList = source.path.split('/').map((one) => one.trim()).filter(Boolean);
	if (rawList.length === 0) return 'a path names the new value: name/jp, work/acme/jp/name';
	const bad = rawList.find((one) => !CV_SEGMENT_NEW_REGEX.test(one));
	if (bad !== undefined) return `${JSON.stringify(bad)} is no segment of a path: letters, digits, "-" and "_" (no space, no / { } [ ] , @ | $)`;
	const segmentList = rawList.map(cvSegmentNormalize);
	const last = segmentList[segmentList.length - 1];
	if (CV_FORMAT_LIST.includes(last) || CV_DERIVE_LIST.includes(last)) return `${last} is read off a value, never kept: end the path with a name of its own`;
	if (assetPathIndexGet(info.index, segmentList)) return `${segmentList.join('/')} holds a value already`;
	if (assetPathIndexNodeGet(info.index, segmentList)?.entryBelowList.length > 0) return `${segmentList.join('/')} is a folder holding values: name a value inside it`;
	return '';
}

// a segment a new path may be made of: no character of the grammar of paths, of tokens or of versions
const CV_SEGMENT_NEW_REGEX = /^[^\s/{}[\],@|$#!%^&*~][^\s/{}[\],@|$]*$/;

// the item offering the typed path as a new value, or undefined when none can be made there
function cvQueryNewItemGet(info, text) {
	if (cvQueryNewProblemGet(info, text) !== '') return undefined;
	const path = cvQueryParse(text).segmentList.join('/');
	const place = cvLeafPlaceGet(info, path);
	const where = !place ? '' : place.assetKey ? (place.keyPath.length < cvQueryParse(path).segmentList.length ? 'added under what holds its start' : 'added') : `a new item ${place.pathNew}`;
	return { id: `new:${path}`, kind: 'new', label: path, detail: `a new value of the profile${where ? `, ${where}` : ''}`, query: path };
}

// the items of /new for the path typed so far: the folders to go on under (as /query lists them,
// the values left out: a new value is no existing one), then the path itself as a new value, or
// why none can be made there. a path that reads a value already is offered as that value
// -> [{ id, kind: 'dir' | 'new' | 'query' | 'note', label, detail, query?, paramNext? }]
export function cvQueryNewSlashItemListGet(info, param, context = {}, limit = 40) {
	const text = String(param ?? '').trimStart();
	const indexSlash = text.lastIndexOf('/');
	const prefixRaw = text.slice(indexSlash + 1).trim();
	const itemList = cvQuerySlashItemListGet(info, cvQueryVersionSplit(text).path, context, limit).filter((item) => item.kind === 'dir' && !item.paramNext.endsWith(CV_VERSION_MARK));
	if (!prefixRaw) return itemList;
	const itemNew = cvQueryNewItemGet(info, text);
	if (itemNew) return [itemNew, ...itemList];
	const exact = assetPathIndexGet(info.index, cvQueryParse(text).segmentList);
	if (exact) return [{ id: `query:${text}`, kind: 'query', label: text, detail: `holds a value already: ${cvValueShow(exact.value)}`, query: cvQueryParse(text).segmentList.join('/') }, ...itemList];
	return [...itemList, { id: `note:${text}`, kind: 'note', label: cvQueryNewProblemGet(info, text), detail: '' }];
}

// ---------- text with queries ----------

// a text of a cell: literal, or holding queries in {{ }}: "{{birth/month}}月{{birth/day}}日". a
// brace token whose body starts with a sigil ({{@frontend:…}}: a view of an object, a token
// kind of react-doc's cell editing kit) is not a query and stays text here. what follows "|" is
// how the token is drawn in its place (its parameters), never part of the query.
// a year with its era ({{era:birth}}, {{era:2019/5}}: #a-year-with-its-era) reads a year:
//   of a date of the profile   a query of its year (isEra), so that the cell holding it alone
//                              is one query, changed in the profile as any other
//   written out                kind era: nothing is read
// both keep how they are written (raw), which is what draws the era.
// a period ({{period:work/x}}, {{period:2026/5~2026/10}}: #a-period) is kind period: what it reads
// is its two dates, said as one text (2026年5月〜2026年10月), and it too keeps how it is written
export function cvTextParse(text) {
	const partList = [];
	const pattern = /\{\{([^{}]*)\}\}/g;
	const source = String(text ?? '');
	let indexLast = 0;
	for (const match of source.matchAll(pattern)) {
		const body = match[1].split('|')[0].trim();
		const era = body.startsWith(CV_ERA_SIGIL) ? cvEraRead(body.slice(CV_ERA_SIGIL.length)) : undefined;
		const period = body.startsWith(CV_PERIOD_SIGIL) ? cvPeriodRead(body.slice(CV_PERIOD_SIGIL.length)) : undefined;
		if (!era && !period && (CV_TOKEN_SIGIL_REGEX.test(body) || body.startsWith(CV_ERA_SIGIL) || body.startsWith(CV_PERIOD_SIGIL))) continue;
		if (match.index > indexLast) partList.push({ kind: 'text', text: source.slice(indexLast, match.index) });
		if (period) partList.push({ kind: 'period', raw: match[0], period });
		else if (era?.kind === 'literal') partList.push({ kind: 'era', raw: match[0], year: era.year });
		else if (era) partList.push({ kind: 'query', query: `${era.path}/year`, raw: match[0], isEra: true });
		else partList.push({ kind: 'query', query: body });
		indexLast = match.index + match[0].length;
	}
	if (indexLast < source.length) partList.push({ kind: 'text', text: source.slice(indexLast) });
	return partList;
}

// what a query never starts with: the sigil of a token of another kind ("@" an object,
// "/" a data item of the profile named by its path: a badge, {{/badge/aws/saa}})
const CV_TOKEN_SIGIL_REGEX = /^[@#!$%^&*~/]/;

// { text, textKept, partList, missingList, leaf, period }: leaf when the whole text is one query read from one leaf
//   text       every query as the value it reads
//   textKept   the same, a year with its era and a period kept as written: what is drawn of them is their token
//   period     when the whole text is one period: what it names and reads (cvPeriodRead, cvPeriodResolve), so that
//              a card changes its dates in the profile
export function cvTextExpand(info, text, context = {}) {
	const partList = cvTextParse(text).map((part) => {
		if (part.kind === 'query') return { ...part, resolved: cvQueryResolve(info, part.query, context) };
		if (part.kind === 'period') return { ...part, resolved: cvPeriodResolve(info, part.period, context) };
		return part;
	});
	const queryList = partList.filter((part) => part.kind === 'query');
	const partText = (part) => (part.kind === 'query' ? part.resolved.value : part.kind === 'era' ? part.year : part.kind === 'period' ? part.resolved.text : part.text);
	return {
		text: partList.map(partText).join(''),
		textKept: partList.map((part) => (part.raw !== undefined ? part.raw : partText(part))).join(''),
		period: partList.length === 1 && partList[0].kind === 'period' ? { ...partList[0].period, resolved: partList[0].resolved } : undefined,
		partList,
		missingList: queryList.filter((part) => part.resolved.status !== 'found').map((part) => part.query),
		leaf: partList.length === 1 && queryList.length === 1 ? queryList[0].resolved.leaf : undefined,
		query: partList.length === 1 && queryList.length === 1 ? queryList[0].query : '',
	};
}

// ---------- a year with its era ----------

// the sigil of the token drawing a year with its Japanese era above it (jp/cv-era-cell.jsx):
//   {{era:2019/5}}                    a year written out, with the month deciding its era (2019/5: 令和元)
//   {{era:birth}}  {{era:edu/bachelor/start}}   a date of the profile: a mapping with a year
export const CV_ERA_SIGIL = 'era:';

// what the body of such a token names: { kind: 'literal', year, month } for a year written out
// (2019, 2019/5, 2019-05, 2019.5), { kind: 'path', path } for a date of the profile (a path ending
// with year names the date holding it); undefined for neither
export function cvEraRead(bodyInput) {
	const body = String(bodyInput ?? '').trim();
	const literal = /^(\d{4})(?:[/.\-](\d{1,2}))?$/.exec(body);
	if (literal) return { kind: 'literal', year: literal[1], month: literal[2] ? String(Number(literal[2])) : '' };
	if (/^\d/.test(body)) return undefined;
	const { segmentList } = cvQueryParse(body);
	if (segmentList[segmentList.length - 1] === 'year') segmentList.pop();
	return segmentList.length > 0 ? { kind: 'path', path: segmentList.join('/') } : undefined;
}

// the year and the era such a token draws: { status: found | missing, year, month, era }
export function cvEraResolve(info, era, context = {}) {
	if (!era) return { status: 'missing', year: '', month: '', era: '' };
	if (era.kind === 'literal') return { status: 'found', year: era.year, month: era.month, era: cvYearEraGet(era.year, era.month) };
	const year = info ? cvQueryResolve(info, `${era.path}/year`, context) : undefined;
	if (year?.status !== 'found') return { status: 'missing', year: '', month: '', era: '' };
	const month = assetPathIndexGet(info.index, [...cvQueryParse(era.path).segmentList, 'month'])?.value ?? '';
	return { status: 'found', year: String(year.value), month: String(month), era: cvYearEraGet(year.value, month) };
}

// the items of /era for what is typed (a slash action's itemListGet): a year written out when it
// is one, then the dates of the profile whose path holds what is typed, each with what it draws
// -> [{ id, kind: 'literal' | 'date', label, detail, body }]   body: what the token names
export function cvEraSlashItemListGet(info, param, limit = 40) {
	const text = String(param ?? '').trim().toLowerCase();
	const itemList = [];
	const literal = cvEraRead(text);
	const detailGet = (year, month) => `${cvYearEraGet(year, month) || 'no era'} over ${year}${month ? ` (month ${month})` : ''}`;
	if (literal?.kind === 'literal') itemList.push({ id: `literal:${text}`, kind: 'literal', label: text, detail: detailGet(literal.year, literal.month), body: text });
	for (const entry of info?.entryList ?? []) {
		const path = assetPathJoin(entry.pathList[0] ?? []);
		if (path === '' || (text !== '' && !path.toLowerCase().includes(text))) continue;
		itemList.push({ id: `date:${path}`, kind: 'date', label: path, detail: detailGet(entry.value.year, entry.value.month), body: path });
	}
	return itemList.slice(0, limit);
}

// ---------- a period ----------

// the sigil of the token drawing a period, its start over a vertical line over its end (jp/cv-period-cell.jsx):
//   {{period:work/sample-systems}}             a folder of the profile holding start and end
//   {{period:edu/bachelor/start~edu/bachelor/end}}   two dates of the profile
//   {{period:2026/5~2026/10}}  {{period:2026/5~}}    dates written out; no end: to the present
export const CV_PERIOD_SIGIL = 'period:';
// what a period says in the place of its end while it has none
export const CV_PERIOD_NOW = '現在';
const PERIOD_MARK_REGEX = /[~〜～]/;

// what the body of such a token names: { start, end, folder? }, each date as cvEraRead says it
// (a year written out, or a date of the profile); end undefined: to the present. folder: the
// path holding start and end, for the short form. undefined for a body naming no start
export function cvPeriodRead(bodyInput) {
	const body = String(bodyInput ?? '').trim();
	if (body === '') return undefined;
	if (!PERIOD_MARK_REGEX.test(body)) {
		// a year written out alone is a period of one date going on; a path is a folder
		const one = cvEraRead(body);
		if (!one) return undefined;
		if (one.kind === 'literal') return { start: one, end: undefined };
		return { start: { kind: 'path', path: `${one.path}/start` }, end: { kind: 'path', path: `${one.path}/end` }, folder: one.path };
	}
	const [startText, endText = ''] = body.split(PERIOD_MARK_REGEX);
	const start = cvEraRead(startText);
	if (!start) return undefined;
	const endTrimmed = endText.trim();
	const end = endTrimmed === '' || endTrimmed === 'now' || endTrimmed === CV_PERIOD_NOW ? undefined : cvEraRead(endTrimmed);
	return { start, end };
}

// a date as a period says it: 2026年5月 (a year alone: 2026年)
function periodDateText(date) {
	return date.status === 'found' ? `${date.year}年${date.month !== '' ? `${date.month}月` : ''}` : '';
}

// what a period reads: { start, end, isNow, isTimeless, text }
//   start, end   each { status, year, month, era } (cvEraResolve)
//   isNow        it has no end: it goes on to the present
//   isTimeless   it has no start either: nothing is drawn of it (a folder holding no date)
//   text         its plain text: 2026年5月〜2026年10月, 2026年5月〜現在, '' when timeless
export function cvPeriodResolve(info, period, context = {}) {
	const start = cvEraResolve(info, period?.start, context);
	const end = cvEraResolve(info, period?.end, context);
	const isNow = end.status !== 'found';
	const isTimeless = start.status !== 'found' && isNow;
	return { start, end, isNow, isTimeless, text: isTimeless ? '' : `${periodDateText(start)}〜${isNow ? CV_PERIOD_NOW : periodDateText(end)}` };
}

// the items of /period for what is typed: a period written out when it is one, then the folders
// of the profile holding a start whose path holds what is typed, each with what it draws
// -> [{ id, kind: 'literal' | 'folder', label, detail, body }]
export function cvPeriodSlashItemListGet(info, param, limit = 40) {
	const text = String(param ?? '').trim().toLowerCase();
	const itemList = [];
	const typed = /^\d/.test(text) ? cvPeriodRead(text) : undefined;
	if (typed) itemList.push({ id: `literal:${text}`, kind: 'literal', label: text, detail: cvPeriodResolve(info, typed).text, body: text });
	for (const entry of info?.entryList ?? []) {
		const pathList = entry.pathList[0] ?? [];
		if (pathList[pathList.length - 1] !== 'start' || pathList.length < 2) continue;
		const folder = assetPathJoin(pathList.slice(0, -1));
		if (text !== '' && !folder.toLowerCase().includes(text)) continue;
		itemList.push({ id: `folder:${folder}`, kind: 'folder', label: folder, detail: cvPeriodResolve(info, cvPeriodRead(folder)).text, body: folder });
	}
	return itemList.slice(0, limit);
}

// ---------- dated entries ----------

function monthOrderGet(month) {
	const value = Number.parseInt(month, 10);
	return Number.isFinite(value) ? value : 0;
}

function leafListOfEntry(entry, info) {
	const depth = entry.keyPath.length;
	return info.leafList.filter((leaf) => leaf.assetKey === entry.assetKey && leaf.keyPath.length > depth
		&& entry.keyPath.every((key, index) => leaf.keyPath[index] === key));
}

// how far a query runs along the paths of an entry: the most segments it shares with one of them
function entryReachGet(entry, segmentList) {
	let reach = 0;
	for (const path of entry.pathList) {
		let at = 0;
		while (at < path.length && at < segmentList.length && cvSegmentNormalize(path[at]) === segmentList[at]) at += 1;
		reach = Math.max(reach, at);
	}
	return reach;
}

// the dated entries a query names, in order of time: a mapping with a year whose path the query
// starts along (edu/jp runs along edu/bachelor/start). what follows chooses the text inside each
// entry (jp: its key jp), and an entry holding nothing it chooses is left out:
//   [{ id, year, month, text, note, assetKey, keyPath, textKeyPath, noteKeyPath, isTextList }]
export function cvEntryListResolve(info, text) {
	const { segmentList } = cvQueryParse(text);
	const result = [];
	info.entryList.forEach((entry, order) => {
		const reach = entryReachGet(entry, segmentList);
		if (reach === 0) return;
		const choose = segmentList.slice(reach);
		const depth = entry.keyPath.length;
		const keyFirst = (leaf) => cvSegmentNormalize(leaf.keyPath[depth]);
		const leafChosen = (leafList, depthInside) => leafList.find((leaf) => assetPathMatch(assetPathConcat(...leaf.keyNodeList.slice(depthInside)), choose, { isPrefix: true, segmentNormalize: cvSegmentNormalize }));
		const leafListAll = leafListOfEntry(entry, info);
		const leafTextList = leafListAll.filter((leaf) => !CV_ENTRY_KEY_LIST.includes(keyFirst(leaf)));
		const leafNoteList = leafListAll.filter((leaf) => keyFirst(leaf) === 'note');
		const leafText = leafChosen(leafTextList, depth);
		const leafNote = leafChosen(leafNoteList, depth + 1);
		if (choose.length > 0 && !leafText && !leafNote) return;
		const leafTextShown = leafText ?? leafTextList[0];
		// a note in no language (note: text) is the note of every language
		const leafNoteShown = leafNote ?? leafNoteList.find((leaf) => leaf.keyPath.length === depth + 1) ?? (choose.length === 0 ? leafNoteList[0] : undefined);
		result.push({
			id: `${entry.assetKey}:${entry.keyPath.join('.')}`,
			order,
			year: String(entry.value.year ?? ''),
			month: String(entry.value.month ?? ''),
			text: leafTextShown?.value ?? '',
			note: leafNoteShown?.value ?? '',
			assetKey: entry.assetKey,
			keyPath: entry.keyPath,
			textKeyPath: leafTextShown?.keyPath ?? [...entry.keyPath, choose[0] ?? 'text'],
			noteKeyPath: leafNoteShown?.keyPath ?? [...entry.keyPath, 'note', ...(choose[0] ? [choose[0]] : [])],
			isTextList: leafTextShown?.isList === true,
		});
	});
	return result.sort((a, b) => (Number(a.year) - Number(b.year)) || (monthOrderGet(a.month) - monthOrderGet(b.month)) || (a.order - b.order));
}

// ---------- writing ----------

// the data with the value at a key path set, the rest shared; made of mappings where keys are missing.
// a value kept with versions is never replaced by a plain one: the plain value is written into
// its head (in place), so that a writer knowing no versions loses none of them
export function cvDataSet(data, keyPath, value) {
	if (keyPath.length === 0) return cvVersionedIs(data) && leafRawIs(value) ? versionedWrite(data, value, { mode: 'inPlace' }).value : value;
	const [key, ...rest] = keyPath;
	const node = Array.isArray(data) ? [...data] : { ...(mappingIs(data) ? data : {}) };
	node[key] = cvDataSet(node[key], rest, value);
	return node;
}

// the data without the value at a key path, and without the mappings that leaves empty
export function cvDataRemove(data, keyPath) {
	if (keyPath.length === 0 || data === null || typeof data !== 'object') return data;
	const [key, ...rest] = keyPath;
	const node = Array.isArray(data) ? [...data] : { ...data };
	if (rest.length === 0) {
		if (Array.isArray(node)) node.splice(Number(key), 1);
		else delete node[key];
		return node;
	}
	const inner = cvDataRemove(node[key], rest);
	if (mappingIs(inner) && Object.keys(inner).length === 0 && !Array.isArray(node)) delete node[key];
	else node[key] = inner;
	return node;
}

// ---------- writing a value by its versions ----------

// a value (plain, or kept with versions) with something written into it:
//   mode 'inPlace'      the version named (versionId; none: the head) says value from now on. a
//                       plain value stays plain
//   mode 'newVersion'   a new version holds value: its id the largest so far + 1, its time and
//                       note as given. it becomes the head unless isHeadMoved is false (the
//                       version of a place pinned to one: the head stays what it was)
// -> { value, versionId }: the value as the data keeps it now, the version written;
//    { message } when the version named is none of its versions
function versionedWrite(valueBefore, raw, { mode = 'inPlace', versionId, isHeadMoved = true, time = '', note = '' } = {}) {
	const versioned = cvVersionedIs(valueBefore) ? versionedRead(valueBefore) : undefined;
	// its versions as the data writes them: a plain value is its version 1
	const versionList = versioned
		? valueBefore[CV_VERSION_KEY].versionList.filter((one) => versioned.versionList.some((kept) => kept.id === Number(one?.id)))
		: (leafRawIs(valueBefore) ? [{ id: 1, value: valueBefore }] : []);
	const head = versioned?.head ?? 1;
	const build = (listNext, headNext) => ({ [CV_VERSION_KEY]: { head: headNext, versionList: listNext } });
	if (mode === 'newVersion') {
		const idNew = versionList.reduce((max, one) => Math.max(max, Number(one.id)), 0) + 1;
		const versionNew = { id: idNew, value: raw, ...(time ? { time } : {}), ...(note ? { note } : {}) };
		// nothing was there: the first version of a value is written plainly
		if (versionList.length === 0) return { value: raw, versionId: 1 };
		return { value: build([...versionList, versionNew], isHeadMoved ? idNew : head), versionId: idNew };
	}
	const idTarget = versionId === undefined || versionId === null || versionId === '' ? head : Number(versionId);
	if (!versioned) {
		if (idTarget !== 1) return { message: `it has no version ${versionId} (it has 1)` };
		return { value: raw, versionId: 1 };
	}
	if (!versionList.some((one) => Number(one.id) === idTarget)) return { message: `it has no version ${versionId} (it has ${versionList.map((one) => one.id).join(', ')})` };
	return { value: build(versionList.map((one) => (Number(one.id) === idTarget ? { ...one, value: raw } : one)), head), versionId: idTarget };
}

function dataAtGet(data, keyPath) {
	return keyPath.reduce((value, key) => (value !== null && typeof value === 'object' ? value[key] : undefined), data);
}

// the data with a value written at a key path by its versions (versionedWrite: mode, versionId,
// isHeadMoved, time, note): { data, versionId }, or { message } when the version named is none
export function cvValueDataSet(data, keyPath, raw, option = {}) {
	const written = versionedWrite(dataAtGet(data, keyPath), raw, option);
	if (written.message) return { message: written.message };
	// the value as kept is put there whole: cvDataSet would write a plain one into the head
	return { data: dataPut(data, keyPath, written.value), versionId: written.versionId };
}

// the value at a key path replaced whole, versions and all (cvDataSet keeps the versions of what is there)
function dataPut(data, keyPath, value) {
	if (keyPath.length === 0) return value;
	const [key, ...rest] = keyPath;
	const node = Array.isArray(data) ? [...data] : { ...(mappingIs(data) ? data : {}) };
	node[key] = dataPut(node[key], rest, value);
	return node;
}

// the data with another version of the value at a key path as its head (a version checked out):
// { data }, or { message }. a plain value has one version, its head already
export function cvValueVersionHeadSet(data, keyPath, versionId) {
	const value = dataAtGet(data, keyPath);
	const id = Number(versionId);
	const versioned = cvVersionedIs(value) ? versionedRead(value) : undefined;
	if (!versioned) return id === 1 && leafRawIs(value) ? { data } : { message: `it has no version ${versionId}` };
	if (!versioned.versionList.some((one) => one.id === id)) return { message: `it has no version ${versionId} (it has ${versioned.versionList.map((one) => one.id).join(', ')})` };
	return { data: dataPut(data, keyPath, { [CV_VERSION_KEY]: { ...value[CV_VERSION_KEY], head: id } }) };
}

// the data without one version of the value at a key path: never its head (another version is
// made the head first), so a value always reads something. its other versions keep their ids
export function cvValueVersionRemove(data, keyPath, versionId) {
	const value = dataAtGet(data, keyPath);
	const id = Number(versionId);
	const versioned = cvVersionedIs(value) ? versionedRead(value) : undefined;
	if (!versioned || !versioned.versionList.some((one) => one.id === id)) return { message: `it has no version ${versionId}` };
	if (versioned.head === id) return { message: `version ${id} is the head: make another version the head first` };
	const versionList = value[CV_VERSION_KEY].versionList.filter((one) => Number(one?.id) !== id);
	return { data: dataPut(data, keyPath, { [CV_VERSION_KEY]: { ...value[CV_VERSION_KEY], versionList } }) };
}

// the data with the note of one version of the value at a key path set ('' takes it away). a
// plain value is written with its versions then, since a plain value has nowhere to keep a note
export function cvValueVersionNoteSet(data, keyPath, versionId, noteInput) {
	const value = dataAtGet(data, keyPath);
	const id = Number(versionId);
	const note = String(noteInput ?? '').trim();
	if (!cvVersionedIs(value)) {
		if (id !== 1 || !leafRawIs(value)) return { message: `it has no version ${versionId}` };
		return note === '' ? { data } : { data: dataPut(data, keyPath, { [CV_VERSION_KEY]: { head: 1, versionList: [{ id: 1, value, note }] } }) };
	}
	if (!value[CV_VERSION_KEY].versionList.some((one) => Number(one?.id) === id)) return { message: `it has no version ${versionId}` };
	const versionList = value[CV_VERSION_KEY].versionList.map((one) => {
		if (Number(one?.id) !== id) return one;
		const { note: _noteBefore, ...rest } = one;
		return note === '' ? rest : { ...rest, note };
	});
	return { data: dataPut(data, keyPath, { [CV_VERSION_KEY]: { ...value[CV_VERSION_KEY], versionList } }) };
}

// a stored text as its leaf keeps it: lines back into a list when it was one
export function cvLeafValueBuild(text, isList) {
	return isList ? String(text).split('\n') : String(text);
}

// where a value of a query path goes: the leaf at that path when there is one; else below the
// deepest mapping (or item) a start of the path names, the rest of the path becoming keys, so
// name/last/jp/katakana goes into the mapping "{jp/last/}"; else a new item named by the first
// segment: { assetKey, pathNew?, keyPath }
export function cvLeafPlaceGet(info, text) {
	const { segmentList } = cvQueryParse(text);
	if (segmentList.length === 0) return undefined;
	const leaf = assetPathIndexGet(info.index, segmentList);
	if (leaf?.assetKey) return { assetKey: leaf.assetKey, keyPath: leaf.keyPath };
	let best;
	for (const mapping of info.mappingList) {
		// a virtual value (the date of a CV) is read, never written
		if (!mapping.assetKey) continue;
		for (let at = segmentList.length; at >= 1; at -= 1) {
			if (best && at <= best.at) break;
			if (assetPathMatch(mapping.node, segmentList.slice(0, at), { segmentNormalize: cvSegmentNormalize })) {
				best = { at, mapping };
				break;
			}
		}
	}
	if (best) return { assetKey: best.mapping.assetKey, keyPath: [...best.mapping.keyPath, ...segmentList.slice(best.at)] };
	const [segmentFirst, ...keyPath] = segmentList;
	return { assetKey: '', pathNew: `/${CV_INFO_FOLDER}/${segmentFirst}`, keyPath };
}
