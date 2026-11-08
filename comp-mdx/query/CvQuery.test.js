import assert from 'node:assert/strict';
import test from 'node:test';
import {
	cvDataRemove, cvDataSet, cvEntryListResolve, cvInfoBuild, cvLeafPlaceGet, cvQueryComplete, cvQueryParse, cvQueryResolve, cvTextExpand,
} from './CvQuery.js';
import { cvAgeGet, cvHiraganaToKatakana, cvKanaToRomaji, cvKatakanaToHiragana, cvUppercaseFirst, cvYearEraGet } from './CvText.js';

const info = cvInfoBuild([
	{
		key: 'name',
		pathList: ['/info/name'],
		data: {
			'{jp/last/}': { kanji: '山田', hiragana: 'やまだ' },
			'{jp/first/}': { kanji: '太郎', hiragana: 'たろう', romaji: 'Taro' },
			'{en, last}': 'Yamada',
			'{en, first}': 'Taro',
		},
	},
	{ key: 'birth', pathList: ['/info/birth'], data: { year: 1998, month: 8, day: 17 } },
	{
		key: 'edu',
		pathList: ['/info/edu/bachelor'],
		data: {
			end: { year: 2020, month: 3, jp: ['東京大学 卒業', '学士 取得'], en: 'Graduated' },
			start: { year: 2016, month: 4, jp: '東京大学 入学', en: 'Entered', note: { jp: '学部' } },
		},
	},
	{ key: 'work', pathList: ['/info/work/company'], data: { year: 2020, month: '7-8', jp: 'ある会社', note: 'インターン' } },
	{ key: 'address', pathList: ['/info/[address, addr]'], data: { jp: { postal: '〒100-0001', text: '東京都' } } },
]);
const value = (text) => cvQueryResolve(info, text, { dateNow: new Date(2026, 10, 8) }).value;

test('a query is a path: only the members of a group {…} commute', () => {
	assert.equal(value('name/jp/first'), '太郎');
	assert.equal(value('name/first/jp'), '太郎');
	assert.equal(value('name/jp/first/kanji'), '太郎');
	assert.equal(value('name/first/jp/hiragana'), 'たろう');
	// outside a group, order is the order of the data
	assert.equal(cvQueryResolve(info, 'first/name/jp').status, 'missing');
	assert.equal(cvQueryResolve(info, 'name/jp/kanji/first').status, 'missing');
	assert.equal(cvQueryResolve(info, 'address/text/jp').status, 'missing');
	assert.equal(value('address/jp/text'), '東京都');
	// an item path with a choice: either spelling of the item
	assert.equal(value('addr/jp/postal'), '〒100-0001');
	assert.equal(cvQueryParse('name/first/jp').text, 'name/first/jp');
});

test('a leaf keeps its pattern and its canonical path', () => {
	const leaf = cvQueryResolve(info, 'name/last/jp/kanji').leaf;
	assert.equal(leaf.pathText, 'name/{jp/last/}kanji');
	assert.equal(leaf.path, 'name/jp/last/kanji');
	assert.deepEqual(leaf.keyPath, ['{jp/last/}', 'kanji']);
	assert.equal(cvQueryResolve(info, 'name/last/en').leaf.pathText, 'name/{en, last}');
	// a key ending the path written as going on, or the other way, reads the same
	const either = cvInfoBuild([{ key: 'a', pathList: ['/info/a'], data: { '{p, q}': { x: 1 }, '{r/s/}': 2 } }]);
	assert.equal(cvQueryResolve(either, 'a/q/p/x').value, '1');
	assert.equal(cvQueryResolve(either, 'a/s/r').value, '2');
	assert.equal(either.problemList.length, 0);
	assert.equal(info.problemList.length, 0);
});

test('the first in the order of the data is the default; an exact match goes first', () => {
	assert.equal(value('name/first'), '太郎');
	assert.equal(value('name/en/first'), 'Taro');
	const resolved = cvQueryResolve(info, 'name/jp/first');
	assert.equal(resolved.leaf.keyPath.join('.'), '{jp/first/}.kanji');
	assert.deepEqual(resolved.alternativeList.map((leaf) => leaf.value), ['たろう', 'Taro']);
});

test('formats and other scripts are derived: a format ends the query, a script stands in its place', () => {
	assert.equal(value('name/jp/first/romaji/uppercase-all'), 'TARO');
	assert.equal(value('name/jp/first/romaji/lowercase-all/uppercase-first'), 'Taro');
	assert.equal(cvQueryResolve(info, 'uppercase-first/name/jp/first/romaji').status, 'missing');
	assert.equal(value('name/en/last/upper'), 'YAMADA');
	assert.equal(value('name/first/jp/hiragana'), 'たろう');
	assert.equal(value('name/first/jp/katakana'), 'タロウ');
	assert.equal(value('name/last/jp/katakana'), 'ヤマダ');
	assert.equal(value('name/last/jp/romaji'), 'yamada');
	assert.equal(value('name/last/jp/romaji/uppercase-first'), 'Yamada');
});

test('spellings of a segment are one segment', () => {
	assert.equal(value('name/ja/family/furigana'), 'やまだ');
	assert.equal(value('name/japanese/family/kanji'), '山田');
	assert.equal(value('name/jp/first/romnaji/uppercase-all'), 'TARO');
	assert.equal(value('name/first/jp/katanaka'), 'タロウ');
});

test('a name asked for as a whole is joined, in the order of its language', () => {
	assert.equal(value('name/jp/kanji'), '山田 太郎');
	assert.equal(value('name/jp/hiragana'), 'やまだ たろう');
	assert.equal(value('name/jp'), '山田 太郎');
	assert.equal(value('name/en'), 'Taro Yamada');
	assert.equal(value('name/en/uppercase-all'), 'TARO YAMADA');
	assert.equal(cvQueryResolve(info, 'name/jp').leaf, undefined);
});

test('dates: their keys, the era, the age on a given day', () => {
	assert.equal(value('birth/year'), '1998');
	assert.equal(value('birth/era'), '平成10');
	assert.equal(value('birth/age'), '28');
	assert.equal(cvQueryResolve(info, 'birth/age', { dateNow: new Date(2026, 7, 16) }).value, '27');
	assert.equal(value('edu/bachelor/start/era'), '平成28');
});

test('what is not there is missing, with why', () => {
	const resolved = cvQueryResolve(info, 'name/jp/middle');
	assert.equal(resolved.status, 'missing');
	assert.match(resolved.message, /nothing holds/);
	assert.equal(cvQueryResolve(info, '').status, 'missing');
	assert.equal(cvQueryResolve(info, 'name/age').status, 'missing');
});

test('a text holds queries beside literal words', () => {
	const expanded = cvTextExpand(info, '{{birth/month}}月{{birth/day}}日', {});
	assert.equal(expanded.text, '8月17日');
	assert.equal(expanded.leaf, undefined);
	assert.equal(cvTextExpand(info, 'plain').text, 'plain');
	assert.equal(cvTextExpand(info, '{{name/jp/first}}').leaf.keyPath.join('.'), '{jp/first/}.kanji');
	assert.deepEqual(cvTextExpand(info, 'a {{no/such}}').missingList, ['no/such']);
});

test('entries come in order of time, with the text of the language asked for', () => {
	const list = cvEntryListResolve(info, 'edu/jp');
	assert.deepEqual(list.map((entry) => entry.year), ['2016', '2020']);
	assert.equal(list[0].text, '東京大学 入学');
	assert.equal(list[0].note, '学部');
	assert.equal(list[1].text, '東京大学 卒業\n学士 取得');
	assert.equal(list[1].isTextList, true);
	assert.equal(cvEntryListResolve(info, 'edu/bachelor/jp').length, 2);
	assert.equal(cvEntryListResolve(info, 'edu/bachelor/start/jp').length, 1);
	assert.equal(cvEntryListResolve(info, 'jp/edu/bachelor').length, 0);
	assert.equal(cvEntryListResolve(info, 'edu/en')[0].text, 'Entered');
	// an entry holding nothing the query chooses is left out
	assert.equal(cvEntryListResolve(info, 'work/en').length, 0);
	const [work] = cvEntryListResolve(info, 'work/jp');
	assert.equal(work.month, '7-8');
	assert.equal(work.note, 'インターン');
});

test('completion continues the path typed, a group in any order', () => {
	const complete = cvQueryComplete(info, 'name/first/');
	assert.deepEqual(complete.segmentList.map((one) => one.segment), ['jp', 'en']);
	assert.deepEqual(complete.leafList.map((one) => one.query), ['name/first/jp/kanji', 'name/first/jp/hiragana', 'name/first/jp/romaji', 'name/first/en']);
	assert.deepEqual(cvQueryComplete(info, 'name/jp/first/ka').segmentList.map((one) => one.segment), ['kanji']);
	assert.deepEqual(cvQueryComplete(info, 'name/').segmentList.map((one) => `${one.segment}:${one.count}`), ['jp:5', 'last:3', 'first:4', 'en:2']);
	assert.deepEqual(cvQueryComplete(info, 'nothing/').segmentList, []);
});

test('writing a value: data set and removed, the place of a new one', () => {
	const data = { jp: { first: 'a', last: 'b' } };
	assert.deepEqual(cvDataSet(data, ['jp', 'first'], 'c'), { jp: { first: 'c', last: 'b' } });
	assert.deepEqual(data.jp.first, 'a');
	assert.deepEqual(cvDataSet({}, ['a', 'b'], 1), { a: { b: 1 } });
	assert.deepEqual(cvDataRemove(data, ['jp', 'first']), { jp: { last: 'b' } });
	assert.deepEqual(cvDataRemove({ jp: { first: 'a' } }, ['jp', 'first']), {});
	assert.deepEqual(cvLeafPlaceGet(info, 'name/fr/first'), { assetKey: 'name', keyPath: ['fr', 'first'] });
	// into the mapping of the group, whichever order the path takes it in
	assert.deepEqual(cvLeafPlaceGet(info, 'name/last/jp/katakana'), { assetKey: 'name', keyPath: ['{jp/last/}', 'katakana'] });
	assert.deepEqual(cvLeafPlaceGet(info, 'name/jp/last/kanji'), { assetKey: 'name', keyPath: ['{jp/last/}', 'kanji'] });
	assert.deepEqual(cvLeafPlaceGet(info, 'addr/jp/fax'), { assetKey: 'address', keyPath: ['jp', 'fax'] });
	assert.deepEqual(cvLeafPlaceGet(info, 'phone/jp'), { assetKey: '', pathNew: '/info/phone', keyPath: ['jp'] });
	assert.deepEqual(cvLeafPlaceGet(cvInfoBuild([], { date: { jp: 'x' } }), 'date/en'), { assetKey: '', pathNew: '/info/date', keyPath: ['en'] });
});

test('the words of the text helpers', () => {
	assert.equal(cvHiraganaToKatakana('きょうと'), 'キョウト');
	assert.equal(cvKatakanaToHiragana('キョウト'), 'きょうと');
	assert.equal(cvKanaToRomaji('きょうと'), 'kyouto');
	assert.equal(cvKanaToRomaji('まっちゃ'), 'matcha');
	assert.equal(cvKanaToRomaji('はっとり'), 'hattori');
	assert.equal(cvUppercaseFirst('TARO yamada'), 'Taro Yamada');
	assert.equal(cvYearEraGet(2019), '令和元');
	assert.equal(cvYearEraGet(2019, 4), '平成31');
	assert.equal(cvYearEraGet(1998), '平成10');
	assert.equal(cvAgeGet({ year: 2000, month: 1, day: 1 }, new Date(2026, 0, 1)), '26');
});

test('partitions: the first folder of a path, unless it is a kind; a new value goes into the partition', async () => {
	const { cvInfoCreateInput, cvPartitionListGet, cvPathInPartition, cvPathSplit } = await import('./CvProfile.js');
	assert.deepEqual(cvPathSplit('/example/info/name'), { partition: 'example', pathInPartition: '/info/name' });
	assert.deepEqual(cvPathSplit('/info/name'), { partition: '', pathInPartition: '/info/name' });
	assert.deepEqual(cvPathSplit('/real/instance/2026'), { partition: 'real', pathInPartition: '/instance/2026' });
	assert.equal(cvPathInPartition('real', '/info/phone'), '/real/info/phone');
	assert.equal(cvPathInPartition('', '/info/phone'), '/info/phone');
	const service = { partitionList: [{ id: 'example', label: 'Example' }, { id: 'real', label: 'My data', isGitIgnored: true }] };
	assert.deepEqual(cvPartitionListGet(service, [{ pathList: ['/mine/info/x'] }, { pathList: ['/real/info/y'] }]).map((one) => one.id), ['example', 'real', 'mine']);
	assert.deepEqual(cvInfoCreateInput('real', { pathNew: '/info/phone' }, 'x'), { kind: 'info', pathList: ['/real/info/phone'], partition: 'real', data: 'x' });
});

test('what a data item says that is no pattern is reported, never fatal', () => {
	const read = cvInfoBuild([
		{ key: 'a', pathList: ['/info/a'], data: { '{x': 1, '{y/z}': 3 } },
		{ key: 'b', pathList: ['/other/b'], data: 1 },
		{ key: 'c', pathList: ['/info/a/{x'], data: 2 },
	]);
	assert.equal(read.leafList.length, 2);
	assert.equal(cvQueryResolve(read, 'a/{x').value, '1');
	assert.equal(read.problemList.length, 4);
	assert.match(read.problemList[1], /all end with "\/"/);
	const twice = cvInfoBuild([{ key: 'a', pathList: ['/info/a'], data: { '{p, q}': 1, q: { p: 2 } } }]);
	assert.match(twice.problemList[0], /claimed by a\/\{p, q\} and a\/q\/p/);
	assert.equal(cvQueryResolve(twice, 'a/q/p').value, '1');
});

test('a script nothing holds is missing, not derived around in a circle', () => {
	const info = cvInfoBuild([]);
	for (const query of ['name/first/jp/katakana', 'name/first/jp/hiragana', 'name/first/jp/romaji']) {
		assert.equal(cvQueryResolve(info, query).status, 'missing', query);
	}
});

test('/query lists what is below the folder typed, a segment at a time, with the values', async () => {
	const { cvQuerySlashItemListGet } = await import('./CvQuery.js');
	const label = (param) => cvQuerySlashItemListGet(info, param).map((item) => `${item.kind}:${item.label}=${item.detail}`);
	assert.deepEqual(label('').slice(0, 3), ['dir:name/=7 values', 'dir:birth/=3 values', 'dir:edu/=9 values']);
	assert.deepEqual(label('name/'), ['dir:jp/=5 values', 'dir:last/=3 values', 'dir:first/=4 values', 'dir:en/=2 values']);
	assert.deepEqual(label('name/la'), ['dir:last/=3 values']);
	// the path itself when it reads a value, then the folder to go on
	assert.deepEqual(label('name/jp/last'), ['query:name/jp/last=山田', 'dir:last/=2 values']);
	assert.deepEqual(label('name/last/'), ['dir:jp/=2 values', 'value:en=Yamada']);
	assert.deepEqual(label('name/last/jp/'), ['value:kanji=山田', 'value:hiragana=やまだ']);
	const [dir] = cvQuerySlashItemListGet(info, 'name/');
	assert.equal(dir.paramNext, 'name/jp/');
	const [value] = cvQuerySlashItemListGet(info, 'name/last/jp/');
	assert.equal(value.query, 'name/last/jp/kanji');
	// a script derived counts as reading a value
	assert.deepEqual(label('name/last/jp/katakana'), ['query:name/last/jp/katakana=ヤマダ']);
	assert.match(label('edu/bachelor/end/')[0], /value:year=2020/);
});
