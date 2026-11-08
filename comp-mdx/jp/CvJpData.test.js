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
