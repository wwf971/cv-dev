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

test('a brace token of another kind is not a query', () => {
	// {{@…}} is a token of react-doc's cell editing kit (a view of an object): text here
	const expanded = cvTextExpand(info, '{{name/jp/first}} {{@frontend:w5j7#/book/dune}}', {});
	assert.equal(expanded.text, '太郎 {{@frontend:w5j7#/book/dune}}');
	assert.deepEqual(expanded.missingList, []);
});

test('a profile seen from outside: an inner path is a partition and a query', async () => {
	const { cvProfileInnerComplete, cvProfileInnerResolve, cvProfileInnerSplit } = await import('./CvProfile.js');
	// a profile as the api of a mode gives it: its data items of the kind info, by partition
	const dataByKey = {
		name: { '{jp/first/}': { kanji: '太郎', hiragana: 'たろう' }, '{en, first}': 'Taro' },
		birth: { year: 1998, month: 8, day: 17 },
		photo: 'data:image/png;base64,AAAA',
		real: { '{jp/first/}': { kanji: '次郎' } },
	};
	const assetList = [
		{ key: 'name', kind: 'info', status: 'found', pathList: ['/example/info/name'] },
		{ key: 'birth', kind: 'info', status: 'found', pathList: ['/example/info/birth'] },
		{ key: 'photo', kind: 'info', status: 'found', pathList: ['/example/info/photo'] },
		{ key: 'real', kind: 'info', status: 'found', pathList: ['/real/info/name'] },
	];
	const profile = {
		partitionList: [{ id: 'example', label: 'Example' }, { id: 'real', label: 'My data', isGitIgnored: true }],
		assetList: () => assetList,
		assetDataGet: (key) => ({ status: 'done', data: dataByKey[key] }),
	};
	assert.deepEqual(cvProfileInnerSplit(profile, 'example/name/jp/first'), { partition: 'example', query: 'name/jp/first' });
	assert.deepEqual(cvProfileInnerSplit(profile, 'name/jp/first'), { partition: '', query: 'name/jp/first' });

	const first = cvProfileInnerResolve(profile, 'example/name/first/jp');
	assert.deepEqual([first.status, first.path, first.label, first.text, first.kind], ['found', 'example/name/first/jp', 'name/first/jp', '太郎', 'value']);
	// each partition is its own profile
	assert.equal(cvProfileInnerResolve(profile, 'real/name/jp/first').text, '次郎');
	assert.equal(cvProfileInnerResolve(profile, 'example/name/jp/none').status, 'unknown');
	// an image is not a text to draw in a line
	assert.equal(cvProfileInnerResolve(profile, 'example/photo').text, undefined);

	// the partitions first, then what /query lists inside one
	assert.deepEqual(cvProfileInnerComplete(profile, '').itemList.map((item) => [item.kind, item.path]), [['dir', 'example/'], ['dir', 'real/']]);
	assert.deepEqual(cvProfileInnerComplete(profile, 'ex').itemList.map((item) => item.path), ['example/']);
	const top = cvProfileInnerComplete(profile, 'example/').itemList;
	assert.ok(top.some((item) => item.kind === 'dir' && item.path === 'example/name/'));
	assert.ok(top.some((item) => item.kind === 'dir' && item.path === 'example/birth/'));
	const below = cvProfileInnerComplete(profile, 'example/name/jp/first/').itemList;
	assert.deepEqual(below.map((item) => [item.kind, item.path, item.detail]), [['item', 'example/name/jp/first/kanji', '太郎'], ['item', 'example/name/jp/first/hiragana', 'たろう']]);

	// while the data of an item is on its way, the answer says so
	const profileLoading = { ...profile, assetDataGet: () => ({ status: 'loading' }) };
	assert.equal(cvProfileInnerResolve(profileLoading, 'example/name/jp/first').status, 'loading');
	assert.equal(cvProfileInnerComplete(profileLoading, 'example/name/').status, 'loading');
});

test('a year with its era: a year written out, or a date of the profile, which stays one query of its year', async () => {
	const { cvEraRead, cvEraResolve, cvEraSlashItemListGet, cvInfoBuild: infoBuild, cvTextExpand: textExpand } = await import('./CvQuery.js');
	const infoEra = infoBuild([
		{ key: 'birth', pathList: ['/info/birth'], data: { year: 2000, month: 1, day: 1 } },
		{ key: 'edu', pathList: ['/info/edu/x'], data: { start: { year: 2019, month: 4, jp: '入学' }, end: { year: 2019, month: 5 } } },
	]);
	// what a token names: a year written out (its month decides the era), or a date by its path
	assert.deepEqual(cvEraRead('2019/5'), { kind: 'literal', year: '2019', month: '5' });
	assert.deepEqual(cvEraRead('2019-05'), { kind: 'literal', year: '2019', month: '5' });
	assert.deepEqual(cvEraRead('2019'), { kind: 'literal', year: '2019', month: '' });
	assert.deepEqual(cvEraRead('edu/x/start/year'), { kind: 'path', path: 'edu/x/start' });
	assert.equal(cvEraRead('12ab'), undefined);
	assert.equal(cvEraRead(''), undefined);
	const eraOf = (body) => { const one = cvEraResolve(infoEra, cvEraRead(body)); return [one.status, one.era, one.year]; };
	assert.deepEqual(eraOf('2019/4'), ['found', '平成31', '2019']);
	assert.deepEqual(eraOf('edu/x/end'), ['found', '令和元', '2019']);
	assert.deepEqual(eraOf('birth'), ['found', '平成12', '2000']);
	assert.deepEqual(eraOf('nothing'), ['missing', '', '']);
	// in a text: its plain text is the year; kept as written where its token draws it
	const literal = textExpand(infoEra, '取得 {{era:2019/5}}年');
	assert.deepEqual([literal.text, literal.textKept, literal.missingList], ['取得 2019年', '取得 {{era:2019/5}}年', []]);
	// a cell holding a date of the profile alone is one query of its year: changed in the profile as any other
	const one = textExpand(infoEra, '{{era:edu/x/start}}');
	assert.deepEqual([one.text, one.query, one.leaf.keyPath.join('.')], ['2019', 'edu/x/start/year', 'start.year']);
	assert.deepEqual(textExpand(infoEra, '{{era:edu/y/start}}').missingList, ['edu/y/start/year']);
	// what follows "|" is how a token is drawn in its place, never part of a query
	assert.equal(textExpand(infoEra, '{{birth/year|anything}}').text, '2000');
	// /era: a year typed, or the dates of the profile whose path holds what is typed
	assert.deepEqual(cvEraSlashItemListGet(infoEra, '2019/4').map((item) => [item.kind, item.body, item.detail]), [['literal', '2019/4', '平成31 over 2019 (month 4)']]);
	assert.deepEqual(cvEraSlashItemListGet(infoEra, 'edu').map((item) => item.body), ['edu/x/start', 'edu/x/end']);
	assert.deepEqual(cvEraSlashItemListGet(infoEra, '').map((item) => item.body), ['birth', 'edu/x/start', 'edu/x/end']);
});

test('a key a profile uses for its own values is no spelling of a format: title reads the title as it is written', async () => {
	const { cvInfoBuild: infoBuild, cvQueryResolve: queryResolve, cvQueryParse: queryParse } = await import('./CvQuery.js');
	const infoProject = infoBuild([{ key: 'p', pathList: ['/info/work/acme/project/tool'], data: { jp: { summary: 'first in the data', title: 'AIを活用したシステム' } } }]);
	const resolved = queryResolve(infoProject, 'work/acme/project/tool/jp/title');
	// the value at that key, not the first value below jp put through a format
	assert.deepEqual([resolved.value, resolved.leaf.keyPath.join('.'), resolved.by], ['AIを活用したシステム', 'jp.title', 'stored']);
	assert.deepEqual(queryParse('work/acme/jp/title').formatList, []);
	assert.deepEqual(queryParse('name/en/first/capitalize').formatList, ['uppercase-first']);
});

test('a period: a folder of the profile with a start, two dates, or dates written out', async () => {
	const { cvPeriodRead, cvPeriodResolve, cvPeriodSlashItemListGet, cvInfoBuild: infoBuild, cvTextExpand: textExpand } = await import('./CvQuery.js');
	const infoWork = infoBuild([
		{ key: 'e', pathList: ['/info/work/acme'], data: { start: { year: 2026, month: 4 }, jp: { name: 'Acme' } } },
		{ key: 'p', pathList: ['/info/work/acme/project/tool'], data: { start: { year: 2019, month: 4 }, end: { year: 2019, month: 5 } } },
		{ key: 'o', pathList: ['/info/work/acme/project/other'], data: { jp: { title: 'other' } } },
	]);
	// what a token names
	assert.deepEqual(cvPeriodRead('work/acme'), { start: { kind: 'path', path: 'work/acme/start' }, end: { kind: 'path', path: 'work/acme/end' }, folder: 'work/acme' });
	assert.deepEqual(cvPeriodRead('2026/5~2026/10'), { start: { kind: 'literal', year: '2026', month: '5' }, end: { kind: 'literal', year: '2026', month: '10' } });
	assert.deepEqual(cvPeriodRead('2026/5〜'), { start: { kind: 'literal', year: '2026', month: '5' }, end: undefined });
	assert.equal(cvPeriodRead('~2026'), undefined);
	// what it reads: no end is 現在, no date at all is nothing
	const textOf = (body) => { const one = cvPeriodResolve(infoWork, cvPeriodRead(body)); return [one.text, one.isNow, one.isTimeless]; };
	assert.deepEqual(textOf('work/acme'), ['2026年4月〜現在', true, false]);
	assert.deepEqual(textOf('work/acme/project/tool'), ['2019年4月〜2019年5月', false, false]);
	assert.deepEqual(textOf('work/acme/project/other'), ['', true, true]);
	assert.deepEqual(textOf('work/acme/start~2027'), ['2026年4月〜2027年', false, false]);
	// its dates carry their era: the months of 2019 decide it
	const resolved = cvPeriodResolve(infoWork, cvPeriodRead('work/acme/project/tool'));
	assert.deepEqual([resolved.start.era, resolved.end.era], ['平成31', '令和元']);
	// in a text: said as one text, kept as written where its token draws it, never a missing query
	const expanded = textExpand(infoWork, '在籍 {{period:work/acme|era}}');
	assert.deepEqual([expanded.text, expanded.textKept, expanded.missingList, expanded.period], ['在籍 2026年4月〜現在', '在籍 {{period:work/acme|era}}', [], undefined]);
	assert.equal(textExpand(infoWork, '{{period:work/acme}}').period.folder, 'work/acme');
	// /period: a period typed, or the folders of the profile holding a start
	assert.deepEqual(cvPeriodSlashItemListGet(infoWork, '').map((item) => [item.body, item.detail]), [['work/acme', '2026年4月〜現在'], ['work/acme/project/tool', '2019年4月〜2019年5月']]);
	assert.deepEqual(cvPeriodSlashItemListGet(infoWork, '2026/5~2026/10').map((item) => [item.kind, item.detail]), [['literal', '2026年5月〜2026年10月']]);
});
