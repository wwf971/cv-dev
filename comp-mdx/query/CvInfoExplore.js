import { assetPathCanonicalGet, assetPathRestList } from '@wwf971/react-doc/asset-path';
import { cvSegmentNormalize } from './CvQuery.js';
import { CV_INFO_PREVIEW_COUNT, cvInfoFindWordList, cvInfoLeafIsMatch, cvValuePreviewGet } from './CvInfoTree.js';

// The values of a profile walked as a file explorer walks folders (doc/cv-query.md#the-mode-information):
// a path walked so far, and the items next to it. Pure: no store, no React.
//
// What comes next is read off the patterns of the values, not off their canonical paths, so an
// unordered group is one item, as it is written, and any of its members is a way forward:
//
//   at name                                             at name/last (jp walked second)
//     {jp · last}    3   山田 · やまだ · Yamada             jp          3   山田 · やまだ · Yamada
//     {jp · first}   3   太郎 · たろう · Taro               en              Yamada
//     {en · last}        Yamada
//     {en · first}       Taro
//
// "jp" of the first item leads to name/jp, where last and first are plain folders; "last" leads
// to name/last, where jp is a folder and en a value. A group ending the path ({en, last}) is an
// item holding the value itself. The path walked is in the order it was walked, which is one of
// the orders a query may have.
//
// an item: { id, kind: 'folder' | 'leaf', isGroup, memberList, pathNextList, leaf?, countLeaf, previewList }
//   memberList    what stands next, each a way forward: [{ label, segmentList }]. one for a plain
//                 segment; the members of a group, which come in any order; none for a value
//                 lying at the path walked itself
//   pathNextList  the path after the whole item (a group: its members in the order written)
//   leaf          the value, when the item ends its path

// the elements left, with a choice at their head taken by its first alternative: a choice says
// other names of the same thing, and the explorer walks the first
function headResolve(elementList) {
	let list = elementList;
	while (list.length > 0 && (list[0].kind === 'choice' || list[0].kind === 'sequence')) {
		const [head, ...tail] = list;
		const inner = head.kind === 'choice' ? head.alternativeList[0] : head;
		list = [...(inner.kind === 'sequence' ? inner.elementList : [inner]), ...tail];
	}
	return list;
}

const memberOf = (node) => {
	const segmentList = assetPathCanonicalGet(node).map((one) => one.name);
	return { label: segmentList.join('/'), segmentList };
};

// { segmentList, itemList, countLeaf }: what lies at a path walked (segmentList, [] the top)
export function cvInfoExploreGet(info, segmentListInput = []) {
	const segmentList = segmentListInput.map((segment) => String(segment).trim()).filter(Boolean);
	const itemList = [];
	const folderByKey = new Map();
	let countLeaf = 0;
	for (const leaf of info?.leafList ?? []) {
		// a virtual value (the date of a CV) has no item
		if (!leaf.node || !leaf.assetKey) continue;
		const restList = assetPathRestList(leaf.node, segmentList, { segmentNormalize: cvSegmentNormalize });
		if (restList.length === 0) continue;
		countLeaf += 1;
		const rest = headResolve(restList[0]);
		const head = rest[0];
		const memberList = !head ? [] : head.kind === 'group' ? head.memberList.map(memberOf) : [memberOf(head)];
		const pathNextList = [...segmentList, ...memberList.flatMap((member) => member.segmentList)];
		const isGroup = head?.kind === 'group';
		if (rest.length <= 1) {
			itemList.push({ id: `leaf:${leaf.assetKey}:${(leaf.keyPath ?? []).join('.')}`, kind: 'leaf', isGroup, memberList, pathNextList, leaf, countLeaf: 1, previewList: [] });
			continue;
		}
		// the values going on through the same step share its item: the members, whatever their order
		const key = `${isGroup ? 'group' : 'segment'}:${memberList.map((member) => cvSegmentNormalize(member.label)).sort().join('\u0000')}`;
		let folder = folderByKey.get(key);
		if (!folder) {
			folder = { id: `folder:${key}`, kind: 'folder', isGroup, memberList, pathNextList, countLeaf: 0, previewList: [] };
			folderByKey.set(key, folder);
			itemList.push(folder);
		}
		folder.countLeaf += 1;
		const preview = cvValuePreviewGet(leaf.value);
		if (folder.previewList.length < CV_INFO_PREVIEW_COUNT && preview !== '') folder.previewList.push(preview);
	}
	return { segmentList, itemList, countLeaf };
}

// the values found by words, as a flat list: an explorer searching shows what it found with
// where it lies. [{ id, leaf, pathParentList, name }]
//   leafShownList   values listed whatever the words say (those a query typed reads from)
export function cvInfoFindListGet(info, find, leafShownList = []) {
	const wordList = cvInfoFindWordList(find);
	if (wordList.length === 0) return [];
	const leafShownSet = new Set(leafShownList);
	return (info?.leafList ?? [])
		.filter((leaf) => leaf.assetKey && (leafShownSet.has(leaf) || cvInfoLeafIsMatch(leaf, wordList)))
		.map((leaf) => {
			const segmentList = String(leaf.path ?? '').split('/').filter(Boolean);
			return { id: `leaf:${leaf.assetKey}:${(leaf.keyPath ?? []).join('.')}`, leaf, pathParentList: segmentList.slice(0, -1), name: segmentList[segmentList.length - 1] ?? '' };
		});
}
