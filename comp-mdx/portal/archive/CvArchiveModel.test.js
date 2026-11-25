import assert from 'node:assert/strict';
import test from 'node:test';
import { rankCompare, rankIsValid } from '@wwf971/react-doc/rank';
import {
	CV_ARCHIVE_DRAWER_LIST, cvArchiveArrangeDataBuild, cvArchiveArrangeFolderCreate, cvArchiveArrangeFolderRemove, cvArchiveArrangeFolderRename,
	cvArchiveArrangeMove, cvArchiveArrangePathGet, cvArchiveArrangeRead, cvArchiveBuild, cvArchiveFileMetaGet, cvArchiveMoveProblemGet,
	cvArchivePaperPathBuild, cvArchivePathNormalize, cvArchivePathParentGet, cvArchiveRankSpread, cvArchiveSearch,
} from './CvArchiveModel.js';

// The archive as places (doc/cv-portal.md#the-archive): what both portals draw.

const partitionList = [
	{ id: 'example', label: 'Example', description: 'the made-up person' },
	{ id: 'real', label: 'My data', isGitIgnored: true },
	{ id: 'playground', label: 'Playground', isGitIgnored: true },
];
const itemList = [
	{ key: 'cv-1', kind: 'cv', name: '履歴書（汎用）', pathList: ['/example/cv/general'] },
	{ key: 'cv-2', kind: 'cv', name: '履歴書（外資系企業向け）', pathList: ['/example/cv/foreign-affiliated'] },
	{ key: 'we-1', kind: 'we', name: '職務経歴書（汎用）', pathList: ['/example/we/general'] },
	{ key: 't-1', kind: 'template', name: '履歴書 標準様式', pathList: ['/example/template/cv-jp-standard'] },
	{ key: 'v-1', kind: 'view', name: 'the table', pathList: ['/example/view/papers'] },
	{ key: 'cv-3', kind: 'cv', name: '2026', pathList: ['/real/cv/2026'] },
	{ key: 'cv-4', kind: 'cv', name: 'loose', pathList: ['/cv/loose'] },
	{ key: 'cv-5', kind: 'cv', name: 'no path' },
];
const dataByKey = {
	'cv-1': { name: '履歴書（汎用）', template: '/example/template/cv-jp-standard', asOf: '2026-11-08', valueByCell: { a: 'x', b: 'y' } },
	't-1': { name: '履歴書 標準様式', form: 'cv', sectionList: [{}, {}, {}] },
};
const profile = {
	ref: 'frontend:w5pbeilkczg',
	label: 'Profile',
	subjectList: [
		{ partition: 'example', subject: 'name', valueCount: 8, path: '/example/info/name' },
		{ partition: 'example', subject: 'edu', valueCount: 12, path: '/example/info/edu' },
		{ partition: 'real', subject: 'name', valueCount: 4, path: '/real/info/name' },
	],
};
const archive = cvArchiveBuild({ partitionList, itemList, dataGet: (item) => dataByKey[item.key], profile });

test('a cabinet per partition holding something, in the order of the partitions', () => {
	assert.deepEqual(archive.cabinetList.map((one) => [one.path, one.label, one.meta.isGitIgnored]), [['/example', 'Example', false], ['/real', 'My data', true], ['/-', 'No partition', false]]);
	assert.equal(archive.placeGet('/playground'), undefined);
	assert.equal(archive.placeGet('/').level, 'archive');
});

test('every cabinet has the drawers of the archive, also the empty ones', () => {
	assert.deepEqual(archive.childListGet('/example').map((one) => [one.path, one.label, one.level]), CV_ARCHIVE_DRAWER_LIST.map((drawer) => [`/example/${drawer.id}`, drawer.label, 'drawer']));
	assert.deepEqual(archive.childListGet('/real/we'), []);
	assert.equal(archive.placeGet('/real/we').meta.isCreatable, true);
	assert.equal(archive.placeGet('/example/profile').meta.profileRef, 'frontend:w5pbeilkczg');
	// without a profile named, no drawer of one
	const without = cvArchiveBuild({ partitionList, itemList });
	assert.deepEqual(without.childListGet('/example').map((one) => one.drawerId), ['cv', 'we', 'template']);
});

test('a file lies at the path of its data item; what the archive keeps no drawer for is left out', () => {
	assert.deepEqual(archive.childListGet('/example/cv').map((one) => [one.path, one.label]), [['/example/cv/general', '履歴書（汎用）'], ['/example/cv/foreign-affiliated', '履歴書（外資系企業向け）']]);
	assert.equal(archive.placeGet('/example/view/papers'), undefined);
	// a path without a partition is filed by its kind, under no partition
	assert.deepEqual(archive.childListGet('/-/cv').map((one) => one.path), ['/cv/loose']);
	assert.equal(archive.fileList.some((file) => file.label === 'no path'), false);
	const file = archive.placeGet('/example/cv/general');
	assert.equal(file.level, 'file');
	assert.equal(file.item.key, 'cv-1');
	assert.equal(file.detail, 'as of 2026-11-08 · 2 cells of its own');
	assert.equal(file.meta.template, '/example/template/cv-jp-standard');
	assert.equal(file.meta.isRead, true);
	// a paper not read yet is listed by what its record says
	assert.equal(archive.placeGet('/example/we/general').meta.isRead, false);
	assert.equal(archive.placeGet('/example/template/cv-jp-standard').detail, 'CV · 3 parts');
});

test('the subjects of the profile are the files of its drawer', () => {
	assert.deepEqual(archive.childListGet('/example/profile').map((one) => [one.path, one.label, one.detail]), [['/example/profile/name', 'name', '8 values'], ['/example/profile/edu', 'edu', '12 values']]);
	assert.equal(archive.placeGet('/real/profile/name').meta.itemPath, '/real/info/name');
});

test('counts, the way down to a place, and the place above', () => {
	assert.equal(archive.countGet('/'), 9);
	assert.equal(archive.countGet('/example'), 6);
	assert.equal(archive.countGet('/example/cv'), 2);
	assert.equal(archive.countGet('/example/cv/general'), 1);
	assert.deepEqual(archive.ancestorListGet('/example/cv/general').map((one) => one.path), ['/', '/example', '/example/cv', '/example/cv/general']);
	// of a path nothing is at, as far as places are
	assert.deepEqual(archive.ancestorListGet('/example/cv/gone').map((one) => one.path), ['/', '/example', '/example/cv']);
	assert.equal(cvArchivePathParentGet('/example/cv/general'), '/example/cv');
	assert.equal(cvArchivePathParentGet('/example'), '/');
	assert.equal(cvArchivePathParentGet('/'), undefined);
	assert.equal(cvArchivePathNormalize('example//cv/'), '/example/cv');
	assert.equal(cvArchivePathNormalize(''), '/');
	assert.equal(archive.isFound('example/cv'), true);
});

test('a search finds files by every word: a name, a path, a drawer, a cabinet', () => {
	assert.deepEqual(cvArchiveSearch(archive, '汎用').map((one) => one.path), ['/example/cv/general', '/example/we/general']);
	assert.deepEqual(cvArchiveSearch(archive, '履歴書 外資').map((one) => one.path), ['/example/cv/foreign-affiliated']);
	assert.deepEqual(cvArchiveSearch(archive, 'my data cv').map((one) => one.path), ['/real/cv/2026']);
	assert.deepEqual(cvArchiveSearch(archive, 'profile edu').map((one) => one.path), ['/example/profile/edu']);
	assert.deepEqual(cvArchiveSearch(archive, ''), []);
	assert.deepEqual(cvArchiveSearch(archive, 'zzz'), []);
});

test('what the data of a file says is read defensively', () => {
	assert.deepEqual(cvArchiveFileMetaGet('cv', undefined), { name: '', template: '', profile: '', asOf: '', cellOwnCount: 0, sectionOwnCount: 0 });
	assert.deepEqual(cvArchiveFileMetaGet('cv', { name: 5, valueByCell: 'x', sectionExtraList: [{}] }), { name: '', template: '', profile: '', asOf: '', cellOwnCount: 0, sectionOwnCount: 1 });
	assert.deepEqual(cvArchiveFileMetaGet('template', [1]), { name: '', form: 'cv', sectionCount: 0 });
});

test('the path of a new paper is made of its name, and is free', () => {
	assert.equal(cvArchivePaperPathBuild(archive, 'example', 'cv', 'Trading company 2027'), '/example/cv/trading-company-2027');
	assert.equal(cvArchivePaperPathBuild(archive, 'example', 'cv', 'General'), '/example/cv/general-2');
	// a name with nothing of a path in it: a number
	assert.equal(cvArchivePaperPathBuild(archive, 'example', 'cv', '商社向け'), '/example/cv/3');
	assert.equal(cvArchivePaperPathBuild(archive, 'real', 'we', '職務経歴書'), '/real/we/1');
});

// ---------- folders (doc/cv-portal.md#folders) ----------

const folderItemList = [
	{ key: 'a', kind: 'cv', name: 'A', pathList: ['/example/cv/a'] },
	{ key: 'b', kind: 'cv', name: 'B', pathList: ['/example/cv/b'] },
	{ key: 'c', kind: 'cv', name: 'C', pathList: ['/example/cv/c'] },
	{ key: 'w', kind: 'we', name: 'W', pathList: ['/example/we/w'] },
	{ key: 'r', kind: 'cv', name: 'R', pathList: ['/real/cv/r'] },
];
const folderArchiveBuild = (arrange) => cvArchiveBuild({ partitionList, itemList: folderItemList, profile, arrangeByPartition: { example: arrange } });
const pathListOf = (list) => list.map((one) => one.path);

test('ranks spread evenly, in order, every one a rank', () => {
	for (const count of [1, 2, 5, 35, 36, 200]) {
		const list = cvArchiveRankSpread(count);
		assert.equal(list.length, count);
		assert.ok(list.every(rankIsValid));
		for (let index = 1; index < list.length; index += 1) assert.equal(rankCompare(list[index - 1], list[index]), -1);
	}
	assert.deepEqual(cvArchiveRankSpread(0), []);
	assert.equal(cvArchiveArrangePathGet('example'), '/example/arrange/archive');
	assert.equal(cvArchiveArrangePathGet(''), '/arrange/archive');
});

test('the item arrange is read defensively and written without what is empty', () => {
	const read = cvArchiveArrangeRead({
		folderList: [{ id: 'f1', name: 'Applied', drawer: 'cv', rank: 'i' }, { id: 'f1', drawer: 'cv' }, { id: 'p', drawer: 'profile' }, { drawer: 'cv' }, 'x', { id: 'f2', drawer: 'we', rank: 'i0' }],
		placeByKey: { a: { folder: 'f1', rank: 'c' }, b: 'x', c: { rank: 5 } },
	});
	assert.deepEqual(read.folderList, [{ id: 'f1', name: 'Applied', drawer: 'cv', parent: '', rank: 'i' }, { id: 'f2', name: '', drawer: 'we', parent: '', rank: '' }]);
	assert.deepEqual(read.placeByKey, { a: { folder: 'f1', rank: 'c' }, c: { folder: '', rank: '' } });
	assert.deepEqual(cvArchiveArrangeRead(undefined), { folderList: [], placeByKey: {} });
	assert.deepEqual(cvArchiveArrangeDataBuild(read, { keyList: ['a'] }), { folderList: [{ id: 'f1', name: 'Applied', drawer: 'cv', rank: 'i' }, { id: 'f2', drawer: 'we' }], placeByKey: { a: { folder: 'f1', rank: 'c' } } });
});

test('a drawer holds its folders and papers by rank; the unranked after, folders first', () => {
	const archiveOf = folderArchiveBuild(cvArchiveArrangeRead({
		folderList: [{ id: 'f1', name: 'Applied', drawer: 'cv', rank: 'm' }, { id: 'f2', drawer: 'cv' }, { id: 'f3', name: 'Inner', drawer: 'cv', parent: 'f1' }],
		placeByKey: { b: { rank: 'c' }, c: { folder: 'f1', rank: 'i' } },
	}));
	assert.deepEqual(pathListOf(archiveOf.childListGet('/example/cv')), ['/example/cv/b', '/example/cv/folder:f1', '/example/cv/folder:f2', '/example/cv/a']);
	assert.deepEqual(pathListOf(archiveOf.childListGet('/example/cv/folder:f1')), ['/example/cv/c', '/example/cv/folder:f3']);
	const folder = archiveOf.placeGet('/example/cv/folder:f1');
	assert.equal(folder.level, 'folder');
	assert.equal(folder.detail, '2 items');
	assert.equal(archiveOf.placeGet('/example/cv/folder:f2').label, 'New folder');
	assert.equal(archiveOf.placeGet('/example/cv/folder:f2').meta.isNameDefault, true);
	// a paper keeps its path; the way to it goes through its folder
	assert.deepEqual(pathListOf(archiveOf.ancestorListGet('/example/cv/c')), ['/', '/example', '/example/cv', '/example/cv/folder:f1', '/example/cv/c']);
	assert.equal(archiveOf.parentPathGet('/example/cv/c'), '/example/cv/folder:f1');
	assert.equal(archiveOf.parentPathGet('/example/cv/folder:f3'), '/example/cv/folder:f1');
	assert.equal(archiveOf.countGet('/example/cv/folder:f1'), 1);
	assert.equal(archiveOf.countGet('/example/cv'), 3);
	// the files in the order of the archive: a folder where it stands
	assert.deepEqual(pathListOf(archiveOf.fileList).slice(0, 3), ['/example/cv/b', '/example/cv/c', '/example/cv/a']);
	// a folder's name finds what it holds
	assert.deepEqual(pathListOf(cvArchiveSearch(archiveOf, 'applied')), ['/example/cv/c']);
});

test('a folder in another drawer or in itself is in its drawer; a paper filed in a folder of another drawer stays out of it', () => {
	const archiveOf = folderArchiveBuild(cvArchiveArrangeRead({
		folderList: [{ id: 'x', drawer: 'cv', parent: 'y' }, { id: 'y', drawer: 'cv', parent: 'x' }, { id: 'w1', drawer: 'we' }, { id: 'z', drawer: 'cv', parent: 'w1' }],
		placeByKey: { a: { folder: 'w1' } },
	}));
	assert.equal(archiveOf.parentPathGet('/example/cv/folder:x'), '/example/cv');
	assert.equal(archiveOf.parentPathGet('/example/cv/folder:y'), '/example/cv');
	assert.equal(archiveOf.parentPathGet('/example/cv/folder:z'), '/example/cv');
	assert.equal(archiveOf.parentPathGet('/example/cv/a'), '/example/cv');
	assert.deepEqual(pathListOf(archiveOf.childListGet('/example/we')), ['/example/we/folder:w1', '/example/we/w']);
});

test('moving: into a folder, between two, the first ordering ranks the whole place', () => {
	let arrange = cvArchiveArrangeRead({});
	let archiveOf = folderArchiveBuild(arrange);
	// a folder made is first in its place, named later
	let made = cvArchiveArrangeFolderCreate(archiveOf, arrange, { parentPath: '/example/cv', id: 'f1' });
	assert.equal(made.code, 0);
	arrange = made.data;
	archiveOf = folderArchiveBuild(arrange);
	assert.deepEqual(pathListOf(archiveOf.childListGet('/example/cv')), ['/example/cv/folder:f1', '/example/cv/a', '/example/cv/b', '/example/cv/c']);
	assert.ok(archiveOf.childListGet('/example/cv').every((place) => rankIsValid(place.rank)));
	// c to the second place
	let moved = cvArchiveArrangeMove(archiveOf, arrange, ['/example/cv/c'], { parentPath: '/example/cv', index: 1 });
	assert.equal(moved.code, 0);
	arrange = moved.data;
	archiveOf = folderArchiveBuild(arrange);
	assert.deepEqual(pathListOf(archiveOf.childListGet('/example/cv')), ['/example/cv/folder:f1', '/example/cv/c', '/example/cv/a', '/example/cv/b']);
	// a and b into the folder, at its end
	moved = cvArchiveArrangeMove(archiveOf, arrange, ['/example/cv/a', '/example/cv/b'], { parentPath: '/example/cv/folder:f1' });
	arrange = moved.data;
	archiveOf = folderArchiveBuild(arrange);
	assert.deepEqual(pathListOf(archiveOf.childListGet('/example/cv/folder:f1')), ['/example/cv/a', '/example/cv/b']);
	assert.deepEqual(pathListOf(archiveOf.childListGet('/example/cv')), ['/example/cv/folder:f1', '/example/cv/c']);
	// b before a in the folder
	arrange = cvArchiveArrangeMove(archiveOf, arrange, ['/example/cv/b'], { parentPath: '/example/cv/folder:f1', index: 0 }).data;
	archiveOf = folderArchiveBuild(arrange);
	assert.deepEqual(pathListOf(archiveOf.childListGet('/example/cv/folder:f1')), ['/example/cv/b', '/example/cv/a']);
	// a folder in the folder, then renamed
	arrange = cvArchiveArrangeFolderCreate(archiveOf, arrange, { parentPath: '/example/cv/folder:f1', id: 'f2', name: ' Inner ' }).data;
	arrange = cvArchiveArrangeFolderRename(arrange, 'f1', 'Applied').data;
	archiveOf = folderArchiveBuild(arrange);
	assert.deepEqual(pathListOf(archiveOf.childListGet('/example/cv/folder:f1')), ['/example/cv/folder:f2', '/example/cv/b', '/example/cv/a']);
	assert.equal(archiveOf.placeGet('/example/cv/folder:f2').label, 'Inner');
	assert.equal(archiveOf.placeGet('/example/cv/folder:f1').label, 'Applied');
	// the papers are named by their keys; nothing of a paper changes
	assert.deepEqual(Object.keys(cvArchiveArrangeDataBuild(arrange).placeByKey).sort(), ['a', 'b', 'c']);
});

test('what cannot be moved: across partitions, across drawers, a folder into itself', () => {
	let arrange = cvArchiveArrangeRead({ folderList: [{ id: 'f1', drawer: 'cv', rank: 'i' }, { id: 'f2', drawer: 'cv', parent: 'f1' }] });
	const archiveOf = folderArchiveBuild(arrange);
	assert.match(cvArchiveMoveProblemGet(archiveOf, ['/real/cv/r'], '/example/cv'), /another partition/);
	assert.match(cvArchiveMoveProblemGet(archiveOf, ['/example/we/w'], '/example/cv/folder:f1'), /stays in its drawer/);
	assert.match(cvArchiveMoveProblemGet(archiveOf, ['/example/cv/folder:f1'], '/example/cv/folder:f2'), /not put in itself/);
	assert.match(cvArchiveMoveProblemGet(archiveOf, ['/example/cv/folder:f1'], '/example/cv/folder:f1'), /not put in itself/);
	assert.match(cvArchiveMoveProblemGet(archiveOf, ['/example/cv/a'], '/example/profile'), /not filed in folders/);
	assert.equal(cvArchiveMoveProblemGet(archiveOf, ['/example/cv/folder:f2'], '/example/cv'), '');
	assert.equal(cvArchiveArrangeMove(archiveOf, arrange, ['/real/cv/r'], { parentPath: '/example/cv' }).code, -1);
	assert.equal(cvArchiveArrangeFolderCreate(archiveOf, arrange, { parentPath: '/example/cv', id: 'f1' }).code, -1);
});

test('a folder taken away leaves what it holds where it stood, in its order', () => {
	let arrange = cvArchiveArrangeRead({
		folderList: [{ id: 'f1', drawer: 'cv', rank: 'c' }, { id: 'f2', drawer: 'cv', parent: 'f1', rank: 'i' }],
		placeByKey: { a: { folder: 'f1', rank: 'c' }, b: { rank: 'i' }, c: { rank: 'r' } },
	});
	let archiveOf = folderArchiveBuild(arrange);
	assert.deepEqual(pathListOf(archiveOf.childListGet('/example/cv')), ['/example/cv/folder:f1', '/example/cv/b', '/example/cv/c']);
	arrange = cvArchiveArrangeFolderRemove(archiveOf, arrange, '/example/cv/folder:f1').data;
	archiveOf = folderArchiveBuild(arrange);
	assert.deepEqual(pathListOf(archiveOf.childListGet('/example/cv')), ['/example/cv/a', '/example/cv/folder:f2', '/example/cv/b', '/example/cv/c']);
	assert.equal(archiveOf.placeGet('/example/cv/folder:f1'), undefined);
	// an empty folder is only taken away
	const before = JSON.stringify(arrange.placeByKey);
	arrange = cvArchiveArrangeFolderRemove(archiveOf, arrange, '/example/cv/folder:f2').data;
	assert.equal(JSON.stringify(arrange.placeByKey), before);
	assert.deepEqual(arrange.folderList, []);
});
