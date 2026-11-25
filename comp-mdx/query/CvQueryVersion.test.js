import assert from 'node:assert/strict';
import test from 'node:test';
import {
	CV_VERSION_KEY, cvDataRemove, cvDataSet, cvEntryListResolve, cvInfoBuild, cvLeafHeadIdGet, cvLeafVersionListGet, cvQueryNewProblemGet,
	cvQueryNewSlashItemListGet, cvQueryParse, cvQueryResolve, cvQuerySlashItemListGet, cvQueryVersionSet, cvQueryVersionSplit, cvTextExpand,
	cvValueDataSet, cvValueHeadGet, cvValueVersionHeadSet, cvValueVersionNoteSet, cvValueVersionRemove,
} from './CvQuery.js';

// Versions of a value (doc/cv-query.md#versions-of-a-value) and values made where they are named
// (#a-new-value-where-it-is-named).

const versioned = (head, ...valueList) => ({ [CV_VERSION_KEY]: { head, versionList: valueList.map((value, index) => ({ id: index + 1, value, time: `2026112${index}_10000000+09` })) } });

const sourceList = [
	{
		key: 'name',
		pathList: ['/info/name'],
		data: {
			'{jp/last/}': { kanji: '山田', hiragana: 'やまだ' },
			'{jp/first/}': { kanji: versioned(2, '太郎', '太朗'), hiragana: versioned(1, 'たろう', 'たろ') },
		},
	},
	{ key: 'pr', pathList: ['/info/pr'], data: { jp: versioned(3, '第一稿', ['第二稿', '二行目'], '第三稿'), en: 'plain' } },
	{ key: 'birth', pathList: ['/info/birth'], data: { year: versioned(2, 1998, 1999), month: 8, day: 17 } },
	{ key: 'edu', pathList: ['/info/edu/bachelor'], data: { start: { year: versioned(1, 2016, 2017), month: 4, jp: '入学' } } },
];
const info = cvInfoBuild(sourceList);
const resolve = (text) => cvQueryResolve(info, text, { dateNow: new Date(2026, 10, 8) });

test('a query parts from the version it names; none and @head read the head', () => {
	assert.deepEqual(cvQueryVersionSplit('pr/jp@2'), { path: 'pr/jp', version: '2', isVersionTyped: true });
	assert.deepEqual(cvQueryVersionSplit('pr/jp@HEAD'), { path: 'pr/jp', version: '', isVersionTyped: true });
	assert.deepEqual(cvQueryVersionSplit('pr/jp@'), { path: 'pr/jp', version: '', isVersionTyped: true });
	assert.deepEqual(cvQueryVersionSplit('pr/jp'), { path: 'pr/jp', version: '', isVersionTyped: false });
	assert.equal(cvQueryParse('PR/ja@2').text, 'pr/jp@2');
	assert.equal(cvQueryParse('pr/jp/uppercase-all@2').version, '2');
	assert.deepEqual(cvQueryParse('pr/jp/uppercase-all@2').formatList, ['uppercase-all']);
	assert.equal(cvQueryParse('pr/jp@head').text, 'pr/jp');
	assert.equal(cvQueryVersionSet('pr/jp@1', 3), 'pr/jp@3');
	assert.equal(cvQueryVersionSet('pr/jp@1', undefined), 'pr/jp');
	assert.equal(cvQueryVersionSet('pr/jp', 'head'), 'pr/jp');
});

test('a value kept with versions is one leaf, reading its head', () => {
	assert.equal(resolve('name/jp/first/kanji').value, '太朗');
	assert.equal(resolve('name/jp/first').value, '太朗');
	assert.equal(resolve('pr/jp').value, '第三稿');
	assert.deepEqual(resolve('pr/jp').version, { id: 3, isHead: true, isPinned: false, count: 3 });
	// a plain value is its version 1, the head
	assert.deepEqual(resolve('pr/en').version, { id: 1, isHead: true, isPinned: false, count: 1 });
	assert.equal(info.leafList.filter((leaf) => leaf.path.startsWith('pr/')).length, 2);
	assert.equal(info.problemList.length, 0);
});

test('"@" and a version read that version whatever the head is', () => {
	assert.equal(resolve('pr/jp@1').value, '第一稿');
	assert.equal(resolve('pr/jp@2').value, '第二稿\n二行目');
	assert.deepEqual(resolve('pr/jp@2').version, { id: 2, isHead: false, isPinned: true, count: 3 });
	assert.deepEqual(resolve('pr/jp@3').version, { id: 3, isHead: true, isPinned: true, count: 3 });
	assert.equal(resolve('pr/en@1').value, 'plain');
	// the first value below a path, in its version
	assert.equal(resolve('name/jp/first@1').value, '太郎');
	// a format after the path, the version at the very end
	assert.equal(resolve('pr/en/uppercase-all@1').value, 'PLAIN');
	const missing = resolve('pr/jp@7');
	assert.equal(missing.status, 'missing');
	assert.match(missing.message, /no version 7 \(it has 1, 2, 3\)/);
	assert.equal(resolve('pr/en@2').status, 'missing');
});

test('a version of a script read off another one is a version of that one', () => {
	assert.equal(resolve('name/jp/first/katakana').value, 'タロウ');
	assert.equal(resolve('name/jp/first/katakana@2').value, 'タロ');
	assert.equal(resolve('name/jp/first/katakana@2').version.id, 2);
});

test('what is worked out of several values has no versions of its own', () => {
	assert.equal(resolve('name/jp/kanji').value, '山田 太朗');
	assert.match(resolve('name/jp/kanji@1').message, /joined of 2 values/);
	assert.equal(resolve('birth/era').value, '平成11');
	assert.match(resolve('birth/era@1').message, /name one on the year/);
	assert.equal(resolve('birth/year@1').value, '1998');
});

test('a dated entry reads the heads of its numbers', () => {
	const entry = cvEntryListResolve(info, 'edu/jp')[0];
	assert.equal(entry.year, '2016');
	assert.equal(cvValueHeadGet(versioned(2, 'a', 'b')), 'b');
	assert.equal(cvValueHeadGet('plain'), 'plain');
});

test('the versions of a leaf, oldest first', () => {
	const leaf = resolve('pr/jp').leaf;
	assert.deepEqual(cvLeafVersionListGet(leaf).map((one) => [one.id, one.value, one.isList, one.isHead]), [[1, '第一稿', false, false], [2, '第二稿\n二行目', true, false], [3, '第三稿', false, true]]);
	assert.equal(cvLeafHeadIdGet(leaf), 3);
	assert.deepEqual(cvLeafVersionListGet(resolve('pr/en').leaf), [{ id: 1, value: 'plain', isList: false, time: '', note: '', isHead: true }]);
});

test('versions that cannot be read are passed over, never the page', () => {
	const broken = cvInfoBuild([{ key: 'x', pathList: ['/info/x'], data: {
		a: { [CV_VERSION_KEY]: { head: 9, versionList: [{ id: 1, value: 'one' }, { id: 1, value: 'again' }, { id: 'two', value: 'x' }, { id: 3 }, { id: 4, value: 'four' }] } },
		b: { [CV_VERSION_KEY]: { head: 1, versionList: [] } },
	} }]);
	const leaf = cvQueryResolve(broken, 'x/a').leaf;
	// an id met twice keeps its first, an entry without a whole id or a value is left out, a head naming none is the last
	assert.deepEqual(cvLeafVersionListGet(leaf).map((one) => [one.id, one.value]), [[1, 'one'], [4, 'four']]);
	assert.equal(cvQueryResolve(broken, 'x/a').value, 'four');
	assert.equal(cvQueryResolve(broken, 'x/b').status, 'missing');
	assert.equal(broken.problemList.length, 1);
});

test('written in place: the version named, else the head; a plain value stays plain', () => {
	const data = sourceList[1].data;
	const head = cvValueDataSet(data, ['jp'], '第三稿 改');
	assert.equal(head.versionId, 3);
	assert.deepEqual(head.data.jp[CV_VERSION_KEY].versionList.map((one) => one.value), ['第一稿', ['第二稿', '二行目'], '第三稿 改']);
	assert.equal(head.data.jp[CV_VERSION_KEY].head, 3);
	const first = cvValueDataSet(data, ['jp'], '第一稿 改', { versionId: 1 });
	assert.equal(first.data.jp[CV_VERSION_KEY].versionList[0].value, '第一稿 改');
	assert.equal(first.data.jp[CV_VERSION_KEY].versionList[0].time, '20261120_10000000+09');
	assert.equal(first.data.jp[CV_VERSION_KEY].head, 3);
	assert.deepEqual(cvValueDataSet(data, ['en'], 'plain 2'), { data: { ...data, en: 'plain 2' }, versionId: 1 });
	assert.match(cvValueDataSet(data, ['jp'], 'x', { versionId: 9 }).message, /no version 9/);
	assert.match(cvValueDataSet(data, ['en'], 'x', { versionId: 2 }).message, /no version 2/);
	// the data handed in is never changed
	assert.equal(data.jp[CV_VERSION_KEY].versionList[2].value, '第三稿');
});

test('written as a new version: the next id, the head unless it is to stay', () => {
	const data = sourceList[1].data;
	const moved = cvValueDataSet(data, ['jp'], '第四稿', { mode: 'newVersion', time: '20261125_10000000+09', note: '外資向け' });
	assert.equal(moved.versionId, 4);
	assert.equal(moved.data.jp[CV_VERSION_KEY].head, 4);
	assert.deepEqual(moved.data.jp[CV_VERSION_KEY].versionList[3], { id: 4, value: '第四稿', time: '20261125_10000000+09', note: '外資向け' });
	const kept = cvValueDataSet(data, ['jp'], '第四稿', { mode: 'newVersion', isHeadMoved: false });
	assert.equal(kept.data.jp[CV_VERSION_KEY].head, 3);
	assert.deepEqual(kept.data.jp[CV_VERSION_KEY].versionList[3], { id: 4, value: '第四稿' });
	// a plain value becomes its version 1, the new one its version 2
	const plain = cvValueDataSet(data, ['en'], 'second', { mode: 'newVersion' });
	assert.deepEqual(plain.data.en, { [CV_VERSION_KEY]: { head: 2, versionList: [{ id: 1, value: 'plain' }, { id: 2, value: 'second' }] } });
	// nothing there yet: the first version of a value is written plainly
	assert.deepEqual(cvValueDataSet(data, ['fr'], 'premier', { mode: 'newVersion' }), { data: { ...data, fr: 'premier' }, versionId: 1 });
	// an id is never used again
	const removed = cvValueVersionRemove(moved.data, ['jp'], 2).data;
	assert.equal(cvValueDataSet(removed, ['jp'], '第五稿', { mode: 'newVersion' }).versionId, 5);
});

test('a version checked out is the head; the head is never removed', () => {
	const data = sourceList[1].data;
	const checked = cvValueVersionHeadSet(data, ['jp'], 1).data;
	assert.equal(checked.jp[CV_VERSION_KEY].head, 1);
	assert.equal(cvQueryResolve(cvInfoBuild([{ ...sourceList[1], data: checked }]), 'pr/jp').value, '第一稿');
	assert.match(cvValueVersionHeadSet(data, ['jp'], 8).message, /no version 8/);
	assert.equal(cvValueVersionHeadSet(data, ['en'], 1).data, data);
	assert.match(cvValueVersionRemove(data, ['jp'], 3).message, /is the head/);
	assert.deepEqual(cvValueVersionRemove(data, ['jp'], 1).data.jp[CV_VERSION_KEY].versionList.map((one) => one.id), [2, 3]);
});

test('the note of a version; a plain value is written with its versions to keep one', () => {
	const data = sourceList[1].data;
	assert.equal(cvValueVersionNoteSet(data, ['jp'], 2, ' 商社向け ').data.jp[CV_VERSION_KEY].versionList[1].note, '商社向け');
	const noted = cvValueVersionNoteSet(data, ['en'], 1, 'first').data;
	assert.deepEqual(noted.en, { [CV_VERSION_KEY]: { head: 1, versionList: [{ id: 1, value: 'plain', note: 'first' }] } });
	assert.equal(cvValueVersionNoteSet(noted, ['en'], 1, '').data.en[CV_VERSION_KEY].versionList[0].note, undefined);
	assert.equal(cvValueVersionNoteSet(data, ['en'], 1, '').data, data);
});

test('a writer knowing no versions writes the head, and loses none', () => {
	const data = sourceList[1].data;
	const written = cvDataSet(data, ['jp'], 'typed plainly');
	assert.equal(written.jp[CV_VERSION_KEY].versionList.length, 3);
	assert.equal(written.jp[CV_VERSION_KEY].versionList[2].value, 'typed plainly');
	// a mapping put there replaces it, as before; a removal takes the value with its versions
	assert.deepEqual(cvDataSet(data, ['jp'], { a: 1 }).jp, { a: 1 });
	assert.equal(cvDataRemove(data, ['jp']).jp, undefined);
	assert.equal(cvDataSet(sourceList[2].data, ['year'], 2000).year[CV_VERSION_KEY].versionList[1].value, 2000);
});

test('a text reads the version each of its queries names', () => {
	assert.equal(cvTextExpand(info, '{{pr/jp@1}}・{{pr/jp}}').text, '第一稿・第三稿');
	const one = cvTextExpand(info, '{{pr/jp@1}}');
	assert.equal(one.query, 'pr/jp@1');
	assert.equal(one.leaf.path, 'pr/jp');
	assert.deepEqual(cvTextExpand(info, '{{pr/jp@9}}').missingList, ['pr/jp@9']);
});

test('/query walks into the versions of a value', () => {
	const walk = (param) => cvQuerySlashItemListGet(info, param, {}, 40, { isNewOffered: true });
	// a value of several versions offers them
	assert.deepEqual(walk('pr/jp').map((item) => [item.kind, item.label]), [['query', 'pr/jp'], ['dir', 'pr/jp@']]);
	assert.equal(walk('pr/jp')[1].paramNext, 'pr/jp@');
	assert.deepEqual(walk('pr/en').map((item) => item.kind), ['query']);
	// the head first, then the versions newest first
	assert.deepEqual(walk('pr/jp@').map((item) => [item.label, item.query]), [['@head', 'pr/jp'], ['@3', 'pr/jp@3'], ['@2', 'pr/jp@2'], ['@1', 'pr/jp@1']]);
	assert.match(walk('pr/jp@')[1].detail, /^head · 第三稿/);
	assert.deepEqual(walk('pr/jp@2').map((item) => item.label), ['@2']);
	assert.deepEqual(walk('pr/jp@h').map((item) => item.label), ['@head']);
	assert.deepEqual(walk('nothing/here@'), []);
});

test('a path nothing holds is offered as a new value', () => {
	const walk = (param, isNewOffered = true) => cvQuerySlashItemListGet(info, param, {}, 40, { isNewOffered });
	assert.deepEqual(walk('hobby/jp').map((item) => [item.kind, item.query]), [['new', 'hobby/jp']]);
	assert.deepEqual(walk('hobby/jp', false), []);
	// a segment added under a path that exists
	assert.deepEqual(walk('pr/fr').map((item) => [item.kind, item.query]), [['new', 'pr/fr']]);
	assert.match(walk('pr/fr')[0].detail, /added/);
	// what starts like something there lists it, and is offered as new too while it reads nothing
	assert.deepEqual(walk('pr/e').map((item) => item.kind), ['value', 'new']);
	assert.deepEqual(walk('pr/en').map((item) => item.kind), ['query']);
	// nothing while a segment is not begun, and none where no value can be
	assert.deepEqual(walk('pr/').map((item) => item.kind), ['value', 'value']);
	// a format reads the first value below pr, whose versions it offers: nothing new is made of it
	assert.deepEqual(walk('pr/uppercase-all').map((item) => item.kind), ['query', 'dir']);
	assert.deepEqual(walk('hobby/era'), []);
	assert.deepEqual(walk('ho bby'), []);
});

test('why a value cannot be made at a path', () => {
	assert.equal(cvQueryNewProblemGet(info, 'hobby/jp'), '');
	assert.equal(cvQueryNewProblemGet(info, 'name/jp/first/nickname'), '');
	assert.match(cvQueryNewProblemGet(info, ''), /a path names the new value/);
	assert.match(cvQueryNewProblemGet(info, 'pr/en'), /holds a value already/);
	assert.match(cvQueryNewProblemGet(info, 'name/jp'), /is a folder holding values/);
	assert.match(cvQueryNewProblemGet(info, 'hobby/uppercase-all'), /read off a value/);
	assert.match(cvQueryNewProblemGet(info, 'a b/c'), /no segment of a path/);
	assert.match(cvQueryNewProblemGet(info, '$version/x'), /no segment of a path/);
	assert.match(cvQueryNewProblemGet(info, 'hobby@1'), /no version yet/);
});

test('/new lists where to go on, and the path as a new value', () => {
	const walk = (param) => cvQueryNewSlashItemListGet(info, param);
	// nothing typed of a segment: the folders to go under, no value
	assert.deepEqual(walk('').map((item) => [item.kind, item.label]), [['dir', 'name/'], ['dir', 'pr/'], ['dir', 'birth/'], ['dir', 'edu/']]);
	assert.deepEqual(walk('pr/'), []);
	assert.deepEqual(walk('hobby').map((item) => [item.kind, item.query]), [['new', 'hobby']]);
	assert.deepEqual(walk('name/jp/first/nick').map((item) => [item.kind, item.query]), [['new', 'name/jp/first/nick']]);
	// a start of a folder: the new value first, the folder to go on in after it
	assert.deepEqual(walk('na').map((item) => item.kind), ['new', 'dir']);
	// a path that holds a value is offered as that value; a folder says why not
	assert.deepEqual(walk('pr/en').map((item) => [item.kind, item.query]), [['query', 'pr/en']]);
	assert.deepEqual(walk('name/jp').map((item) => item.kind), ['dir', 'note']);
	assert.match(walk('name/jp')[1].label, /is a folder holding values/);
});
