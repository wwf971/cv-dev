import { cvInfoBuild } from './CvQuery.js';

// The information of a profile as its object says now: every data item of the kind "info", read
// through the object's api: { info, countLoading, countAll, problemList }.
// virtual: values no item holds (the date a CV is written at).
export const CV_KIND_INFO = 'info';

// The partitions of the data (doc/README.md#partitions): folders of the item folder, example/,
// real/, playground/, each holding its items and their item list, declared by the types of the
// package (type.yaml), and the first folder of every path, /example/info/name. A partition kept out
// of git takes its items and their records along. A CV reads the profile of its own partition. A
// path without a partition (/info/name) is of the partition ''.
export const CV_PARTITION_EXAMPLE = 'example';
const CV_KIND_FOLDER_LIST = ['info', 'template', 'instance'];

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
	const assetList = profile.assetList(CV_KIND_INFO)
		.filter((asset) => asset.status === 'found')
		.filter((asset) => partition === undefined || cvPathSplit(asset.pathList?.[0]).partition === partition);
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

// a new item of the profile in a partition: its path, and the partition the layer places it in
// (place: cvLeafPlaceGet)
export function cvInfoCreateInput(partition, place, data) {
	return { kind: CV_KIND_INFO, pathList: [cvPathInPartition(partition, place.pathNew)], ...(partition ? { partition } : {}), data };
}

// the query path of a leaf: its canonical path, groups in the order the data writes them
export function cvLeafQueryGet(leaf) {
	return leaf.path;
}

// the path pattern of a leaf, as its item and keys write it: name/{jp/last/}kanji
export function cvLeafPatternGet(leaf) {
	return leaf.pathText;
}
