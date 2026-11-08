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

// other spellings of a segment, in the data and in a query: a vocabulary, not a pattern
const CV_SEGMENT_ALIAS = {
	ja: 'jp', japanese: 'jp', english: 'en',
	family: 'last', surname: 'last', given: 'first',
	furigana: 'hiragana', kana: 'hiragana', ふりがな: 'hiragana', フリガナ: 'katakana',
	romanji: 'romaji', romnaji: 'romaji', roman: 'romaji', katanaka: 'katakana',
	upper: 'uppercase-all', uppercase: 'uppercase-all', capitalize: 'uppercase-first', title: 'uppercase-first',
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
//   leafList     every value: { node, pathText, path, value, assetKey, keyPath, keyNodeList, isList }
//   mappingList  every mapping and item, where a new value may go: { node, assetKey, keyPath }
//   entryList    every dated entry (a mapping with a year): { node, value, assetKey, keyPath, pathList }
//   index        the leaves by their paths (asset path index), problemList
export function cvInfoBuild(sourceList, virtual = {}) {
	const leafList = [];
	const mappingList = [];
	const entryList = [];
	const problemList = [];
	const walk = (value, node, keyPath, keyNodeList, source) => {
		if (scalarIs(value) || (Array.isArray(value) && value.every(scalarIs))) {
			const isList = Array.isArray(value);
			leafList.push({ node, pathText: assetPathText(node), value: isList ? value.join('\n') : String(value), assetKey: source.key, keyPath, keyNodeList, isList });
			return;
		}
		if (Array.isArray(value)) {
			value.forEach((one, index) => walk(one, node, [...keyPath, index], keyNodeList, source));
			return;
		}
		if (!mappingIs(value)) return;
		if (keyPath.length > 0) mappingList.push({ node, assetKey: source.key, keyPath });
		if (value.year !== undefined) entryList.push({ node, value, assetKey: source.key, keyPath, pathList: assetPathExpand(node).pathList });
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

// a query: its path, then its modifiers (formats, a derivation), each a segment at the end:
//   { segmentList, formatList, derive, text }  (text: its canonical spelling)
export function cvQueryParse(text) {
	const segmentList = String(text ?? '').split('/').map(cvSegmentNormalize).filter(Boolean);
	const formatList = [];
	let derive = '';
	while (segmentList.length > 0) {
		const last = segmentList[segmentList.length - 1];
		if (CV_FORMAT_LIST.includes(last)) formatList.unshift(segmentList.pop());
		else if (CV_DERIVE_LIST.includes(last) && !derive) derive = segmentList.pop();
		else break;
	}
	return { segmentList, formatList, derive, text: [...segmentList, ...(derive ? [derive] : []), ...formatList].join('/') };
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

// { status: found | missing, value, leaf?, leafList, by, alternativeList, message, query }
//   by              how the value was come by: stored, script, derive, join
//   leaf            the one leaf the value is read from (absent when joined): what an editor writes
//   alternativeList what the same query could also mean: the other leaves below its path
export function cvQueryResolve(info, text, context = {}) {
	const parsed = cvQueryParse(text);
	const { segmentList } = parsed;
	const dateNow = context.dateNow ?? new Date();
	const answer = (value, by, leaf, leafList, alternativeList = []) => ({
		status: 'found', value: formatApply(value, parsed.formatList), by, leaf, leafList, alternativeList, message: '', query: parsed.text,
	});
	const missing = (message) => ({ status: 'missing', value: '', leafList: [], alternativeList: [], message, query: parsed.text });
	if (segmentList.length === 0) return missing('an empty query');
	if (parsed.derive) {
		const value = deriveResolve(info, parsed, dateNow);
		if (value !== undefined) return answer(value, 'derive', undefined, [leafOf(info, [...segmentList, 'year'])]);
		return missing(`no date holds ${segmentList.join('/')}`);
	}
	const exact = assetPathIndexGet(info.index, segmentList);
	if (exact) return answer(exact.value, 'stored', exact, [exact]);
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
			return answer(partList.map((leaf) => leaf.value).join(' '), 'join', undefined, partList);
		}
	}
	const belowList = assetPathIndexBelowList(info.index, segmentList);
	if (belowList.length > 0) return answer(belowList[0].value, 'stored', belowList[0], [belowList[0]], belowList.slice(1));
	// another script of the same value, in the same place of the path. scripts derive from each
	// other (katakana from hiragana and back), so a query already being tried is not tried again
	const queryTriedSet = new Set([...(context.queryTriedSet ?? []), segmentList.join('/')]);
	for (let at = 0; at < segmentList.length; at += 1) {
		for (const source of CV_SCRIPT_SOURCE_BY_SCRIPT[segmentList[at]] ?? []) {
			const textSource = [...segmentList.slice(0, at), source.segment, ...segmentList.slice(at + 1)].join('/');
			if (queryTriedSet.has(textSource)) continue;
			const resolved = cvQueryResolve(info, textSource, { ...context, queryTriedSet });
			if (resolved.status !== 'found') continue;
			return answer(source.convert(resolved.value), 'script', undefined, resolved.leafList);
		}
	}
	return missing(`nothing holds ${segmentList.join('/')}`);
}

// what can follow a query being typed: the segments that continue the path typed so far (the last
// segment, not finished, the start of the next), with how many values lie below each, and those
// values with the query reaching each the way it was typed:
//   { segmentList: [{ segment, count }], leafList: [{ leaf, query }], typedList }
export function cvQueryComplete(info, text, limit = 12) {
	const partList = String(text ?? '').split('/');
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

// the items of /query for the path typed so far (a slash action's itemListGet, cv-query-slash.js):
// what is below the folder typed, one level at a time, each with its value, so that a path is
// chosen segment by segment:
//   name/        the folders below name (jp/, en/, last/, first/, ...), going on when chosen
//   name/jp/la   those starting with "la": last/; and the path itself when it reads a value
//   name/jp/last the path itself first ({{name/jp/last}}: 山田), then last/ to go on
// -> [{ id, kind: 'dir' | 'value' | 'query', label, detail, query?, paramNext? }]
//   dir     a folder: paramNext is the parameter going on inside it (its values counted in detail)
//   value   a value below the folder typed: query is its path, detail its value
//   query   the typed path itself, when it reads a value (a default, a joined name, a script)
export function cvQuerySlashItemListGet(info, param, context = {}, limit = 40) {
	const text = String(param ?? '').trimStart();
	const indexSlash = text.lastIndexOf('/');
	const folderText = text.slice(0, indexSlash + 1);
	const prefixRaw = text.slice(indexSlash + 1).trim().toLowerCase();
	const prefixList = [...new Set([prefixRaw, cvSegmentNormalize(prefixRaw)])];
	const typedList = folderText.split('/').map(cvSegmentNormalize).filter(Boolean);
	const valueShow = (value) => (String(value).startsWith('data:') ? '(image)' : String(value).replace(/\n/g, ' / '));
	const itemList = [];
	if (prefixRaw) {
		const resolved = cvQueryResolve(info, text, context);
		if (resolved.status === 'found') itemList.push({ id: `query:${text}`, kind: 'query', label: text, detail: valueShow(resolved.value), query: text });
	}
	const node = assetPathIndexNodeGet(info.index, typedList);
	for (const child of node?.childByKey.values() ?? []) {
		const segment = cvSegmentNormalize(child.segmentList[child.segmentList.length - 1]);
		if (prefixRaw && !prefixList.some((prefix) => segment.startsWith(prefix))) continue;
		const leaf = child.entryList[0];
		const query = `${folderText}${segment}`;
		if (leaf && !(prefixRaw && query === text)) itemList.push({ id: `value:${query}`, kind: 'value', label: segment, detail: valueShow(leaf.value), query });
		if (child.childByKey.size > 0) {
			const count = child.entryBelowList.length;
			itemList.push({ id: `dir:${query}`, kind: 'dir', label: `${segment}/`, detail: `${count} value${count === 1 ? '' : 's'}`, paramNext: `${query}/` });
		}
	}
	return itemList.slice(0, limit);
}

// ---------- text with queries ----------

// a text of a cell: literal, or holding queries in {{ }}: "{{birth/month}}月{{birth/day}}日"
export function cvTextParse(text) {
	const partList = [];
	const pattern = /\{\{([^{}]*)\}\}/g;
	const source = String(text ?? '');
	let indexLast = 0;
	for (const match of source.matchAll(pattern)) {
		if (match.index > indexLast) partList.push({ kind: 'text', text: source.slice(indexLast, match.index) });
		partList.push({ kind: 'query', query: match[1].trim() });
		indexLast = match.index + match[0].length;
	}
	if (indexLast < source.length) partList.push({ kind: 'text', text: source.slice(indexLast) });
	return partList;
}

// { text, partList, missingList, leaf }: leaf when the whole text is one query read from one leaf
export function cvTextExpand(info, text, context = {}) {
	const partList = cvTextParse(text).map((part) => (part.kind === 'query' ? { ...part, resolved: cvQueryResolve(info, part.query, context) } : part));
	const queryList = partList.filter((part) => part.kind === 'query');
	return {
		text: partList.map((part) => (part.kind === 'query' ? part.resolved.value : part.text)).join(''),
		partList,
		missingList: queryList.filter((part) => part.resolved.status !== 'found').map((part) => part.query),
		leaf: partList.length === 1 && queryList.length === 1 ? queryList[0].resolved.leaf : undefined,
		query: partList.length === 1 && queryList.length === 1 ? queryList[0].query : '',
	};
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

// the data with the value at a key path set, the rest shared; made of mappings where keys are missing
export function cvDataSet(data, keyPath, value) {
	if (keyPath.length === 0) return value;
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
