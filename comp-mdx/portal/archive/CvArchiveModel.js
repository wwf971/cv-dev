import { rankBetween, rankIsValid, rankOrderCompare } from '@wwf971/react-doc/rank';

// The archive: what a person keeps of their papers, as places (doc/cv-portal.md#the-archive).
//
// The portals of the package (the desk, the archive room) show one thing in two looks. What they
// show is said here once, in words no look owns, so that either draws it, a third could, and a
// test reads it without a page:
//
//   level     what it is                              in the data                    path
//   archive   everything a papers object keeps        the object                     /
//   cabinet   where the data comes from, who sees it  a partition (example, real)    /example
//   drawer    one sort of thing kept                  a kind of data item            /example/cv
//   folder    papers kept together, in a drawer or    the item arrange of the        /example/cv/folder:{id}
//             in a folder                             partition
//   file      one thing                               a data item                    /example/cv/general
//
// A path of the archive is the path of the data item it names (the object's own asset path), so
// a place seen in a portal is the place a block of a document names, and the address of a portal
// holds it as it is. The drawers are declared (CV_ARCHIVE_DRAWER_LIST): a further sort of paper
// is one more entry there.
//
// Folders (doc/cv-portal.md#folders) are the reader's filing and nothing of a paper: one data item
// a partition (kind arrange, at /{partition}/arrange/archive) says which folders its drawers hold,
// in which folder each paper lies, and the order of everything in a drawer or a folder, by rank
// (LexoRank, react-doc's lib/doc-rank.js). A paper keeps its path wherever it is filed, so a block
// naming it still names it; a folder is named by its id, so renaming it moves nothing. A thing
// without a rank comes after the ranked ones, folders first, then the papers in the order of the
// object. Folders are of one partition: nothing is filed across partitions.
//
// Pure: it is handed what the objects say (their items, the data of those read so far) and
// answers places. Reading the objects is CvArchiveStore's.

export const CV_ARCHIVE_ROOT = '/';
export const CV_ARCHIVE_LEVEL_LIST = ['archive', 'cabinet', 'drawer', 'folder', 'file'];

// the item holding the folders of a partition: its kind, and its path in the partition
export const CV_KIND_ARRANGE = 'arrange';
export const CV_ARCHIVE_ARRANGE_PATH = '/arrange/archive';
// the name a folder is shown by while it has none of its own (grey)
export const CV_ARCHIVE_FOLDER_NAME_DEFAULT = 'New folder';
const FOLDER_SEGMENT_PREFIX = 'folder:';

// the drawers of every cabinet, in their order:
//   id          its segment in a path, and the kind of the items it holds (source papers)
//   source      'papers': data items of the papers object; 'profile': the subjects of the profile
//               the papers read (name, birth, edu, …), which is another object
//   label       how the drawer is named; labelOne: one thing of it; labelNative: its word on the paper
//   isCreatable a new thing of it is made from a portal (a paper of a form)
//   icon        a name of lucide, for a look that draws one
export const CV_ARCHIVE_DRAWER_LIST = [
	{ id: 'cv', source: 'papers', label: 'CVs', labelOne: 'CV', labelNative: '履歴書', isCreatable: true, icon: 'file-user' },
	{ id: 'we', source: 'papers', label: 'Work experiences', labelOne: 'work experience', labelNative: '職務経歴書', isCreatable: true, icon: 'briefcase' },
	{ id: 'template', source: 'papers', label: 'Templates', labelOne: 'template', labelNative: '様式', isCreatable: false, icon: 'layout-template' },
	{ id: 'profile', source: 'profile', label: 'Profile', labelOne: 'subject', labelNative: '個人情報', isCreatable: false, icon: 'user' },
];

// whether a drawer is filed in folders: the drawers of papers (the subjects of a profile are
// another object's, ordered there)
export function cvArchiveDrawerIsArranged(drawerId) {
	return cvArchiveDrawerGet(drawerId)?.source === 'papers';
}

// the path of the item holding the folders of a partition ('' for the papers of no partition)
export function cvArchiveArrangePathGet(partition) {
	return `${partition ? `/${partition}` : ''}${CV_ARCHIVE_ARRANGE_PATH}`;
}

// the partition an item arrange is of, by its path: undefined for an item at another path
export function cvArchiveArrangePartitionOf(path) {
	const pathNormal = cvArchivePathNormalize(path);
	if (pathNormal === CV_ARCHIVE_ARRANGE_PATH) return '';
	const segmentList = segmentListOf(pathNormal);
	return segmentList.length === 3 && `/${segmentList.slice(1).join('/')}` === CV_ARCHIVE_ARRANGE_PATH ? segmentList[0] : undefined;
}

// the path of a folder: in its drawer, by its id
export function cvArchiveFolderPathBuild(partition, drawerId, folderId) {
	return `${partition ? `/${partition}` : '/-'}/${drawerId}/${FOLDER_SEGMENT_PREFIX}${folderId}`;
}

export function cvArchiveDrawerGet(id) {
	return CV_ARCHIVE_DRAWER_LIST.find((drawer) => drawer.id === id);
}

function segmentListOf(path) {
	return String(path ?? '').split('/').filter(Boolean);
}

// a path as the archive keeps it: one "/" before every segment, "/" for none
export function cvArchivePathNormalize(path) {
	const segmentList = segmentListOf(path);
	return segmentList.length === 0 ? CV_ARCHIVE_ROOT : `/${segmentList.join('/')}`;
}

// the place above a path ('/' above a cabinet; undefined above the archive)
export function cvArchivePathParentGet(path) {
	const segmentList = segmentListOf(path);
	if (segmentList.length === 0) return undefined;
	return segmentList.length === 1 ? CV_ARCHIVE_ROOT : `/${segmentList.slice(0, -1).join('/')}`;
}

// The archive built from what the objects say:
//   partitionList   [{ id, label, description?, isGitIgnored? }]: the partitions, in their order
//   itemList        the data items of the papers object: [{ key, kind, name, pathList }]
//   dataGet(item)   the data of an item when it is read (undefined while it is not)
//   profile         what the profile the papers read holds, or undefined when none is named:
//                   { ref, label, subjectList: [{ partition, subject, valueCount, path }], problem? }
//   arrangeByPartition  the folders of each partition, by its id ('' for no partition), as
//                   cvArchiveArrangeRead answers them; a partition not in it has none
// answers
//   { root, placeGet(path), childListGet(path), ancestorListGet(path), parentPathGet(path),
//     isFound(path), cabinetList, fileList, countGet(path) }
// a place: { path, parentPath, level, label, labelNative?, detail, partition, drawerId?, kind?,
//   item?, folderId?, rank?, meta }; a folder's meta: { isNameDefault, childCount }
export function cvArchiveBuild({ partitionList = [], itemList = [], dataGet = () => undefined, profile, arrangeByPartition = {} } = {}) {
	const placeByPath = new Map();
	const placeAdd = (place, parentPath) => {
		if (placeByPath.has(place.path)) return placeByPath.get(place.path);
		placeByPath.set(place.path, { ...place, parentPath });
		return place;
	};
	placeAdd({ path: CV_ARCHIVE_ROOT, level: 'archive', label: 'Archive', detail: '', partition: '', meta: {} }, undefined);

	// what lies where: a paper by its path, /{partition}/{kind}/{name…}; a subject of the profile by
	// its partition
	const fileInputList = [];
	for (const item of itemList) {
		const drawer = cvArchiveDrawerGet(item.kind);
		const path = item.pathList?.[0];
		if (!drawer || drawer.source !== 'papers' || !path) continue;
		const segmentList = segmentListOf(path);
		// a path that does not start with a partition and its kind is filed by its kind, under no partition
		const isFiled = segmentList.length >= 3 && segmentList[1] === drawer.id;
		fileInputList.push({ partition: isFiled ? segmentList[0] : '', drawer, path: cvArchivePathNormalize(path), item });
	}
	for (const subject of profile?.subjectList ?? []) {
		fileInputList.push({ partition: subject.partition ?? '', drawer: cvArchiveDrawerGet('profile'), path: `/${[subject.partition, 'profile', subject.subject].filter(Boolean).join('/')}`, subject });
	}

	// a cabinet per partition holding something, in the order of the partitions; then any other the paths name
	const partitionById = new Map(partitionList.map((one) => [one.id, one]));
	const partitionIdList = [...new Set([...partitionList.map((one) => one.id), ...fileInputList.map((one) => one.partition)])]
		.filter((id) => fileInputList.some((one) => one.partition === id));
	for (const id of partitionIdList) {
		const partition = partitionById.get(id);
		placeAdd({
			path: id ? `/${id}` : '/-',
			level: 'cabinet',
			label: partition?.label || id || 'No partition',
			detail: partition?.description ?? '',
			partition: id,
			meta: { isGitIgnored: partition?.isGitIgnored === true, isDeclared: Boolean(partition) },
		}, CV_ARCHIVE_ROOT);
	}
	const cabinetPathOf = (partition) => (partition ? `/${partition}` : '/-');
	// its drawers, in their order: every drawer of a sort the archive keeps, also while it is empty,
	// so that a cabinet looks the same wherever it stands and a new paper has its place
	for (const id of partitionIdList) {
		for (const drawer of CV_ARCHIVE_DRAWER_LIST) {
			if (drawer.source === 'profile' && !profile) continue;
			placeAdd({
				path: `${cabinetPathOf(id)}/${drawer.id}`,
				level: 'drawer',
				label: drawer.label,
				labelNative: drawer.labelNative,
				detail: '',
				partition: id,
				drawerId: drawer.id,
				kind: drawer.id,
				meta: { source: drawer.source, isCreatable: drawer.isCreatable, icon: drawer.icon, ...(drawer.source === 'profile' ? { profileRef: profile.ref, profileLabel: profile.label } : {}) },
			}, cabinetPathOf(id));
		}
	}
	// the folders of each drawer: a folder under its parent when that is a folder of the same drawer
	// and no folder lies under itself, else in the drawer itself
	const folderPathByKey = new Map();
	const folderPathOfFile = new Map();
	for (const id of partitionIdList) {
		const arrange = arrangeByPartition[id];
		if (!arrange) continue;
		const folderById = new Map(arrange.folderList.map((folder) => [folder.id, folder]));
		const parentOf = (folder) => {
			const parent = folderById.get(folder.parent);
			return parent && parent.drawer === folder.drawer ? parent : undefined;
		};
		const isInItself = (folder) => {
			const seen = new Set();
			for (let at = parentOf(folder); at; at = parentOf(at)) {
				if (at.id === folder.id || seen.has(at.id)) return true;
				seen.add(at.id);
			}
			return false;
		};
		for (const folder of arrange.folderList) {
			const parent = isInItself(folder) ? undefined : parentOf(folder);
			const drawerPath = `${cabinetPathOf(id)}/${folder.drawer}`;
			const path = cvArchiveFolderPathBuild(id, folder.drawer, folder.id);
			folderPathByKey.set(`${id}\n${folder.id}`, path);
			placeAdd({
				path,
				level: 'folder',
				label: folder.name || CV_ARCHIVE_FOLDER_NAME_DEFAULT,
				detail: '',
				partition: id,
				drawerId: folder.drawer,
				kind: folder.drawer,
				folderId: folder.id,
				rank: folder.rank,
				meta: { isNameDefault: !folder.name, childCount: 0 },
			}, parent ? cvArchiveFolderPathBuild(id, folder.drawer, parent.id) : drawerPath);
		}
		for (const input of fileInputList) {
			if (input.partition !== id || !input.item) continue;
			const where = arrange.placeByKey[input.item.key];
			if (!where) continue;
			const folder = folderById.get(where.folder);
			folderPathOfFile.set(input.item.key, {
				rank: where.rank,
				folderPath: folder && folder.drawer === input.drawer.id ? folderPathByKey.get(`${id}\n${folder.id}`) : undefined,
			});
		}
	}
	for (const input of fileInputList) {
		const drawerPath = `${cabinetPathOf(input.partition)}/${input.drawer.id}`;
		if (input.subject) {
			placeAdd({
				path: input.path,
				level: 'file',
				label: input.subject.subject,
				detail: `${input.subject.valueCount} value${input.subject.valueCount === 1 ? '' : 's'}`,
				partition: input.partition,
				drawerId: 'profile',
				kind: 'profile',
				meta: { profileRef: profile.ref, subject: input.subject.subject, valueCount: input.subject.valueCount, itemPath: input.subject.path },
			}, drawerPath);
			continue;
		}
		const data = dataGet(input.item);
		const meta = cvArchiveFileMetaGet(input.drawer.id, data);
		const filed = folderPathOfFile.get(input.item.key);
		placeAdd({
			path: input.path,
			level: 'file',
			label: input.item.name || meta.name || segmentListOf(input.path).pop(),
			detail: cvArchiveFileDetailGet(input.drawer.id, meta),
			partition: input.partition,
			drawerId: input.drawer.id,
			kind: input.drawer.id,
			item: input.item,
			rank: filed?.rank ?? '',
			meta: { ...meta, isRead: data !== undefined },
		}, filed?.folderPath ?? drawerPath);
	}

	// what each place holds: in a drawer or a folder by rank (the unranked after, folders first),
	// elsewhere in the order they were declared
	const childPathListByPath = new Map([...placeByPath.keys()].map((path) => [path, []]));
	for (const place of placeByPath.values()) {
		if (place.parentPath !== undefined) childPathListByPath.get(place.parentPath)?.push(place.path);
	}
	for (const [path, childPathList] of childPathListByPath) {
		const place = placeByPath.get(path);
		if (place.level !== 'drawer' && place.level !== 'folder') continue;
		childPathList.sort((pathA, pathB) => cvArchiveEntryCompare(placeByPath.get(pathA), placeByPath.get(pathB)));
		if (place.level === 'folder') {
			place.meta.childCount = childPathList.length;
			place.detail = `${childPathList.length} item${childPathList.length === 1 ? '' : 's'}`;
		}
	}

	// every file, in the order of the archive: cabinet by cabinet, drawer by drawer, a folder where it stands
	const fileList = [];
	const countByPath = new Map();
	const walk = (path) => {
		const place = placeByPath.get(path);
		if (place.level === 'file') {
			fileList.push(place);
			countByPath.set(path, 1);
			return 1;
		}
		let count = 0;
		for (const childPath of childPathListByPath.get(path)) count += walk(childPath);
		countByPath.set(path, count);
		return count;
	};
	walk(CV_ARCHIVE_ROOT);
	const placeGet = (path) => placeByPath.get(cvArchivePathNormalize(path));
	return {
		root: CV_ARCHIVE_ROOT,
		isFound: (path) => placeByPath.has(cvArchivePathNormalize(path)),
		placeGet,
		childListGet: (path) => (childPathListByPath.get(cvArchivePathNormalize(path)) ?? []).map((childPath) => placeByPath.get(childPath)),
		// the places from the archive down to a path, itself last: through the folders it lies in; of a
		// path nothing is at, as far as places are
		ancestorListGet: (path) => {
			const place = placeGet(path);
			if (place) {
				const list = [];
				for (let at = place; at; at = at.parentPath === undefined ? undefined : placeByPath.get(at.parentPath)) list.unshift(at);
				return list;
			}
			const segmentList = segmentListOf(path);
			const list = [placeByPath.get(CV_ARCHIVE_ROOT)];
			for (let count = 1; count <= segmentList.length; count += 1) {
				const at = placeByPath.get(`/${segmentList.slice(0, count).join('/')}`);
				if (at) list.push(at);
			}
			return list;
		},
		// the place a place lies in: its folder or drawer; of a path nothing is at, the one above it
		parentPathGet: (path) => {
			const place = placeGet(path);
			return place ? place.parentPath : cvArchivePathParentGet(path);
		},
		cabinetList: (childPathListByPath.get(CV_ARCHIVE_ROOT) ?? []).map((childPath) => placeByPath.get(childPath)),
		fileList,
		countGet: (path) => countByPath.get(cvArchivePathNormalize(path)) ?? 0,
	};
}

// the order of two things in a drawer or a folder: by rank, the unranked after; of two unranked, a
// folder before a paper, else as they came (the sort is stable)
export function cvArchiveEntryCompare(placeA, placeB) {
	const byRank = rankOrderCompare(placeA.rank, placeB.rank);
	if (byRank !== 0 || rankIsValid(placeA.rank)) return byRank;
	return (placeB.level === 'folder' ? 1 : 0) - (placeA.level === 'folder' ? 1 : 0);
}

// what the data of a paper or a template says of it, for a list: read defensively, every key optional
export function cvArchiveFileMetaGet(drawerId, data) {
	const source = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
	const text = (value) => (typeof value === 'string' ? value : '');
	if (drawerId === 'template') return { name: text(source.name), form: text(source.form) || 'cv', sectionCount: Array.isArray(source.sectionList) ? source.sectionList.length : 0 };
	return {
		name: text(source.name),
		template: text(source.template),
		profile: text(source.profile),
		asOf: text(source.asOf),
		// what this paper says of its own: cells typed here, parts added here
		cellOwnCount: source.valueByCell && typeof source.valueByCell === 'object' ? Object.keys(source.valueByCell).length : 0,
		sectionOwnCount: Array.isArray(source.sectionExtraList) ? source.sectionExtraList.length : 0,
	};
}

function cvArchiveFileDetailGet(drawerId, meta) {
	if (drawerId === 'template') return `${meta.form === 'we' ? 'work experience' : 'CV'} · ${meta.sectionCount} part${meta.sectionCount === 1 ? '' : 's'}`;
	return [meta.asOf ? `as of ${meta.asOf}` : '', meta.cellOwnCount > 0 ? `${meta.cellOwnCount} cell${meta.cellOwnCount === 1 ? '' : 's'} of its own` : ''].filter(Boolean).join(' · ');
}

// the files whose name, path, folders, drawer or cabinet hold every word typed, in the order of the archive
export function cvArchiveSearch(archive, text) {
	const wordList = String(text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
	if (wordList.length === 0) return [];
	return archive.fileList.filter((file) => {
		const cabinet = archive.placeGet(file.partition ? `/${file.partition}` : '/-');
		const drawer = cvArchiveDrawerGet(file.drawerId);
		const folderText = archive.ancestorListGet(file.path).filter((place) => place.level === 'folder' && !place.meta.isNameDefault).map((place) => place.label).join(' ');
		const hay = `${file.label} ${file.path} ${file.detail} ${folderText} ${drawer?.label ?? ''} ${drawer?.labelNative ?? ''} ${cabinet?.label ?? ''}`.toLowerCase();
		return wordList.every((word) => hay.includes(word));
	});
}

// a path a new paper of a drawer would lie at, from its name: letters, digits and "-" of what it
// says (what remains is in the item's name), a number when nothing remains or the path is taken
export function cvArchivePaperPathBuild(archive, partition, drawerId, name) {
	const base = String(name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
	const folder = `${partition ? `/${partition}` : ''}/${drawerId}`;
	const isTaken = (path) => archive.isFound(path);
	if (base && !isTaken(`${folder}/${base}`)) return `${folder}/${base}`;
	let count = base ? 2 : archive.countGet(`${partition ? `/${partition}` : '/-'}/${drawerId}`) + 1;
	while (isTaken(`${folder}/${base ? `${base}-` : ''}${count}`)) count += 1;
	return `${folder}/${base ? `${base}-` : ''}${count}`;
}

// ---------- folders: the item arrange of a partition (doc/cv-portal.md#folders) ----------

// what an item arrange says, read defensively: folders of a drawer of papers with an id each (the
// first of an id kept), where papers lie by the key of their item; a rank that is none is no rank
//   { folderList: [{ id, name, drawer, parent, rank }], placeByKey: { [key]: { folder, rank } } }
export function cvArchiveArrangeRead(data) {
	const isMap = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
	const text = (value) => (typeof value === 'string' ? value : '');
	const rank = (value) => (rankIsValid(value) ? value : '');
	const source = isMap(data) ? data : {};
	const folderList = [];
	const idSeen = new Set();
	for (const one of Array.isArray(source.folderList) ? source.folderList : []) {
		if (!isMap(one) || !text(one.id) || idSeen.has(one.id) || !cvArchiveDrawerIsArranged(one.drawer)) continue;
		idSeen.add(one.id);
		folderList.push({ id: one.id, name: text(one.name), drawer: one.drawer, parent: text(one.parent), rank: rank(one.rank) });
	}
	const placeByKey = {};
	for (const [key, where] of Object.entries(isMap(source.placeByKey) ? source.placeByKey : {})) {
		if (isMap(where)) placeByKey[key] = { folder: text(where.folder), rank: rank(where.rank) };
	}
	return { folderList, placeByKey };
}

// the data an item arrange is written with: what is said, nothing empty. keyList: the keys of the
// papers of the partition; a paper that is gone is left out
export function cvArchiveArrangeDataBuild(arrange, { keyList } = {}) {
	const keySet = keyList ? new Set(keyList) : undefined;
	const placeByKey = {};
	for (const [key, where] of Object.entries(arrange.placeByKey ?? {})) {
		if (keySet && !keySet.has(key)) continue;
		const one = { ...(where.folder ? { folder: where.folder } : {}), ...(where.rank ? { rank: where.rank } : {}) };
		if (Object.keys(one).length > 0) placeByKey[key] = one;
	}
	return {
		folderList: (arrange.folderList ?? []).map((folder) => ({
			id: folder.id,
			...(folder.name ? { name: folder.name } : {}),
			drawer: folder.drawer,
			...(folder.parent ? { parent: folder.parent } : {}),
			...(folder.rank ? { rank: folder.rank } : {}),
		})),
		placeByKey,
	};
}

// count ranks spread evenly over the whole range, in order: as few digits as there is room in
export function cvArchiveRankSpread(count) {
	if (count <= 0) return [];
	let width = 1;
	while (36 ** width < count + 1) width += 1;
	const size = 36 ** width;
	return Array.from({ length: count }, (unused, index) => Math.floor(((index + 1) * size) / (count + 1)).toString(36).padStart(width, '0').replace(/0+$/, ''));
}

// count ranks between two, in order; undefined when there is none (a neighbour without a rank)
function rankListBetween(rankBefore, rankAfter, count) {
	const list = [];
	let before = rankBefore;
	for (let index = 0; index < count; index += 1) {
		const result = rankBetween(before, rankAfter);
		if (result.code !== 0) return undefined;
		list.push(result.data);
		before = result.data;
	}
	return list;
}

// a thing of a drawer as the item arrange names it: a folder by its id, a paper by its key
function entryRefOf(place) {
	return place.level === 'folder' ? { folderId: place.folderId } : { key: place.item?.key };
}

function entryRefIsSame(refA, refB) {
	return refA.folderId ? refA.folderId === refB.folderId : Boolean(refA.key) && refA.key === refB.key;
}

// an arrange where a thing lies in a folder ('' the drawer itself) at a rank
function arrangeEntrySet(arrange, ref, folderId, rank) {
	if (ref.folderId) {
		arrange.folderList = arrange.folderList.map((folder) => (folder.id === ref.folderId ? { ...folder, parent: folderId, rank } : folder));
	} else if (ref.key) {
		arrange.placeByKey = { ...arrange.placeByKey, [ref.key]: { folder: folderId, rank } };
	}
}

// things put in a place at an index of what else it holds: a rank between their neighbours for each,
// or, when a neighbour has none (nothing was ordered yet) or there is no room, every thing of the
// place ranked anew in its order
function arrangeRankWrite(arrange, { siblingList, index, refList, folderId }) {
	const next = { folderList: [...arrange.folderList], placeByKey: { ...arrange.placeByKey } };
	const at = Math.max(0, Math.min(index ?? siblingList.length, siblingList.length));
	const before = at > 0 ? siblingList[at - 1].rank : '';
	const after = at < siblingList.length ? siblingList[at].rank : '';
	const isNeighbourUnranked = (at > 0 && !rankIsValid(before)) || (at < siblingList.length && !rankIsValid(after));
	const rankList = isNeighbourUnranked ? undefined : rankListBetween(before, after, refList.length);
	if (rankList) {
		refList.forEach((ref, order) => arrangeEntrySet(next, ref, folderId, rankList[order]));
		return next;
	}
	const orderList = [...siblingList.slice(0, at).map(entryRefOf), ...refList, ...siblingList.slice(at).map(entryRefOf)];
	const spread = cvArchiveRankSpread(orderList.length);
	orderList.forEach((ref, order) => arrangeEntrySet(next, ref, folderId, spread[order]));
	return next;
}

// the place things can be filed in: a drawer of papers or a folder of one
function arrangeTargetGet(archive, parentPath) {
	const target = archive.placeGet(parentPath);
	if (!target || (target.level !== 'drawer' && target.level !== 'folder')) return { message: 'Things are filed in a drawer or a folder.' };
	if (!cvArchiveDrawerIsArranged(target.drawerId)) return { message: `${cvArchiveDrawerGet(target.drawerId)?.label ?? 'This drawer'} is not filed in folders.` };
	return { target, folderId: target.level === 'folder' ? target.folderId : '' };
}

// why things cannot be put in a place, '' when they can: of the same partition and drawer, a folder
// never in itself
export function cvArchiveMoveProblemGet(archive, pathList, parentPath) {
	const { target, message } = arrangeTargetGet(archive, parentPath);
	if (!target) return message;
	const ancestorPathSet = new Set(archive.ancestorListGet(target.path).map((place) => place.path));
	for (const path of pathList) {
		const place = archive.placeGet(path);
		if (!place || (place.level !== 'folder' && place.level !== 'file')) return `${path}: only papers and folders are moved.`;
		if (place.partition !== target.partition) return `${place.label}: papers are not moved to another partition.`;
		if (place.drawerId !== target.drawerId) return `${place.label}: a ${cvArchiveDrawerGet(place.drawerId)?.labelOne ?? 'paper'} stays in its drawer.`;
		if (place.level === 'folder' && ancestorPathSet.has(place.path)) return `${place.label}: a folder is not put in itself.`;
	}
	return '';
}

// things moved into a drawer or a folder, at an index of what it holds without them (the end when
// not said): -> { code: 0, data: arrange } | { code: -1, message }
export function cvArchiveArrangeMove(archive, arrange, pathList, { parentPath, index } = {}) {
	const problem = cvArchiveMoveProblemGet(archive, pathList, parentPath);
	if (problem) return { code: -1, message: problem };
	const { target, folderId } = arrangeTargetGet(archive, parentPath);
	const refList = pathList.map((path) => entryRefOf(archive.placeGet(path)));
	const siblingList = archive.childListGet(target.path).filter((place) => !refList.some((ref) => entryRefIsSame(ref, entryRefOf(place))));
	return { code: 0, data: arrangeRankWrite(arrange, { siblingList, index, refList, folderId }) };
}

// a folder made in a drawer or a folder, first in it: -> { code: 0, data: arrange } | { code: -1, message }
export function cvArchiveArrangeFolderCreate(archive, arrange, { parentPath, id, name = '' }) {
	const { target, folderId, message } = arrangeTargetGet(archive, parentPath);
	if (!target) return { code: -1, message };
	if (!id || arrange.folderList.some((folder) => folder.id === id)) return { code: -1, message: `the folder id "${id}" is taken` };
	const made = { ...arrange, folderList: [...arrange.folderList, { id, name: String(name ?? '').trim(), drawer: target.drawerId, parent: folderId, rank: '' }] };
	return { code: 0, data: arrangeRankWrite(made, { siblingList: archive.childListGet(target.path), index: 0, refList: [{ folderId: id }], folderId }) };
}

export function cvArchiveArrangeFolderRename(arrange, folderId, name) {
	if (!arrange.folderList.some((folder) => folder.id === folderId)) return { code: -1, message: 'the folder is gone' };
	return { code: 0, data: { ...arrange, folderList: arrange.folderList.map((folder) => (folder.id === folderId ? { ...folder, name: String(name ?? '').trim() } : folder)) } };
}

// a folder taken away: what it holds stays where it stood, in its order; nothing else is removed
export function cvArchiveArrangeFolderRemove(archive, arrange, folderPath) {
	const folder = archive.placeGet(folderPath);
	if (!folder || folder.level !== 'folder') return { code: -1, message: 'the folder is gone' };
	const parent = archive.placeGet(folder.parentPath);
	const siblingList = archive.childListGet(parent.path).filter((place) => place.path !== folder.path);
	const index = archive.childListGet(parent.path).findIndex((place) => place.path === folder.path);
	const without = { ...arrange, folderList: arrange.folderList.filter((one) => one.id !== folder.folderId) };
	const memberList = archive.childListGet(folder.path);
	if (memberList.length === 0) return { code: 0, data: without };
	const orderList = [...siblingList.slice(0, index), ...memberList, ...siblingList.slice(index)];
	const next = { folderList: [...without.folderList], placeByKey: { ...without.placeByKey } };
	const spread = cvArchiveRankSpread(orderList.length);
	orderList.forEach((place, order) => arrangeEntrySet(next, entryRefOf(place), parent.level === 'folder' ? parent.folderId : '', spread[order]));
	return { code: 0, data: next };
}
