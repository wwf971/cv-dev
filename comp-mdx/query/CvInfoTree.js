import { assetPathCanonicalGet } from '@wwf971/react-doc/asset-path';
import { cvSegmentNormalize } from './CvQuery.js';

// The values of a profile as a tree (doc/cv-query.md#the-mode-information): what the mode
// Information draws, a level at a time. Pure: no store, no React.
//
// A value stands where its query path says, a segment a level: values sharing the start of their
// paths share a folder, so a reader goes from "name" to "jp" to "last" to the value.
//
//   name/jp/last/kanji   山田        name ─┬─ jp ─┬─ last ─┬─ kanji     山田
//   name/jp/last/romaji  Yamada            │      │        └─ romaji    Yamada
//   name/jp/first/kanji  太郎              │      └─ first ── kanji     太郎
//   name/en/last         Yamada            └─ en ──── last              Yamada
//   gender               male        gender                             male
//
// the path is the canonical one (leaf.path): the members of a group {jp/last/} in the order the
// data writes them, which is also what a CV writes to read the value. the order of the folders
// and values is the order of the data, since the first value below a path is what a query of
// that path answers with.
//
// a tree has one order, and a path has several where its pattern has an unordered group: jp and
// last of name/{jp/last/}kanji are one step taken either way, drawn here as two levels. So a level
// that is a member of a group says so (memberOtherList), and is marked; the view that draws a
// group as one item is the explorer (CvInfoExplore.js).
//
// a node: { kind: 'folder' | 'leaf', id, name, path, depth, nodeList, leaf?, countLeaf, previewList, memberOtherList }
//   id           unique in the tree: the path of a folder; of a leaf, its item and keys
//   path         its query path ('' for the root)
//   countLeaf    the values below a folder
//   previewList  the first values below a folder, as text: what a closed folder says it holds
//   memberOtherList  the segments this one comes in any order with ([] for most): for jp, [last]
export const CV_INFO_PREVIEW_COUNT = 4;
// a value kept as an image (a photo): not text to preview or to find by
export const cvValueIsImage = (value) => String(value ?? '').startsWith('data:image/');
// what a folder says of a value it holds: its first line; nothing of an image or an empty value
export function cvValuePreviewGet(value) {
	return cvValueIsImage(value) || String(value ?? '').trim() === '' ? '' : String(value).split('\n')[0];
}

// for each segment of a leaf's canonical path, the members of the group it is in (undefined
// outside one). [] when the path is not the canonical one of its pattern (another value claimed it)
function leafMemberListGet(leaf, segmentList) {
	const canonicalList = leaf.node ? assetPathCanonicalGet(leaf.node) : [];
	const isSame = canonicalList.length === segmentList.length && canonicalList.every((one, at) => cvSegmentNormalize(one.name) === cvSegmentNormalize(segmentList[at]));
	return isSame ? canonicalList.map((one) => one.memberList) : [];
}

function memberOtherAdd(node, memberList) {
	for (const member of memberList ?? []) {
		if (cvSegmentNormalize(member) !== cvSegmentNormalize(node.name) && !node.memberOtherList.includes(member)) node.memberOtherList.push(member);
	}
}

export function cvInfoTreeBuild(leafList) {
	const root = { kind: 'folder', id: '', name: '', path: '', depth: -1, nodeList: [], countLeaf: 0, previewList: [], memberOtherList: [] };
	const folderByPath = new Map([['', root]]);
	const folderGet = (segmentList) => {
		const path = segmentList.join('/');
		const found = folderByPath.get(path);
		if (found) return found;
		const parent = folderGet(segmentList.slice(0, -1));
		const folder = { kind: 'folder', id: path, name: segmentList[segmentList.length - 1], path, depth: segmentList.length - 1, nodeList: [], countLeaf: 0, previewList: [], memberOtherList: [] };
		parent.nodeList.push(folder);
		folderByPath.set(path, folder);
		return folder;
	};
	for (const leaf of leafList ?? []) {
		const segmentList = String(leaf.path ?? '').split('/').filter(Boolean);
		if (segmentList.length === 0) continue;
		const parent = folderGet(segmentList.slice(0, -1));
		const memberListByDepth = leafMemberListGet(leaf, segmentList);
		const node = {
			kind: 'leaf',
			id: `leaf:${leaf.assetKey}:${(leaf.keyPath ?? []).join('.')}`,
			name: segmentList[segmentList.length - 1],
			path: segmentList.join('/'),
			depth: segmentList.length - 1,
			nodeList: [],
			leaf,
			countLeaf: 1,
			previewList: [],
			memberOtherList: [],
		};
		memberOtherAdd(node, memberListByDepth[segmentList.length - 1]);
		parent.nodeList.push(node);
		// every folder above counts it, previews it while it has room, and learns what it is a member of
		const preview = cvValuePreviewGet(leaf.value);
		for (let at = 0; at < segmentList.length; at += 1) {
			const folder = folderByPath.get(segmentList.slice(0, at).join('/'));
			folder.countLeaf += 1;
			if (folder.previewList.length < CV_INFO_PREVIEW_COUNT && preview !== '') folder.previewList.push(preview);
			if (at > 0) memberOtherAdd(folder, memberListByDepth[at - 1]);
		}
	}
	return root;
}

// the paths of every folder of a tree: what "open all" opens
export function cvInfoTreeFolderPathList(root) {
	const pathList = [];
	const walk = (node) => {
		for (const child of node.nodeList) {
			if (child.kind !== 'folder') continue;
			pathList.push(child.path);
			walk(child);
		}
	};
	walk(root);
	return pathList;
}

// the words a text is found by: split at spaces and at "/", lower case. so "name first" and the
// query name/first/jp find the same values, in whatever order their path has the words
export function cvInfoFindWordList(text) {
	return String(text ?? '').toLowerCase().split(/[\s/]+/).filter(Boolean);
}

export function cvInfoLeafIsMatch(leaf, wordList) {
	const hay = `${leaf.path} ${leaf.pathText ?? ''} ${cvValueIsImage(leaf.value) ? '' : leaf.value}`.toLowerCase();
	return wordList.every((word) => hay.includes(word));
}

// the rows drawn, top to bottom: [{ kind: 'folder' | 'leaf' | 'draft', id, node?, depth, isOpen? }]
//   isOpenByPath   the folders opened: { path: true }
//   find           words narrowing the tree to the values whose path or text holds them all;
//                  every folder on the way to one is drawn open
//   leafShownList  values drawn whatever the words say (those a query typed reads from)
//   draftPath      the folder a new value is being typed in ('' the root; undefined: none): the
//                  row of the draft is its first row, and the folders on the way to it are open
export function cvInfoTreeRowListGet(root, { isOpenByPath = {}, find = '', leafShownList = [], draftPath } = {}) {
	const wordList = cvInfoFindWordList(find);
	const isFinding = wordList.length > 0;
	const leafShownSet = new Set(leafShownList);
	const isShown = (node) => {
		if (!isFinding) return true;
		if (node.kind === 'leaf') return leafShownSet.has(node.leaf) || cvInfoLeafIsMatch(node.leaf, wordList);
		return node.nodeList.some(isShown);
	};
	const isDraftAt = (node) => draftPath !== undefined && node.path === draftPath;
	const isDraftBelow = (node) => draftPath !== undefined && (node.path === '' || draftPath === node.path || draftPath.startsWith(`${node.path}/`));
	const rowList = [];
	const walk = (node) => {
		if (isDraftAt(node)) rowList.push({ kind: 'draft', id: `draft:${node.path}`, depth: node.depth + 1 });
		for (const child of node.nodeList) {
			if (!isShown(child)) continue;
			if (child.kind === 'leaf') {
				rowList.push({ kind: 'leaf', id: child.id, node: child, depth: child.depth });
				continue;
			}
			const isOpen = isFinding || isOpenByPath[child.path] === true || isDraftBelow(child);
			rowList.push({ kind: 'folder', id: `folder:${child.path}`, node: child, depth: child.depth, isOpen });
			if (isOpen) walk(child);
		}
	};
	walk(root);
	// a draft in a folder the words hide (or that is not there) is still typed somewhere: at the top
	if (draftPath !== undefined && !rowList.some((row) => row.kind === 'draft')) rowList.unshift({ kind: 'draft', id: `draft:${draftPath}`, depth: 0 });
	return rowList;
}

// the query path of a value typed in a folder: the folder's path, then what was typed (a name,
// or several segments): ('address/jp', 'floor') -> address/jp/floor
export function cvInfoDraftPathGet(pathParent, name) {
	return [...String(pathParent ?? '').split('/'), ...String(name ?? '').split('/')].map((segment) => segment.trim()).filter(Boolean).join('/');
}
