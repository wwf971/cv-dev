import assert from 'node:assert/strict';
import test from 'node:test';
import { cvInfoBuild } from './CvQuery.js';
import { cvInfoExploreGet, cvInfoFindListGet } from './CvInfoExplore.js';

const info = cvInfoBuild([
	{ key: 'info-1', pathList: ['/info/name'], data: { '{jp/last/}': { kanji: '山田', romaji: 'Yamada' }, '{jp/first/}': { kanji: '太郎' }, '{en, last}': 'Yamada', '{en, first}': 'Taro' } },
	{ key: 'info-2', pathList: ['/info/gender'], data: 'male' },
	{ key: 'info-3', pathList: ['/info/[address, addr]'], data: { jp: { postal: '100-0001' } } },
]);
const itemText = (item) => `${item.kind} ${item.isGroup ? `{${item.memberList.map((one) => one.label).join(' ')}}` : item.memberList.map((one) => one.label).join('')}${item.kind === 'leaf' ? ` = ${item.leaf.value}` : ` ${item.countLeaf}`}`;
const at = (path) => cvInfoExploreGet(info, path.split('/').filter(Boolean));

test('the top of a profile: a folder a first segment, a value where a path ends at once', () => {
	const top = at('');
	assert.deepEqual(top.itemList.map(itemText), ['folder name 5', 'leaf gender = male', 'folder address 1']);
	assert.equal(top.countLeaf, 7);
	assert.deepEqual(top.itemList[0].pathNextList, ['name']);
});

test('an unordered group is one item, each of its members a way forward', () => {
	const name = at('name');
	assert.deepEqual(name.itemList.map(itemText), ['folder {jp last} 2', 'folder {jp first} 1', 'leaf {en last} = Yamada', 'leaf {en first} = Taro']);
	const group = name.itemList[0];
	assert.deepEqual(group.memberList.map((member) => member.segmentList), [['jp'], ['last']]);
	assert.deepEqual(group.pathNextList, ['name', 'jp', 'last']);
	assert.deepEqual(group.previewList, ['山田', 'Yamada']);
});

test('a member walked, the other is a plain step, whichever came first', () => {
	// jp first: the two groups it is in go on side by side
	assert.deepEqual(at('name/jp').itemList.map(itemText), ['folder last 2', 'folder first 1']);
	// last first: one group goes on, the other ends with its value
	assert.deepEqual(at('name/last').itemList.map(itemText), ['folder jp 2', 'leaf en = Yamada']);
	assert.deepEqual(at('name/last/jp').itemList.map(itemText), ['leaf kanji = 山田', 'leaf romaji = Yamada']);
	assert.deepEqual(at('name/jp/last').itemList.map(itemText), ['leaf kanji = 山田', 'leaf romaji = Yamada']);
	assert.deepEqual(at('name/en').itemList.map(itemText), ['leaf last = Yamada', 'leaf first = Taro']);
});

test('a path nothing lies at is empty; a choice is walked by its first name, and reached by any', () => {
	assert.deepEqual(at('name/zz').itemList, []);
	assert.deepEqual(at('addr/jp').itemList.map(itemText), ['leaf postal = 100-0001']);
	assert.deepEqual(at('address').itemList[0].pathNextList, ['address', 'jp']);
	// a path walked to a value itself: the value, with nothing more to walk
	const whole = at('gender');
	assert.deepEqual(whole.itemList.map((item) => `${item.kind} ${item.memberList.length} ${item.leaf.value}`), ['leaf 0 male']);
});

test('the values found by words, each with the folder it lies in', () => {
	assert.deepEqual(cvInfoFindListGet(info, 'yamada').map((one) => `${one.pathParentList.join('/')} | ${one.name}`), ['name/jp/last | romaji', 'name/en | last']);
	assert.deepEqual(cvInfoFindListGet(info, ''), []);
	const leafKanji = info.leafList.find((leaf) => leaf.path === 'name/jp/first/kanji');
	assert.deepEqual(cvInfoFindListGet(info, 'name/first/jp/katakana', [leafKanji]).map((one) => one.leaf.path), ['name/jp/first/kanji']);
});
