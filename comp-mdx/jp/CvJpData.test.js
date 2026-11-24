import assert from 'node:assert/strict';
import test from 'node:test';
import { cvInfoBuild } from '../query/CvQuery.js';
import {
	CV_JP_TEMPLATE_DEFAULT, CV_KIND_CV, CV_KIND_WE, cvJpCellGet, cvJpEducationLastGet, cvJpDateGet, cvJpDateVirtualBuild, cvJpFormGet, cvJpGenderIs, cvJpInstanceRead, cvJpPartTemplateListGet,
	cvJpPaperCopyGet, cvJpPartOptionListGet, cvJpRowListBuild, cvJpSectionLabelGet, cvJpSectionListResolve, cvJpSectionNew, cvJpSectionOrderInsert, cvJpSectionOrderMove, cvJpSheetBuild, cvJpTemplateRead,
	cvJpTextLineListBuild, cvJpTextLineReplace,
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
	const cell = cvJpCellGet('name-last', { template, instance, info, context });
	assert.equal(cell.text, '山田');
	assert.equal(cell.source, 'default');
	assert.equal(cell.leaf.keyPath.join('.'), 'jp.last.kanji');
	const hardCoded = cvJpCellGet('name-last', { template, instance: cvJpInstanceRead({ valueByCell: { 'name-last': 'YAMADA' } }), info, context });
	assert.deepEqual([hardCoded.text, hardCoded.isOverride, hardCoded.leaf, hardCoded.isQueryFree], ['YAMADA', true, undefined, true]);
	const query = cvJpCellGet('name-last', { template, instance: cvJpInstanceRead({ valueByCell: { 'name-last': '{{name/en/last/upper}}' } }), info, context });
	assert.deepEqual([query.text, query.isQueryFree], ['YAMADA', false]);
	const ofTemplate = cvJpCellGet('name-last', { template: cvJpTemplateRead({ cellById: { 'name-last': '{{name/en/last}}' } }), instance, info, context });
	assert.deepEqual([ofTemplate.text, ofTemplate.source], ['Yamada', 'template']);
	// what a section says of a cell of its own (the query of a value) is below the paper and its template
	const ofSection = cvJpCellGet('career:x:name', { template, instance, info, context, rawDefault: '{{name/en/first}}' });
	assert.deepEqual([ofSection.text, ofSection.source], ['Taro', 'template']);
	// a badge is no query: the text cut into lines keeps it as written
	const withBadge = cvJpCellGet('x', { template, instance, info, context, rawDefault: '{{name/en/first}} {{/badge/aws/saa}}' });
	assert.equal(withBadge.textExpanded, 'Taro {{/badge/aws/saa}}');
});

test('the date and the age are read at the date of the instance', () => {
	assert.equal(cvJpCellGet('date', { template, instance: cvJpInstanceRead({}), info, context }).text, '2026年11月08日現在');
	assert.equal(cvJpCellGet('age', { template, instance: cvJpInstanceRead({}), info, context }).text, '28');
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

test('pages: a history cut between rows, never after a heading; a block cut between its lines', async () => {
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
	// a block: a line is what its author wrote as one. a heading stays with what follows it, and
	// the part going on does not start with an empty line
	const blockOf = (text) => ({ id: 'pr', title: '自己PR', lineList: cvJpTextLineListBuild(text).map((line, index) => ({ ...line, index })) });
	// every drawn line 20px tall under a title of 40px (an empty line is no place to cut)
	const measuredOf = (block, heightByIndex = {}) => {
		let top = 40;
		const breakList = [];
		for (const line of block.lineList) {
			if (line.kind === 'blank') continue;
			const height = heightByIndex[line.index] ?? 20;
			breakList.push({ key: `line-${line.index}`, top, bottom: top + height });
			top += height;
		}
		return { height: top + 20, breakList };
	};
	const textOf = (part) => part.lineList.map((line) => line.text);
	const text = blockOf('one\ntwo\n\n■ head\nthree\nfour\nfive');
	const measuredText = measuredOf(text);
	const cutText = cvJpTextSplit(text, { space: 135, measured: measuredText });
	assert.deepEqual([textOf(cutText.head), textOf(cutText.tail), cutText.tail.isContinued, cutText.breakKey], [['one', 'two', '', '■ head', 'three'], ['four', 'five'], true, 'line-4']);
	const cutBeforeHeading = cvJpTextSplit(text, { space: 115, measured: measuredText });
	assert.deepEqual([textOf(cutBeforeHeading.head), textOf(cutBeforeHeading.tail)], [['one', 'two'], ['■ head', 'three', 'four', 'five']]);
	// no page holds one stray line of a block: the cut moves up, or the block is not cut
	assert.deepEqual(textOf(cvJpTextSplit(text, { space: 155, measured: measuredText }).tail), ['four', 'five']);
	assert.equal(cvJpTextSplit(text, { space: 75, measured: measuredText }), null);
	assert.equal(cvJpTextSplit(text, { space: 50, measured: measuredText }), null);
	assert.equal(cvJpTextSplit(text, { space: 400, measured: measuredText }), null);
	// one line as tall as a paragraph is enough of a part
	const paragraph = blockOf('a long paragraph\nanother one');
	assert.deepEqual(textOf(cvJpTextSplit(paragraph, { space: 135, measured: measuredOf(paragraph, { 0: 80, 1: 80 }) }).head), ['a long paragraph']);
	// a short run of labels stays whole: the cut goes before it
	const labelled = blockOf('intro one\nintro two\n【言語】Java\n【基盤】AWS\n【工程】設計');
	assert.deepEqual(textOf(cvJpTextSplit(labelled, { space: 115, measured: measuredOf(labelled) }).tail), ['Java', 'AWS', '設計']);
	assert.equal(cvJpTextSplit(blockOf('【言語】Java\n【基盤】AWS\n【工程】設計'), { space: 95, measured: measuredOf(blockOf('【言語】Java\n【基盤】AWS\n【工程】設計')) }), null);
});

test('the lines of a block: how a line starts says what it is', () => {
	const lineList = cvJpTextLineListBuild('■ 得意な分野\n・React\n- item\n(1) first\n\n【役割】設計\n[GitHub] https://example.com\n[a link](~cv:doc/x.md) follows\n【業務内容】\nplain {{/badge/aws/saa}}');
	assert.deepEqual(lineList.map((line) => [line.kind, line.label ?? line.mark ?? '', line.text]), [
		['heading', '', '■ 得意な分野'],
		['bullet', '・', 'React'],
		['bullet', '-', 'item'],
		['bullet', '(1)', 'first'],
		['blank', '', ''],
		['label', '役割', '設計'],
		['label', 'GitHub', 'https://example.com'],
		['text', '', '[a link](~cv:doc/x.md) follows'],
		['heading', '', '【業務内容】'],
		['text', '', 'plain {{/badge/aws/saa}}'],
	]);
	assert.deepEqual(cvJpTextLineListBuild(''), []);
	// the brackets of full width say a label too; alone on a line they are words
	assert.deepEqual(cvJpTextLineListBuild('［開発環境］React\n［GitHub］').map((line) => [line.kind, line.label ?? '', line.text, line.start]), [['label', '開発環境', 'React', 6], ['text', '', '［GitHub］', 0]]);
	// what is drawn of a line is written back after its mark or label
	const text = '・one {{/badge/a}}\n【役割】two';
	const [bullet, label] = cvJpTextLineListBuild(text);
	assert.equal(cvJpTextLineReplace(text, 0, bullet.start, 'one'), '・one\n【役割】two');
	assert.equal(cvJpTextLineReplace(text, 1, label.start, 'three'), '・one {{/badge/a}}\n【役割】three');
});

test('the sections of a paper: the template\'s, its own blocks, what it leaves out, its own order', () => {
	const sectionOf = (data) => cvJpSectionListResolve(template, cvJpInstanceRead(data)).map((section) => `${section.id}${section.isHidden ? '-' : ''}${section.isOwn ? '*' : ''}`);
	assert.deepEqual(sectionOf({}), ['basic', 'history', 'license', 'motivation']);
	const own = { sectionExtraList: [{ id: 'b1', type: 'text' }, { id: 'basic' }, 'odd'] };
	// its blocks follow the template's sections; one taking the id of a section of the template is not drawn
	assert.deepEqual(sectionOf(own), ['basic', 'history', 'license', 'motivation', 'b1*']);
	assert.deepEqual(sectionOf({ ...own, sectionHiddenList: ['license'], sectionOrderList: ['basic', 'b1', 'history'] }), ['basic', 'b1*', 'history', 'license-', 'motivation']);
	const sectionList = cvJpSectionListResolve(template, cvJpInstanceRead({ ...own, sectionHiddenList: ['license'] }));
	// a place up or down among those drawn: the section left out is passed over; any part may move,
	// the top too
	assert.deepEqual(cvJpSectionOrderMove(sectionList, 'motivation', -1), ['basic', 'motivation', 'history', 'license', 'b1']);
	assert.deepEqual(cvJpSectionOrderMove(sectionList, 'history', 1), ['basic', 'license', 'motivation', 'history', 'b1']);
	assert.deepEqual(cvJpSectionOrderMove(sectionList, 'history', -1), ['history', 'basic', 'license', 'motivation', 'b1']);
	assert.deepEqual(cvJpSectionOrderMove(sectionList, 'basic', 1), ['history', 'basic', 'license', 'motivation', 'b1']);
	assert.equal(cvJpSectionOrderMove(sectionList, 'basic', -1), undefined);
	assert.equal(cvJpSectionOrderMove(sectionList, 'b1', 1), undefined);
	assert.deepEqual(cvJpSectionOrderInsert(sectionList, 'b2', 'history'), ['basic', 'history', 'b2', 'license', 'motivation', 'b1']);
	assert.deepEqual(cvJpSectionOrderInsert(sectionList, 'b2', ''), ['b2', 'basic', 'history', 'license', 'motivation', 'b1'], "'' places it first");
	// a block is a section of text: its title and its text are cells of the paper
	const sheet = cvJpSheetBuild({ template, instance: cvJpInstanceRead({ ...own, valueByCell: { b1: '・one\n・two', 'b1:title': '自己PR' } }), info, context });
	const block = sheet.sectionList.find((section) => section.id === 'b1');
	assert.deepEqual([block.type, block.titleCell.text, block.lineList.map((line) => line.kind)], ['text', '自己PR', ['bullet', 'bullet']]);
	assert.equal(sheet.sectionList.find((section) => section.id === 'history').titleCell.text, '学 歴・職 歴');
});

test('a form: the kind of a paper names it, and its template is drawn where a paper names none', () => {
	const form = cvJpFormGet(CV_KIND_WE);
	assert.deepEqual(cvJpTemplateRead(undefined, form).sectionList.map((section) => section.type), ['head', 'text', 'career', 'text', 'history', 'text', 'closing']);
	assert.equal(cvJpTemplateRead(form.templateDefault, form).form, 'we');
	assert.equal(cvJpFormGet('template').kind, 'cv');
	// the optional rows are those of the top of a CV: a form without that top has none
	const sheet = cvJpSheetBuild({ template: cvJpTemplateRead(undefined, form), instance: cvJpInstanceRead({}), info, context });
	assert.deepEqual(sheet.rowOptionalList, []);
	assert.equal(sheet.cellGet('name-full').text, '山田 太郎');
});

test('a template: what cannot be drawn is left out and said, so the sheet never meets a section it does not know', () => {
	const read = cvJpTemplateRead({
		name: 'odd',
		sectionList: [{ id: 'basic', type: 'basic' }, { id: 'license', type: 'histroy' }, 'a string', { id: 'h', type: 'history' }, { id: 'm', text: '{{motivation/jp}}' }],
	});
	assert.deepEqual(read.sectionList.map((section) => [section.id, section.type]), [['basic', 'basic'], ['h', 'history'], ['m', 'text']]);
	assert.equal(read.problemList.length, 3);
	assert.match(read.problemList[0], /section license has the type "histroy", none of basic, head, history, career, text, closing/);
	assert.match(read.problemList[1], /section 3 is not a mapping/);
	assert.match(read.problemList[2], /section h is a history without a groupList/);
	// left out is not wrong: no sectionList is the default form, said nowhere
	assert.deepEqual(cvJpTemplateRead({ cellById: {} }).problemList, []);
	assert.equal(cvJpTemplateRead({ cellById: {} }).sectionList.length, CV_JP_TEMPLATE_DEFAULT.sectionList.length);
	assert.match(cvJpTemplateRead({ sectionList: 'basic' }).problemList[0], /sectionList is not a list/);
	assert.match(cvJpTemplateRead('a string').problemList[0], /not a mapping/);
	// two sections of one id: the second is left out, since a cell is named by the id of its section
	assert.match(cvJpTemplateRead({ sectionList: [{ id: 'a', type: 'text' }, { id: 'a', type: 'text' }] }).problemList[0], /section 2 has the id "a" of a section before it/);
	// what the sheet draws from it has no section without its cell
	const sheet = cvJpSheetBuild({ template: read, instance: cvJpInstanceRead({}), info, context });
	assert.ok(sheet.sectionList.filter((section) => section.type === 'text').every((section) => section.cell));
});

test('a history whose query reads no entry of the profile is marked, one with entries or rows of the CV only is not', () => {
	const template = cvJpTemplateRead({ sectionList: [{ id: 'h', type: 'history', groupList: [{ id: 'edu', list: 'edu/jp' }, { id: 'typo', list: 'edu/jpp' }, { id: 'own', list: 'work/jp' }, { id: 'none' }] }] });
	const instance = cvJpInstanceRead({ rowExtraByGroup: { own: [{ year: 2024, month: 4, text: '副業' }] } });
	const sheet = cvJpSheetBuild({ template, instance, info, context });
	assert.deepEqual(sheet.sectionList[0].groupList.map((group) => [group.id, group.isListEmpty]), [['edu', false], ['typo', true], ['own', true], ['none', false]]);
});

test('a photo is drawn only from a text that can be an image', async () => {
	const { cvJpImageSourceIs } = await import('./CvJpData.js');
	for (const text of ['data:image/png;base64,AAAA', 'https://example.com/a.jpg', 'blob:abc', './photo.png', 'me.JPEG?x=1']) assert.equal(cvJpImageSourceIs(text), true, text);
	for (const text of ['', 'not an image at all', '太郎', 'data:text/plain,hi', 'photo']) assert.equal(cvJpImageSourceIs(text), false, text);
});

test('the parts a paper adds: of the form and of the object, each a whole section of the paper\'s own', () => {
	const formCv = cvJpFormGet(CV_KIND_CV);
	// the part templates of the object: of the paper's form only, read as they are read
	const partAssetList = [{ key: 'p1', name: '', pathList: ['/example/part/wish'] }, { key: 'p2', pathList: ['/example/part/we-only'] }, { key: 'p3', pathList: ['/example/part/odd'] }];
	const partData = {
		p1: { name: '本人希望記入欄', section: { id: 'x', type: 'text', title: '本人希望記入欄', text: '貴社の規定に従います。' } },
		p2: { name: '職務要約', form: 'we', section: { type: 'text' } },
		p3: { name: 'no section' },
	};
	const { formList, objectList } = cvJpPartTemplateListGet(formCv, partAssetList, (key) => partData[key]);
	assert.deepEqual(formList.slice(0, 2).map((part) => [part.key, part.label, part.section]), [['form:basic', '基本情報（写真あり）', { type: 'basic' }], ['form:basic-no-photo', '基本情報（写真なし）', { type: 'basic', isPhoto: false }]]);
	assert.ok(formList.every((part) => part.section.id === undefined), 'a part template has no id: a part added is given one');
	assert.deepEqual(objectList.map((part) => [part.key, part.label, part.path, part.section.id]), [['object:p1', '本人希望記入欄', '/example/part/wish', undefined]]);
	// a part added: a copy of its section with an id of its own, kept whole by the paper
	const top = cvJpSectionNew(formList[1].section, 'top2');
	const history = cvJpSectionNew(formList.find((part) => part.key === 'form:history').section, 'h2');
	assert.deepEqual(top, { id: 'top2', type: 'basic', isPhoto: false });
	const instance = cvJpInstanceRead({ sectionExtraList: [top, history], sectionHiddenList: ['basic'], sectionOrderList: ['top2'] });
	const sheet = cvJpSheetBuild({ template, instance, info, context });
	assert.deepEqual(sheet.sectionList.map((section) => `${section.id}${section.isHidden ? '-' : ''}`), ['top2', 'basic-', 'history', 'license', 'motivation', 'h2']);
	const topDrawn = sheet.sectionList[0];
	assert.deepEqual([topDrawn.type, topDrawn.isPhoto, topDrawn.isOwn], ['basic', false, true]);
	// a history of its own has the groups of its template, each with its rows
	assert.deepEqual(sheet.sectionList.at(-1).groupList.map((group) => [group.id, group.rowList.length > 0]), [['edu', true], ['work', false]]);
	// what a part is called: its title without the spaces of the form, else its type
	assert.deepEqual(sheet.sectionList.map(cvJpSectionLabelGet), ['基本情報（写真なし）', '基本情報', '学歴・職歴', '免許・資格', '志望の動機', '学歴・職歴']);
	// a part of an unknown type is a block
	assert.equal(cvJpInstanceRead({ sectionExtraList: [{ id: 'z', type: 'table' }] }).sectionExtraList[0].type, 'text');
});

test('a copy of a paper: beside it, named after it, holding what it holds', () => {
	const asset = { key: 'cv-1', kind: 'cv', name: '履歴書（汎用）', pathList: ['/example/cv/general'] };
	const data = { name: '履歴書（汎用）', template: '/example/template/cv-jp-standard', valueByCell: { motivation: 'words' }, sectionExtraList: [{ id: 'p1', type: 'text' }] };
	const copy = cvJpPaperCopyGet(asset, data, [asset]);
	assert.deepEqual([copy.name, copy.path], ['履歴書（汎用）（コピー）', '/example/cv/general-copy']);
	assert.deepEqual(copy.data, { ...data, name: '履歴書（汎用）（コピー）' });
	assert.notEqual(copy.data.valueByCell, data.valueByCell, 'a copy of its data, not the same object');
	// a name and a path taken: the next number; a copy of a copy is named after the paper it copies
	const taken = [asset, { key: 'cv-2', kind: 'cv', name: copy.name, pathList: [copy.path] }];
	assert.deepEqual(Object.values(cvJpPaperCopyGet(asset, data, taken)).slice(0, 2), ['履歴書（汎用）（コピー 2）', '/example/cv/general-copy-2']);
	assert.deepEqual(Object.values(cvJpPaperCopyGet(taken[1], { ...data, name: copy.name }, taken)).slice(0, 2), ['履歴書（汎用）（コピー 2）', '/example/cv/general-copy-2']);
	// a paper naming itself nowhere but in its data
	assert.equal(cvJpPaperCopyGet({ key: 'we-1', kind: 'we', pathList: ['/example/we/general'] }, { name: '職務経歴書' }).name, '職務経歴書（コピー）');
});

test('the alignment of a cell: the paper\'s, else its template\'s, else its form\'s', () => {
	const templateAligned = cvJpTemplateRead({ ...CV_JP_TEMPLATE_DEFAULT, alignByCell: { email: 'right', phone: 'middle' } });
	assert.deepEqual(templateAligned.alignByCell, { email: 'right' }, 'what is no alignment is left out');
	const cellOf = (instanceData, id) => cvJpCellGet(id, { template: templateAligned, instance: cvJpInstanceRead(instanceData), info, context });
	assert.deepEqual([cellOf({}, 'email').align, cellOf({}, 'email').alignTemplate], ['right', 'right']);
	assert.equal(cellOf({ alignByCell: { email: 'left' } }, 'email').align, 'left');
	assert.equal(cellOf({}, 'phone').align, '', 'none: as its form draws it');
});

test('the options of a part: the paper\'s over the part\'s over the default; the rows of the top they draw', () => {
	const infoVisa = cvInfoBuild([{ key: 'v', path: '/info/visa', data: { jp: '技術・人文知識・国際業務', expiry: { jp: '2027年3月31日' } } }], cvJpDateVirtualBuild(date));
	const sheetOf = (instanceData, infoUsed = info) => cvJpSheetBuild({ template, instance: cvJpInstanceRead(instanceData), info: infoUsed, context });
	const rowOf = (sheet) => Object.fromEntries(sheet.sectionList.find((one) => one.type === 'basic').rowOptionalList.map((row) => [row.id, row.isShown]));
	// nothing set: a row is drawn when it says something
	assert.deepEqual(rowOf(sheetOf({})), { visa: false, nationality: false, link: false });
	assert.deepEqual(rowOf(sheetOf({}, infoVisa)), { visa: true, nationality: false, link: false });
	const visaRow = sheetOf({}, infoVisa).sectionList[0].rowOptionalList[0];
	assert.deepEqual(visaRow.cellList.map((one) => [one.label, one.cell.text]), [['在留資格', '技術・人文知識・国際業務'], ['在留期限', '2027年3月31日']]);
	// always: drawn empty, a place to write by hand; never: not drawn whatever it holds
	const set = { optionBySection: { basic: { rowVisa: 'always', rowLink: 'never', isPhoto: false, rowNationality: 'sometimes' } } };
	assert.deepEqual(rowOf(sheetOf(set)), { visa: true, nationality: false, link: false });
	assert.equal(rowOf(sheetOf({ optionBySection: { basic: { rowVisa: 'never' } } }, infoVisa)).visa, false);
	const top = sheetOf(set).sectionList[0];
	assert.deepEqual([top.isPhoto, top.optionBase.isPhoto, top.optionOwnList], [false, true, ['isPhoto', 'rowVisa', 'rowLink']], 'what is no value of an option is left out');
	// a block: its options are its own keys, the template's first
	const motivation = sheetOf({ optionBySection: { motivation: { heightMin: 60 } } }).sectionList.find((one) => one.id === 'motivation');
	assert.deepEqual([motivation.heightMin, motivation.optionBase.heightMin, motivation.isIndent], [60, 120, true]);
	assert.deepEqual(cvJpPartOptionListGet('closing'), [], 'a kind of part without options');
});

test('pages: a row of badges in lines is cut between its lines when it does not fit whole', async () => {
	const { cvJpHistorySplit } = await import('./CvJpPaginationData.js');
	const text = '各種IT資格取得\n{{/badge/a}}{{/badge/b}}{{/badge/c}}{{/badge/d}}';
	const endOf = (index) => text.indexOf('}}', text.indexOf(`/badge/${'abcd'[index]}`)) + 2;
	const data = {
		id: 'license', title: '免 許・資 格', isNote: true,
		groupList: [{ id: 'license', rowList: [{ id: 'l1', year: 2026, month: '8〜11', text, note: '備考' }, { id: 'l2', year: 2026, month: 12, text: 'TOEIC' }] }],
	};
	// the row l1: its title line, then two lines of two badges (each 140 tall); then the row l2
	const measured = {
		height: 420,
		breakList: [
			{ key: `l1@${endOf(0)}`, top: 70, bottom: 210 }, { key: `l1@${endOf(1)}`, top: 70, bottom: 210 },
			{ key: `l1@${endOf(2)}`, top: 215, bottom: 355 }, { key: `l1@${endOf(3)}`, top: 215, bottom: 355 },
			{ key: 'l1', top: 35, bottom: 360 }, { key: 'l2', top: 360, bottom: 400 },
		],
	};
	// room for the head row and the first line of badges: the row is cut after it
	const cut = cvJpHistorySplit(data, { space: 260, measured });
	assert.equal(cut.breakKey, `l1@${endOf(1)}`);
	const [headRow] = cut.head.groupList[0].rowList;
	assert.deepEqual([headRow.year, headRow.month, headRow.note, headRow.text, headRow.isCutInside], [2026, '8〜11', '備考', '各種IT資格取得\n{{/badge/a}}{{/badge/b}}', true]);
	const [goingOn, next] = cut.tail.groupList[0].rowList;
	assert.deepEqual([goingOn.year, goingOn.month, goingOn.note, goingOn.text, goingOn.isContinued], ['', '', '', '{{/badge/c}}{{/badge/d}}', true]);
	assert.equal(next.id, 'l2');
	assert.equal(cut.tail.groupList[0].isContinued, true);
	// not even the first line fits: the table goes whole to the next page
	assert.equal(cvJpHistorySplit(data, { space: 150, measured }), null);
	// the whole row fits: cut after it, as before (a row is cut inside only when it does not fit)
	assert.equal(cvJpHistorySplit(data, { space: 370, measured }).breakKey, 'l1');
	// only its last line would be left out but its last badge is what fits: no cut inside a line
	assert.equal(cvJpHistorySplit(data, { space: 357, measured }).breakKey, `l1@${endOf(1)}`);
});

test('最終学歴: the latest education of the profile, its date, school, status and degree as cells', async () => {
	const { cvProfileValueChoiceListGet } = await import('../profile/cv-profile-value.js');
	const infoEdu = cvInfoBuild([
		{ key: 'b', path: '/info/edu/bachelor', data: { start: { year: 2016, month: 4, jp: 'a' }, end: { year: 2020, month: 3, jp: 'b' } } },
		{ key: 'm', path: '/info/edu/master', data: { school: { jp: 'サンプル大学大学院 情報理工学系研究科' }, status: '修了', degree: { jp: '修士（情報理工学）' }, start: { year: 2020, month: 4, jp: 'c' }, end: { year: 2022, month: 3, jp: 'd' } } },
		// one still going on: only a start
		{ key: 'w', path: '/info/work/x', data: { start: { year: 2022, month: 4, jp: 'e' } } },
	], cvJpDateVirtualBuild(date));
	assert.deepEqual(cvJpEducationLastGet(infoEdu), { itemPath: 'edu/master', datePath: 'edu/master/end', isEnded: true });
	assert.equal(cvJpEducationLastGet(cvInfoBuild([], {})), undefined);
	const formWe = cvJpFormGet(CV_KIND_WE);
	const part = formWe.partList.find((one) => one.id === 'education');
	const instance = cvJpInstanceRead({ sectionExtraList: [{ id: 'e1', ...part.section }] });
	const sheet = cvJpSheetBuild({ template: cvJpTemplateRead(undefined, formWe), instance, info: infoEdu, context: { dateNow: date } });
	const education = sheet.sectionList.find((one) => one.id === 'e1');
	assert.deepEqual([education.cellDate.text, education.cellSchool.text, education.cellStatus.text, education.cellDegree.text, education.titleCell.text], ['2022年3月', 'サンプル大学大学院 情報理工学系研究科', '修了', '修士（情報理工学）', '最 終 学 歴']);
	assert.equal(education.cellStatus.raw, '{{edu/master/status}}', 'a query of the profile, which a paper may say otherwise');
	// a status the profile does not hold yet: the cell says it is missing; its card offers the common values
	const sheetNone = cvJpSheetBuild({ template: cvJpTemplateRead(undefined, formWe), instance, info: cvInfoBuild([], {}), context: { dateNow: date } });
	assert.ok(sheetNone.sectionList.find((one) => one.id === 'e1').cellStatus.missingList.length > 0);
	assert.deepEqual(cvProfileValueChoiceListGet('edu/master/status').slice(0, 3), ['卒業', '卒業見込み', '修了']);
	assert.deepEqual(cvProfileValueChoiceListGet('work/x/status'), []);
});
