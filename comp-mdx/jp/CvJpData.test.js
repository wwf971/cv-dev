import assert from 'node:assert/strict';
import test from 'node:test';
import { cvInfoBuild } from '../query/CvQuery.js';
import {
	CV_JP_TEMPLATE_DEFAULT, cvJpCellGet, cvJpDateGet, cvJpDateVirtualBuild, cvJpGenderIs, cvJpInstanceRead, cvJpRowListBuild, cvJpSheetBuild, cvJpTemplateRead,
} from './CvJpData.js';

const date = new Date(2026, 10, 8);
const info = cvInfoBuild([
	{ key: 'name', path: '/info/name', data: { jp: { last: { kanji: '山田', hiragana: 'やまだ' }, first: { kanji: '太郎', hiragana: 'たろう' } }, en: { last: 'Yamada', first: 'Taro' } } },
	{ key: 'birth', path: '/info/birth', data: { year: 1998, month: 8, day: 17 } },
	{ key: 'edu', path: '/info/edu/bachelor', data: { end: { year: 2020, month: 3, jp: '卒業' }, start: { year: 2016, month: 4, jp: '入学' } } },
], cvJpDateVirtualBuild(date));
const context = { dateNow: date };
const template = cvJpTemplateRead(CV_JP_TEMPLATE_DEFAULT);

test('a cell says what the default says, unless a template or an instance overrides it', () => {
	const instance = cvJpInstanceRead({});
	const cell = cvJpCellGet('name-last', template, instance, info, context);
	assert.equal(cell.text, '山田');
	assert.equal(cell.source, 'default');
	assert.equal(cell.leaf.keyPath.join('.'), 'jp.last.kanji');
	const hardCoded = cvJpCellGet('name-last', template, cvJpInstanceRead({ valueByCell: { 'name-last': 'YAMADA' } }), info, context);
	assert.deepEqual([hardCoded.text, hardCoded.isOverride, hardCoded.leaf], ['YAMADA', true, undefined]);
	const query = cvJpCellGet('name-last', template, cvJpInstanceRead({ valueByCell: { 'name-last': '{{name/en/last/upper}}' } }), info, context);
	assert.equal(query.text, 'YAMADA');
	const ofTemplate = cvJpCellGet('name-last', cvJpTemplateRead({ cellById: { 'name-last': '{{name/en/last}}' } }), instance, info, context);
	assert.deepEqual([ofTemplate.text, ofTemplate.source], ['Yamada', 'template']);
});

test('the date and the age are read at the date of the instance', () => {
	assert.equal(cvJpCellGet('date', template, cvJpInstanceRead({}), info, context).text, '2026年11月08日現在');
	assert.equal(cvJpCellGet('age', template, cvJpInstanceRead({}), info, context).text, '28');
	assert.equal(cvJpDateGet('2020-01-15').getFullYear(), 2020);
	assert.equal(cvJpDateGet('not a date', date), date);
});

test('the rows of a group: entries of the profile, hidden ones marked, the rows of this CV in order', () => {
	const instance = cvJpInstanceRead({
		rowExtraByGroup: { edu: [{ year: 2018, month: 6, text: '留学' }] },
		rowHiddenByGroup: { edu: ['edu:end'] },
	});
	const rowList = cvJpRowListBuild({ id: 'edu', list: 'edu/jp' }, instance, info);
	assert.deepEqual(rowList.map((row) => [row.year, row.text, row.isExtra === true, row.isHidden === true]), [
		['2016', '入学', false, false],
		['2018', '留学', true, false],
		['2020', '卒業', false, true],
	]);
});

test('the sheet: sections, optional rows only when something is said', () => {
	const sheet = cvJpSheetBuild({ template, instance: cvJpInstanceRead({}), info, context });
	assert.deepEqual(sheet.sectionList.map((section) => section.type), ['basic', 'history', 'history', 'text']);
	assert.equal(sheet.rowOptionalList.every((row) => !row.isShown), true);
	const sheetLink = cvJpSheetBuild({ template, instance: cvJpInstanceRead({ valueByCell: { github: 'github.com/x' } }), info, context });
	assert.equal(sheetLink.rowOptionalList.find((row) => row.id === 'link').isShown, true);
	assert.equal(cvJpTemplateRead({ sectionList: [{ type: 'text' }] }).sectionList[0].id, 'section-0');
});

test('gender in the words people write', () => {
	assert.equal(cvJpGenderIs('male', 'male'), true);
	assert.equal(cvJpGenderIs('女', 'female'), true);
	assert.equal(cvJpGenderIs('', 'male'), false);
});

test('the order of the rows: a CV may give its own; rows it does not name follow in order of time', async () => {
	const { cvJpRowListBuild, cvJpRowOrderMove, cvJpInstanceRead } = await import('./CvJpData.js');
	const { cvInfoBuild } = await import('../query/CvQuery.js');
	const info = cvInfoBuild([
		{ key: 'a', pathList: ['/info/work/a'], data: { year: 2020, month: 4, jp: 'A' } },
		{ key: 'b', pathList: ['/info/work/b'], data: { year: 2022, month: 4, jp: 'B' } },
	]);
	const group = { id: 'work', list: 'work/jp' };
	const instanceOf = (data) => cvJpInstanceRead({ rowExtraByGroup: { work: [{ id: 'rx', year: 2021, text: 'X' }] }, ...data });
	const textOf = (instance) => cvJpRowListBuild(group, instance, info).map((row) => row.text);
	assert.deepEqual(textOf(instanceOf({})), ['A', 'X', 'B']);
	const idList = cvJpRowListBuild(group, instanceOf({}), info).map((row) => row.id);
	assert.equal(idList[1], 'extra:work:rx');
	const moved = cvJpRowOrderMove(idList, idList[2], idList[0], false);
	assert.deepEqual(textOf(instanceOf({ rowOrderByGroup: { work: moved } })), ['B', 'A', 'X']);
	// a row the order does not name comes after, in order of time
	assert.deepEqual(textOf(instanceOf({ rowOrderByGroup: { work: [idList[2]] } })), ['B', 'A', 'X']);
	assert.deepEqual(cvJpRowOrderMove(['a', 'b', 'c'], 'a', 'c', true), ['b', 'c', 'a']);
});

test('pages: a history cut between rows, never after a heading; a text cut between lines', async () => {
	const { cvJpHistorySplit, cvJpTextSplit } = await import('./CvJpPaginationData.js');
	const data = {
		id: 'history', title: '学 歴・職 歴', isNote: false,
		groupList: [
			{ id: 'edu', title: '学 歴', rowList: [{ id: 'e1', text: 'a' }, { id: 'e2', text: 'b' }] },
			{ id: 'work', title: '職 歴', rowList: [{ id: 'w1', text: 'c' }, { id: 'w2', text: 'd' }, { id: 'w3', text: 'e' }] },
		],
	};
	// the rows as measured: a break after each row (the headings are no break)
	const measured = { height: 300, breakList: [['e1', 80], ['e2', 120], ['w1', 200], ['w2', 240], ['w3', 280]].map(([key, bottom]) => ({ key, top: bottom - 40, bottom })) };
	const cut = cvJpHistorySplit(data, { space: 210, measured });
	assert.equal(cut.breakKey, 'w1');
	assert.equal(cut.head.isCutBelow, true);
	assert.deepEqual(cut.head.groupList.map((group) => group.rowList.map((row) => row.id)), [['e1', 'e2'], ['w1']]);
	assert.deepEqual(cut.tail.groupList.map((group) => [group.id, group.isContinued === true, group.rowList.map((row) => row.id)]), [['work', true, ['w2', 'w3']]]);
	// cut at the end of a group: the next group starts the tail with its heading
	const atEnd = cvJpHistorySplit(data, { space: 150, measured });
	assert.deepEqual(atEnd.tail.groupList.map((group) => [group.id, group.isContinued === true]), [['work', false]]);
	assert.equal(cvJpHistorySplit(data, { space: 50, measured }), null);
	const text = { id: 'motivation', title: '志 望 の 動 機', text: 'line one\nline two\nline three' };
	const measuredText = { height: 200, textList: [{ key: 'text', lineList: [{ offset: 0, top: 40, bottom: 60 }, { offset: 9, top: 60, bottom: 80 }, { offset: 18, top: 80, bottom: 100 }] }] };
	const cutText = cvJpTextSplit(text, { space: 90, measured: measuredText });
	assert.deepEqual([cutText.head.text, cutText.tail.text, cutText.tail.isContinued], ['line one\nline two', 'line three', true]);
});
