import { cvInfoBuild, cvQueryNewProblemGet, cvQueryResolve, cvQuerySlashItemListGet } from './CvQuery.js';

// The information of a profile as its object says now: every data item of the kind "info", read
// through the object's api: { info, countLoading, countAll, problemList }.
// virtual: values no item holds (the date a CV is written at).
export const CV_KIND_INFO = 'info';
// the kind of the information, a type of the registry declared by cv.profile (type.yaml; react-doc:
// main/doc_page_impl_type.md#kinds-of-data-items): what a CV reads is items of this kind, in whatever
// object holds them and under whatever name its type gives the kind ("info" in a cv.profile)
export const CV_KIND_ID_INFO = 'cv.profile.info';
// the type of a value of a profile in react-doc's object registry, below frontend.inner
export const CV_PROFILE_VALUE_TYPE = 'cv.profile.value';

// the name an object holds a kind under: the name its type gives the kind kindId (kindList of its
// api); nameDefault when its type says nothing of its kinds (it holds anything); undefined when it
// holds no such kind
export function cvKindNameOf(object, kindId, nameDefault) {
	const kindList = object?.kindList;
	if (!Array.isArray(kindList)) return nameDefault;
	return kindList.find((one) => one.kindId === kindId)?.id;
}

// the items of information of a profile: of the kind cv.profile.info, by the name it holds it under
function cvInfoAssetListGet(profile) {
	const name = cvKindNameOf(profile, CV_KIND_ID_INFO, CV_KIND_INFO);
	return name ? profile.assetList(name) : [];
}

// The partitions of the data (doc/README.md#partitions): folders of the item folder, example/,
// real/, playground/, each holding its items and their item list, declared by the types of the
// package (type.yaml), and the first folder of every path, /example/info/name. A partition kept out
// of git takes its items and their records along. A CV reads the profile of its own partition. A
// path without a partition (/info/name) is of the partition ''.
export const CV_PARTITION_EXAMPLE = 'example';
const CV_KIND_FOLDER_LIST = ['info', 'badge', 'template', 'cv', 'we'];

// { partition, pathInPartition }: /example/info/name -> { partition: 'example', pathInPartition: '/info/name' }
export function cvPathSplit(path) {
	const partList = String(path ?? '').split('/').filter(Boolean);
	if (partList.length === 0 || CV_KIND_FOLDER_LIST.includes(partList[0])) return { partition: '', pathInPartition: `/${partList.join('/')}` };
	return { partition: partList[0], pathInPartition: `/${partList.slice(1).join('/')}` };
}

// the path of pathInPartition in a partition: (example, /info/name) -> /example/info/name
export function cvPathInPartition(partition, pathInPartition) {
	return partition ? `/${partition}${pathInPartition}` : pathInPartition;
}

// the partitions to offer, in an order that does not move when data is added: those the object has
// (declared by its type, then found), then any other the assets' paths name
export function cvPartitionListGet(service, assetList) {
	const idList = (service?.partitionList ?? []).map((one) => one.id);
	const labelById = new Map((service?.partitionList ?? []).map((one) => [one.id, one]));
	const partitionList = [...new Set([...idList, ...(assetList ?? []).map((asset) => cvPathSplit(asset.pathList?.[0]).partition)])];
	return partitionList.map((id) => ({ id, label: labelById.get(id)?.label ?? (id || '(no partition)'), isGitIgnored: labelById.get(id)?.isGitIgnored === true }));
}

// what a choice of partition says: where the data goes (groupPathInside: the folder of its kind),
// and whether git keeps it
export function cvPartitionTitleGet(partition, kindLabel, groupPathInside = '') {
	const folder = ['item', partition?.id, groupPathInside].filter(Boolean).join('/');
	if (!partition) return `${kindLabel} in ${folder}/`;
	return `${kindLabel} in ${folder}/${partition.isGitIgnored ? ', kept out of git' : ', tracked by git'}`;
}

// partition: the partition read; undefined reads every item, whatever its partition
export function cvProfileRead(profile, virtual = {}, partition = undefined) {
	const sourceList = [];
	const problemList = [];
	let countLoading = 0;
	const assetListListed = cvInfoAssetListGet(profile)
		.filter((asset) => partition === undefined || cvPathSplit(asset.pathList?.[0]).partition === partition);
	// an item the profile lists and the asset store lacks: its values are not read, and said so
	for (const asset of assetListListed) {
		if (asset.status !== 'found') problemList.push(`${asset.pathList?.[0] ?? asset.key}: ${cvAssetStatusText(asset.status)}, its values are not read`);
	}
	const assetList = assetListListed.filter((asset) => asset.status === 'found');
	for (const asset of assetList) {
		const read = profile.assetDataGet(asset.key);
		if (read.status === 'loading') {
			countLoading += 1;
			continue;
		}
		if (read.status !== 'done') {
			problemList.push(`${asset.pathList?.[0] ?? asset.key}: ${read.message}`);
			continue;
		}
		// every path of the item, each a pattern (/example/info/[addr, address]), without its partition
		const pathList = (asset.pathList ?? []).filter((path) => cvPathSplit(path).partition === cvPathSplit(asset.pathList[0]).partition).map((path) => cvPathSplit(path).pathInPartition);
		sourceList.push({ key: asset.key, label: asset.pathList?.[0] ?? asset.key, pathList: pathList.length > 0 ? pathList : [`/info/${asset.key}`], data: read.data });
	}
	const info = cvInfoBuild(sourceList, virtual);
	return { info, countLoading, countAll: assetList.length, problemList: [...problemList, ...info.problemList] };
}

// why an object cannot be read as a profile ('' when it can): its type holds no item of the kind
// cv.profile.info. any type holding the kind is read alike, cv.profile or another one
export function cvProfileHoldProblemGet(object) {
	if (cvKindNameOf(object, CV_KIND_ID_INFO, CV_KIND_INFO)) return '';
	const kindText = (object?.kindList ?? []).map((one) => one.id).join(', ') || 'nothing';
	return `holds no item of the kind ${CV_KIND_ID_INFO} (its type ${object?.object?.typeId ?? ''} holds ${kindText})`;
}

// why an asset the object lists cannot be read (its status, react-doc:
// main/doc_page_impl_obj_frontend.md#naming-and-finding-the-assets)
export function cvAssetStatusText(status) {
	if (status === 'deleted') return 'listed by the profile, and deleted';
	if (status === 'missing') return 'listed by the profile, and gone from the asset store';
	return `listed by the profile, and ${status}`;
}

// a new item of the profile in a partition: its path, and the partition the layer places it in
// (place: cvLeafPlaceGet)
// kindName: the name the profile holds the kind under (cvKindNameOf)
export function cvInfoCreateInput(partition, place, data, kindName = CV_KIND_INFO) {
	return { kind: kindName, pathList: [cvPathInPartition(partition, place.pathNew)], ...(partition ? { partition } : {}), data };
}

// the query path of a leaf: its canonical path, groups in the order the data writes them
export function cvLeafQueryGet(leaf) {
	return leaf.path;
}

// the path pattern of a leaf, as its item and keys write it: name/{jp/last/}kanji
export function cvLeafPatternGet(leaf) {
	return leaf.pathText;
}

// ---------- a profile seen from outside: its inner paths ----------
//
// What is inside a profile, for whoever names something inside a frontend object (react-doc:
// main/doc_page_impl_obj_frontend.md#things-inside-an-object-inner-paths), is its values, not its
// data items: a value is what a reader looks for, and how the data is cut into items is nobody
// else's business. So an inner path of a profile is a partition and a query path:
//
//   example/name/jp/first       the value of the query name/jp/first in the partition example
//   example/pr/jp@2             its version 2, whatever its head is (doc/cv-query.md#versions-of-a-value)
//   example/name/               completing: the folders and values below name, as /query lists them,
//                               a path nothing holds offered as a value to be made (isNew)
//
// (a profile whose items have no partition: the query alone.) The two functions below are what
// the mode Information exposes as objectInner (cv-comp.js): react-doc asks them when a
// reference such as frontend:{id}#example/name/jp/first is drawn, and when /object walks into a profile.

// { partition, query }: the first segment when it is a partition the profile has
export function cvProfileInnerSplit(profile, path) {
	const text = String(path ?? '').trim().replace(/^\/+/, '');
	const indexSlash = text.indexOf('/');
	const first = indexSlash < 0 ? text : text.slice(0, indexSlash);
	const partitionList = cvPartitionListGet(profile, cvInfoAssetListGet(profile)).map((one) => one.id).filter(Boolean);
	if (indexSlash < 0 || !partitionList.includes(first)) return { partition: '', query: text };
	return { partition: first, query: text.slice(indexSlash + 1) };
}

// what an inner path names: { status: found | unknown | loading, path, label, detail, kind, text?, typeId?, message }
export function cvProfileInnerResolve(profile, path, dateNow = new Date()) {
	const { partition, query } = cvProfileInnerSplit(profile, path);
	const pathKept = [partition, query].filter(Boolean).join('/');
	const read = cvProfileRead(profile, {}, partition);
	if (read.countLoading > 0) return { status: 'loading', path: pathKept, label: query, detail: '', kind: 'value', message: '' };
	const resolved = cvQueryResolve(read.info, query, { dateNow });
	if (resolved.status !== 'found') {
		// a path nothing holds, where a value may be made: still a value of the profile, so the
		// card of what names it is the card of a value, which is where it is typed and added
		const isMakeable = cvQueryNewProblemGet(read.info, query) === '';
		return { status: 'unknown', path: pathKept, label: query, detail: '', kind: 'value', ...(isMakeable ? { typeId: CV_PROFILE_VALUE_TYPE } : {}), message: resolved.message };
	}
	const value = String(resolved.value);
	return {
		status: 'found',
		path: pathKept,
		label: query,
		detail: partition ? `a value of the partition ${partition}` : 'a value of the profile',
		kind: 'value',
		// a type of its own below frontend.inner: its card where a token names it is
		// CvProfileValueView (react-doc: main/doc_page_impl_obj_frontend.md#things-inside-an-object-inner-paths)
		typeId: CV_PROFILE_VALUE_TYPE,
		// an image kept as text is not drawn as text: the name of the value stands for it
		...(value.startsWith('data:') ? {} : { text: value }),
		message: '',
	};
}

// the candidates completing a typed inner path: the partitions first, then what /query lists
// in the partition typed: { status, itemList: [{ kind: 'dir' | 'item', path, label, detail, isNew? }] }
// (isNew: nothing holds the path, a value is made there where the reference is worked on)
export function cvProfileInnerComplete(profile, text, dateNow = new Date()) {
	const typed = String(text ?? '').trim().replace(/^\/+/, '');
	// the partitions holding information: one declared and still empty has nothing to walk into
	const assetList = cvInfoAssetListGet(profile);
	const partitionFilledSet = new Set(assetList.map((asset) => cvPathSplit(asset.pathList?.[0]).partition));
	const partitionList = cvPartitionListGet(profile, assetList).filter((one) => one.id && partitionFilledSet.has(one.id));
	const { partition, query } = cvProfileInnerSplit(profile, typed);
	const itemList = [];
	if (!partition && !typed.includes('/')) {
		for (const one of partitionList) {
			if (typed && !one.id.startsWith(typed.toLowerCase())) continue;
			itemList.push({ kind: 'dir', path: `${one.id}/`, label: `${one.id}/`, detail: one.label });
		}
		// a profile cut into partitions is walked a partition first
		if (partitionList.length > 0) return { status: 'done', itemList };
	}
	const read = cvProfileRead(profile, {}, partition);
	if (read.countLoading > 0) return { status: 'loading', itemList };
	const prefix = partition ? `${partition}/` : '';
	for (const item of cvQuerySlashItemListGet(read.info, query, { dateNow }, 40, { isNewOffered: true })) {
		itemList.push(item.kind === 'dir'
			? { kind: 'dir', path: `${prefix}${item.paramNext}`, label: item.label, detail: item.detail }
			: { kind: 'item', path: `${prefix}${item.query}`, label: item.label, detail: item.detail, ...(item.kind === 'new' ? { isNew: true } : {}) });
	}
	return { status: 'done', itemList };
}
