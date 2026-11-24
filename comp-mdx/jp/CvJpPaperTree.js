import { CV_JP_FORM_LIST, CV_KIND_PART, CV_KIND_TEMPLATE, cvJpPartRead } from './CvJpData.js';

// The places of the mode Papers (CvJpList.jsx, doc/cv-sheet.md#the-papers), walked by the path bar
// of the switch layer of react-doc's package cloud-dev-vis (PathNav.js: a path-based view). They are
// the object's own asset paths, so a path seen here is the path a block names:
//
//   /                               every paper and template of the object
//   /{partition}                    those of a partition
//   /{partition}/{cv | we}          the papers of a form; /{partition}/template its templates
//   /{partition}/{cv | we}/{name}   a paper, drawn on its sheet
//   /{partition}/part               the parts a paper may be made of: a gallery (CvJpPartGallery.jsx)
//   /{partition}/part/{form}:{id}   a part of a form (cv-jp:basic-no-photo), drawn at the top of a page
//   /{partition}/part/{name}        a part template of the object (its item's path), likewise
//
// A paper is a place, and so is a part. A template is listed where it lies but is no place: nothing
// draws one alone.

export const CV_PAPER_ROOT = '/';
// the top has no name of its own: the bar draws it as a house, and these words are its title
const CV_PAPER_ROOT_LABEL = 'Every paper and template';

// the word of a folder named by what it holds: CVs, Work experiences, Templates
const CV_PAPER_FOLDER_LABEL = {
	...Object.fromEntries(CV_JP_FORM_LIST.map((form) => [form.kind, form.labelPlural])),
	[CV_KIND_TEMPLATE]: 'Templates',
	[CV_KIND_PART]: 'Parts',
};
const CV_PAPER_FOLDER_ORDER = [...CV_JP_FORM_LIST.map((form) => form.kind), CV_KIND_TEMPLATE];

// the folders of a path, the top first: /example/cv/a -> [/example, /example/cv]
function folderListOf(path) {
	const partList = String(path ?? '').split('/').filter(Boolean);
	return partList.slice(0, -1).map((_, index) => `/${partList.slice(0, index + 1).join('/')}`);
}

function segmentLastOf(path) {
	return String(path ?? '').split('/').filter(Boolean).pop() ?? '';
}

// whether an asset lies at or below a place
export function cvPaperIsUnder(assetPath, path) {
	if (!assetPath) return false;
	if (path === CV_PAPER_ROOT) return true;
	return assetPath === path || assetPath.startsWith(`${path}/`);
}

// the tree of places of an object:
//   paperList      its papers ({ key, kind, name, pathList }), in the order the object lists them
//   templateList   its templates, likewise
//   partList       its part templates (kind part), with partDataGet(asset): their data as read
//   partitionList  [{ id, label }]: the words of the partitions, in their order (cvPartitionListGet)
//   nameOf(asset)  the name a paper is listed by (its item's, else its data's)
// answers { placeGet(path), childListGet(path), labelGet(path), isFound(path), root }: a provider
// of a path-based view, with what each place is (placeGet: { kind, path, label, asset? })
export function cvPaperTreeBuild({ paperList = [], templateList = [], partList = [], partDataGet = () => undefined, partitionList = [], nameOf = (asset) => asset.name }) {
	const placeByPath = new Map([[CV_PAPER_ROOT, { kind: 'root', path: CV_PAPER_ROOT, label: CV_PAPER_ROOT_LABEL }]]);
	const childPathListByPath = new Map([[CV_PAPER_ROOT, []]]);
	const partitionLabelById = new Map(partitionList.map((one) => [one.id, one.label]));
	const placeAdd = (place, parent) => {
		if (placeByPath.has(place.path)) return;
		placeByPath.set(place.path, place);
		childPathListByPath.set(place.path, []);
		childPathListByPath.get(parent)?.push(place.path);
	};
	// the folders of a path: the first is a partition, one named by a kind holds what that kind is
	const folderListAdd = (path) => {
		let parent = CV_PAPER_ROOT;
		for (const [index, folder] of folderListOf(path).entries()) {
			const segment = segmentLastOf(folder);
			const label = index === 0 && partitionLabelById.has(segment) ? partitionLabelById.get(segment) : (CV_PAPER_FOLDER_LABEL[segment] ?? segment);
			placeAdd({ kind: index === 0 ? 'partition' : 'folder', path: folder, label, segment }, parent);
			parent = folder;
		}
		return parent;
	};
	// the partitions first, in their own order, so that the menu of the top does not move as papers come
	for (const partition of partitionList) {
		const path = `/${partition.id}`;
		if (partition.id && [...paperList, ...templateList].some((asset) => cvPaperIsUnder(asset.pathList?.[0], path))) placeAdd({ kind: 'partition', path, label: partition.label, segment: partition.id }, CV_PAPER_ROOT);
	}
	// the folders of the forms in their order (CVs, work experiences, templates), whatever comes first
	const assetSorted = [...paperList, ...templateList].sort((a, b) => cvPaperFolderRankOf(a) - cvPaperFolderRankOf(b));
	for (const asset of assetSorted) folderListAdd(asset.pathList?.[0]);
	for (const asset of paperList) {
		const path = asset.pathList?.[0];
		if (!path) continue;
		placeAdd({ kind: 'paper', path, label: nameOf(asset) || segmentLastOf(path), asset }, folderListAdd(path));
	}
	// the parts of every partition shown: their folder, the gallery, holding the parts of the forms (one
	// place each, named by its form and its id) and the part templates lying there (at their path)
	const partFolderOf = (partition) => `/${partition}/${CV_KIND_PART}`;
	for (const partition of partitionList) {
		if (!placeByPath.has(`/${partition.id}`)) continue;
		const folder = partFolderOf(partition.id);
		placeAdd({ kind: 'parts', path: folder, label: CV_PAPER_FOLDER_LABEL[CV_KIND_PART], segment: CV_KIND_PART, partition: partition.id }, `/${partition.id}`);
		for (const form of CV_JP_FORM_LIST) {
			for (const part of form.partList ?? []) {
				placeAdd({ kind: 'part', path: `${folder}/${form.id}:${part.id}`, label: part.label, partition: partition.id, part: { key: `form:${part.id}`, label: part.label, form: form.kind, section: part.section, source: 'form' } }, folder);
			}
		}
	}
	for (const asset of partList) {
		const path = asset.pathList?.[0];
		const partition = String(path ?? '').split('/').filter(Boolean)[0] ?? '';
		if (!path || !placeByPath.has(partFolderOf(partition)) || !cvPaperIsUnder(path, partFolderOf(partition))) continue;
		const read = cvJpPartRead(partDataGet(asset));
		if (!read) continue;
		const label = read.name || asset.name || segmentLastOf(path);
		placeAdd({ kind: 'part', path, label, partition, asset, part: { key: `object:${asset.key}`, label, form: read.form, section: read.section, source: 'object', path } }, folderListAdd(path));
	}
	const countUnder = (path) => [...paperList, ...templateList].filter((asset) => cvPaperIsUnder(asset.pathList?.[0], path)).length;
	const partCountUnder = (path) => [...placeByPath.values()].filter((place) => place.kind === 'part' && cvPaperIsUnder(place.path, path)).length;
	const isFound = (path) => placeByPath.has(path);
	return {
		root: CV_PAPER_ROOT,
		isFound,
		placeGet: (path) => placeByPath.get(path),
		labelGet: (path) => placeByPath.get(path)?.label ?? segmentLastOf(path),
		childListGet: (path) => (childPathListByPath.get(path) ?? []).map((childPath) => {
			const place = placeByPath.get(childPath);
			if (place.kind === 'part') return { path: childPath, label: place.label, description: place.part.source === 'object' ? childPath : `a part of a ${CV_JP_FORM_LIST.find((form) => form.kind === place.part.form)?.label ?? 'paper'}` };
			if (place.kind === 'parts') {
				const count = partCountUnder(childPath);
				return { path: childPath, label: place.label, description: `${count} ${count === 1 ? 'part' : 'parts'}` };
			}
			const count = place.kind === 'paper' ? 0 : countUnder(childPath);
			return { path: childPath, label: place.label, description: place.kind === 'paper' ? childPath : `${count} ${count === 1 ? 'item' : 'items'}` };
		}),
	};
}

// where the folder of an asset's kind stands among the others: a paper's form, then the templates
function cvPaperFolderRankOf(asset) {
	const index = CV_PAPER_FOLDER_ORDER.indexOf(asset.kind);
	return index < 0 ? CV_PAPER_FOLDER_ORDER.length : index;
}
