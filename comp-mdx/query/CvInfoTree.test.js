import assert from 'node:assert/strict';
import test from 'node:test';
import { cvInfoBuild } from './CvQuery.js';
import { cvInfoDraftPathGet, cvInfoFindWordList, cvInfoTreeBuild, cvInfoTreeFolderPathList, cvInfoTreeRowListGet } from './CvInfoTree.js';

const info = cvInfoBuild([
	{ key: 'info-1', pathList: ['/info/name'], data: { '{jp/last/}': { kanji: '山田', romaji: 'Yamada' }, '{jp/first/}': { kanji: '太郎' }, '{en, last}': 'Yamada' } },
	{ key: 'info-2', pathList: ['/info/gender'], data: 'male' },
	{ key: 'info-3', pathList: ['/info/photo'], data: 'data:image/png;base64,AAAA' },
	{ key: 'info-4', pathList: ['/info/address'], data: { jp: { postal: '100-0001', line: ['東京都千代田区', 'サンプルビル101'] } } },
]);
const root = cvInfoTreeBuild(info.leafList);
const rowText = (row) => `${'  '.repeat(row.depth)}${row.kind === 'draft' ? '(draft)' : row.node.name}${row.kind === 'folder' ? (row.isOpen ? ' v' : ' >') : ''}`;

test('values sharing the start of their paths share a folder, in the order of the data', () => {
	assert.deepEqual(root.nodeList.map((node) => `${node.kind} ${node.path} ${node.countLeaf}`), ['folder name 4', 'leaf gender 1', 'leaf photo 1', 'folder address 2']);
	const name = root.nodeList[0];
	assert.deepEqual(name.nodeList.map((node) => `${node.kind} ${node.path}`), ['folder name/jp', 'folder name/en']);
	assert.deepEqual(name.nodeList[0].nodeList.map((node) => node.path), ['name/jp/last', 'name/jp/first']);
	assert.equal(name.nodeList[1].nodeList[0].leaf.value, 'Yamada');
	assert.equal(root.countLeaf, 8);
	assert.deepEqual(cvInfoTreeFolderPathList(root), ['name', 'name/jp', 'name/jp/last', 'name/jp/first', 'name/en', 'address', 'address/jp']);
});

test('a level that comes in any order with another says so', () => {
	const other = (path) => {
		const segmentList = path.split('/');
		let node = root;
		for (const segment of segmentList) node = node.nodeList.find((one) => one.name === segment && (one.kind === 'folder' || one.path === path));
		return node.memberOtherList;
	};
	assert.deepEqual(other('name'), []);
	// jp is in {jp/last/} and in {jp/first/}
	assert.deepEqual(other('name/jp'), ['last', 'first']);
	assert.deepEqual(other('name/jp/last'), ['jp']);
	assert.deepEqual(other('name/jp/last/kanji'), []);
	// a group ending the path: the folder and the value
	assert.deepEqual(other('name/en'), ['last']);
	assert.deepEqual(other('name/en/last'), ['en']);
	assert.deepEqual(other('address/jp'), []);
});

test('a closed folder says what it holds: its first values, an image left out, a list by its first line', () => {
	assert.deepEqual(root.nodeList[0].previewList, ['山田', 'Yamada', '太郎', 'Yamada']);
	assert.deepEqual(root.nodeList[3].previewList, ['100-0001', '東京都千代田区']);
	assert.deepEqual(root.previewList, ['山田', 'Yamada', '太郎', 'Yamada']);
});

test('the rows are the top level until a folder is opened, a level at a time', () => {
	assert.deepEqual(cvInfoTreeRowListGet(root).map(rowText), ['name >', 'gender', 'photo', 'address >']);
	assert.deepEqual(cvInfoTreeRowListGet(root, { isOpenByPath: { name: true } }).map(rowText), ['name v', '  jp >', '  en >', 'gender', 'photo', 'address >']);
	assert.deepEqual(cvInfoTreeRowListGet(root, { isOpenByPath: { name: true, 'name/jp': true, 'name/jp/last': true } }).map(rowText),
		['name v', '  jp v', '    last v', '      kanji', '      romaji', '    first >', '  en >', 'gender', 'photo', 'address >']);
});

test('words narrow the tree to the values whose path or text holds them all, their folders open', () => {
	assert.deepEqual(cvInfoFindWordList(' name/First  jp '), ['name', 'first', 'jp']);
	// the words of a query in any order: name/first/jp finds what lies at name/jp/first
	assert.deepEqual(cvInfoTreeRowListGet(root, { find: 'name/first/jp' }).map(rowText), ['name v', '  jp v', '    first v', '      kanji']);
	// by the text of a value
	assert.deepEqual(cvInfoTreeRowListGet(root, { find: 'yamada' }).map(rowText), ['name v', '  jp v', '    last v', '      romaji', '  en v', '    last']);
	// an image is not found by its data
	assert.deepEqual(cvInfoTreeRowListGet(root, { find: 'base64' }).map(rowText), []);
	// a value a query reads from is drawn whatever the words say (katakana is derived from no stored word)
	const leafKanji = info.leafList.find((leaf) => leaf.path === 'name/jp/first/kanji');
	assert.deepEqual(cvInfoTreeRowListGet(root, { find: 'name/first/jp/katakana', leafShownList: [leafKanji] }).map(rowText), ['name v', '  jp v', '    first v', '      kanji']);
});

test('a new value is typed in the first row of its folder, the folders on the way open', () => {
	assert.deepEqual(cvInfoTreeRowListGet(root, { draftPath: '' }).map(rowText), ['(draft)', 'name >', 'gender', 'photo', 'address >']);
	assert.deepEqual(cvInfoTreeRowListGet(root, { draftPath: 'address/jp' }).map(rowText), ['name >', 'gender', 'photo', 'address v', '  jp v', '    (draft)', '    postal', '    line']);
	// its folder is hidden by the words: the draft is still there, at the top
	assert.deepEqual(cvInfoTreeRowListGet(root, { draftPath: 'address/jp', find: 'gender' }).map(rowText), ['(draft)', 'gender']);
	assert.equal(cvInfoDraftPathGet('address/jp', ' floor '), 'address/jp/floor');
	assert.equal(cvInfoDraftPathGet('', 'contact / line'), 'contact/line');
});
