import assert from 'node:assert/strict';
import test from 'node:test';
import { cvInfoBuild, cvEntryListResolve } from '../query/CvQuery.js';
import { CV_KIND_WE, cvJpDateVirtualBuild, cvJpFormGet, cvJpInstanceRead, cvJpSheetBuild, cvJpTemplateRead } from './CvJpData.js';
import { weJpCareerItemNew, weJpFactKeyGet, weJpFactNew, weJpFolderListGet } from './WeJpData.js';

const date = new Date(2026, 10, 19);
const info = cvInfoBuild([
	{ key: 'name', pathList: ['/info/name'], data: { '{jp/last/}': { kanji: '山田' }, '{jp/first/}': { kanji: '太郎' } } },
	{ key: 'new', pathList: ['/info/work/sample-systems'], data: { start: { year: 2022, month: 4, jp: 'サンプルシステムズ株式会社 入社' }, jp: { name: 'サンプルシステムズ株式会社', employment: '正社員', fact: { business: { label: '事業内容', text: '受託開発' }, capital: { label: '資本金', text: '' }, w6x1: { label: '', text: '2001年' } } } } },
	{ key: 'old', pathList: ['/info/work/sample-robotics'], data: { start: { year: 2021, month: 7, jp: 'サンプルロボティクス株式会社' }, end: { year: 2021, month: 8 }, jp: { name: 'サンプルロボティクス株式会社' } } },
	{ key: 'p2', pathList: ['/info/work/sample-systems/project/tool'], data: { start: { year: 2024, month: 10 }, jp: { title: '自動化ツール', summary: ['・one', '・two'], env: 'React' } } },
	{ key: 'p1', pathList: ['/info/work/sample-systems/project/hr'], data: { start: { year: 2022, month: 5 }, end: { year: 2024, month: 9 }, jp: { title: '可視化システム', role: '設計', result: '導入' } } },
	{ key: 'note', pathList: ['/info/work-note'], data: 'no employer' },
], cvJpDateVirtualBuild(date));
const context = { dateNow: date };
const form = cvJpFormGet(CV_KIND_WE);
const template = cvJpTemplateRead(form.templateDefault, form);
const careerOf = (instanceData, templateOne = template) => cvJpSheetBuild({ template: templateOne, instance: cvJpInstanceRead(instanceData), info, context }).sectionList.find((section) => section.type === 'career');

test('a career: the employers are the folders of the profile below its list, each with its projects, in order of time', () => {
	assert.deepEqual(weJpFolderListGet(info, ['work']), ['sample-systems', 'sample-robotics']);
	const career = careerOf({});
	assert.deepEqual(career.employerList.map((employer) => [employer.key, employer.name.text, employer.period.start.year, employer.period.isNow]), [
		['sample-robotics', 'サンプルロボティクス株式会社', '2021', false],
		['sample-systems', 'サンプルシステムズ株式会社', '2022', true],
	]);
	const employer = career.employerList[1];
	assert.deepEqual(employer.projectList.map((project) => [project.key, project.title.text, project.period.isNow, project.ordinal]), [
		['sample-systems/hr', '可視化システム', false, 1],
		['sample-systems/tool', '自動化ツール', true, 2],
	]);
	assert.deepEqual([career.isListEmpty, career.listText, career.sideTitle], [false, 'work', '環境・役割・規模']);
	// newest first, where the section says so: the employers and the projects of each
	const newest = careerOf({}, cvJpTemplateRead({ sectionList: [{ id: 'career', type: 'career', isNewestFirst: true }] }, form));
	assert.deepEqual(newest.employerList.map((one) => one.key), ['sample-systems', 'sample-robotics']);
	assert.deepEqual(newest.employerList[0].projectList.map((one) => one.key), ['sample-systems/tool', 'sample-systems/hr']);
});

test('a value of a career is a cell: one query of the profile, overridden in a paper as any cell', () => {
	const [, employer] = careerOf({}).employerList;
	assert.deepEqual([employer.name.raw, employer.name.source, employer.name.leaf.keyPath.join('.')], ['{{work/sample-systems/jp/name}}', 'template', 'jp.name']);
	const project = employer.projectList[1];
	assert.equal(project.summary.text, '・one\n・two');
	assert.equal(project.summary.id, 'career:sample-systems/tool:summary');
	// a fact is drawn when it says something; where it stands is the form's (beside the text, or under it)
	assert.deepEqual(project.factSideList.map((fact) => [fact.id, fact.label, fact.isShown]), [['env', '環境', true], ['role', '役割', false], ['team', '規模', false], ['phase', '工程', false]]);
	assert.deepEqual(employer.projectList[0].factMainList.map((fact) => [fact.id, fact.cell.text]), [['result', '導入']]);
	// a value nothing holds is a cell whose query nothing answers: typed there, it is added to the profile
	assert.deepEqual(employer.projectList[0].factSideList[0].cell.missingList, ['work/sample-systems/project/hr/jp/env']);
	const own = careerOf({ valueByCell: { 'career:sample-systems:name': 'Sample Systems, Inc.' } }).employerList[1].name;
	assert.deepEqual([own.text, own.isOverride], ['Sample Systems, Inc.', true]);
});

test('the facts of an employer are its own entries in the profile: a label and what it says, two cells', () => {
	const [old, employer] = careerOf({}).employerList;
	// in the order of the data; nothing of the form names one. one saying nothing is not shown read
	assert.deepEqual(employer.factList.map((fact) => [fact.id, fact.label, fact.cell.text, fact.isShown]), [
		['business', '事業内容', '受託開発', true], ['capital', '資本金', '', false], ['w6x1', '', '2001年', true],
	]);
	assert.deepEqual([old.factList, old.factPathText], [[], 'work/sample-robotics/jp/fact']);
	const [business] = employer.factList;
	assert.deepEqual([business.labelCell.raw, business.cell.raw, business.pathText, employer.factPathText], [
		'{{work/sample-systems/jp/fact/business/label}}', '{{work/sample-systems/jp/fact/business/text}}', 'work/sample-systems/jp/fact/business', 'work/sample-systems/jp/fact',
	]);
	assert.deepEqual([business.labelCell.id, business.cell.id, business.cell.leaf.keyPath.join('.')], ['career:sample-systems:fact/business:label', 'career:sample-systems:fact/business:text', 'jp.fact.business.text']);
	// a paper leaves one out by its key, and says its label or its words its own way as any cell
	const paper = careerOf({ rowHiddenByGroup: { career: [weJpFactKeyGet('sample-systems', 'business')] }, valueByCell: { 'career:sample-systems:fact/w6x1:label': '設立' } }).employerList[1];
	assert.deepEqual(paper.factList.map((fact) => [fact.key, fact.label, fact.isHidden]), [['sample-systems#business', '事業内容', true], ['sample-systems#capital', '資本金', false], ['sample-systems#w6x1', '設立', false]]);
	// a new one: an id nothing means anything by, its label and its words still to type
	const factNew = weJpFactNew(new Date(2026, 10, 19));
	assert.match(factNew.id, /^[a-z][a-z0-9]+$/);
	assert.deepEqual(factNew.data, { label: '', text: '' });
});

test('a paper leaves out an employer or a project by its key; a section names the facts of its projects', () => {
	const career = careerOf({ rowHiddenByGroup: { career: ['sample-robotics', 'sample-systems/hr'] } });
	assert.deepEqual(career.employerList.map((employer) => [employer.key, employer.isHidden]), [['sample-robotics', true], ['sample-systems', false]]);
	// a project left out has no place among those drawn: the next one is the first
	assert.deepEqual(career.employerList[1].projectList.map((project) => [project.key, project.isHidden, project.ordinal]), [['sample-systems/hr', true, 0], ['sample-systems/tool', false, 1]]);
	const custom = careerOf({}, cvJpTemplateRead({ sectionList: [{ id: 'c', type: 'career', projectFactList: [{ id: 'env' }, { label: 'no id' }] }] }, form));
	assert.deepEqual(custom.employerList[1].projectList[0].factSideList.map((fact) => fact.label), ['env']);
	assert.equal(custom.sideTitle, 'env');
	// a list that holds no folder: the section says so while the sheet is edited
	const empty = careerOf({}, cvJpTemplateRead({ sectionList: [{ id: 'c', type: 'career', list: 'job' }] }, form));
	assert.deepEqual([empty.isListEmpty, empty.listText, empty.employerList], [true, 'job', []]);
});

test('the era above the years: the paper\'s way, else its template\'s, else its form\'s; a year of a period is then the token of its date', () => {
	const sheetOf = (instanceData, templateData) => cvJpSheetBuild({ template: cvJpTemplateRead(templateData ?? form.templateDefault, form), instance: cvJpInstanceRead(instanceData), info, context });
	// a work experience writes its years without their era unless told
	assert.equal(sheetOf({}).isEra, false);
	assert.equal(sheetOf({}, { ...form.templateDefault, isEra: true }).isEra, true);
	assert.equal(sheetOf({ isEra: false }, { ...form.templateDefault, isEra: true }).isEra, false);
	assert.equal(cvJpSheetBuild({ template: cvJpTemplateRead(undefined), instance: cvJpInstanceRead({}), info, context }).isEra, true);
	const sheet = sheetOf({ isEra: true });
	assert.equal(sheet.sectionList.find((section) => section.type === 'history').isEra, true);
	const period = sheet.sectionList.find((section) => section.type === 'career').employerList[1].period;
	// a period is one cell, the token of its folder, asking for the era when the paper does
	assert.deepEqual([period.cell.raw, period.cell.text, period.isNow], ['{{period:work/sample-systems|era}}', '2022年4月〜現在', true]);
	assert.equal(careerOf({}).employerList[1].period.cell.raw, '{{period:work/sample-systems}}');
});

test('a period of a career is one cell: the token of its folder, whose dates a card changes in the profile', () => {
	const [robotics, systems] = careerOf({}).employerList;
	assert.deepEqual([robotics.period.cell.id, robotics.period.cell.text], ['career:sample-robotics:period', '2021年7月〜2021年8月']);
	// what the cell is, for its card: the two dates it reads, each a path of the profile
	assert.deepEqual([robotics.period.cell.period.folder, robotics.period.cell.period.start.path, robotics.period.cell.period.end.path], ['work/sample-robotics', 'work/sample-robotics/start', 'work/sample-robotics/end']);
	assert.deepEqual(systems.projectList.map((project) => project.period.cell.text), ['2022年5月〜2024年9月', '2024年10月〜現在']);
	// a paper writes a period of its own in the place of the profile's
	const own = careerOf({ valueByCell: { 'career:sample-systems:period': '{{period:2022/4~2026/3}}' } }).employerList[1].period.cell;
	assert.deepEqual([own.text, own.isOverride, own.period.folder], ['2022年4月〜2026年3月', true, undefined]);
});

test('a project without a start is other work of its employer: last, not numbered', () => {
	const infoOther = cvInfoBuild([
		{ key: 'e', pathList: ['/info/work/acme'], data: { start: { year: 2026, month: 4 } } },
		{ key: 'o', pathList: ['/info/work/acme/project/other'], data: { jp: { title: 'その他の業務経験' } } },
		{ key: 'p', pathList: ['/info/work/acme/project/tool'], data: { start: { year: 2026, month: 5 }, jp: { title: 'ツール' } } },
	]);
	const career = cvJpSheetBuild({ template, instance: cvJpInstanceRead({}), info: infoOther, context }).sectionList.find((section) => section.type === 'career');
	assert.deepEqual(career.employerList[0].projectList.map((project) => [project.key, project.ordinal, project.period.isTimeless, project.period.cell.text]), [['acme/tool', 1, false, '2026年5月〜現在'], ['acme/other', 0, true, '']]);
	// an employer needs no name to be one: a folder with a start is enough, its name typed later
	assert.deepEqual([career.employerList[0].key, career.employerList[0].name.text, career.employerList[0].name.missingList], ['acme', '', ['work/acme/jp/name']]);
});

test('the projects of a career are no rows of a history of a CV: they hold no text of its language', () => {
	assert.deepEqual(cvEntryListResolve(info, 'work/jp').map((row) => row.text), ['サンプルロボティクス株式会社', 'サンプルシステムズ株式会社 入社']);
});

test('a new employer, a new project: an item of the profile at the folder of the section, starting at the date of the paper', () => {
	const section = { id: 'career', type: 'career' };
	assert.deepEqual(weJpCareerItemNew(section, { date, folderName: 'x1' }), { pathInInfo: 'work/x1', data: { start: { year: 2026, month: 11 }, jp: { name: '' } } });
	assert.deepEqual(weJpCareerItemNew({ ...section, list: 'job', lang: 'en', projectFolder: 'task' }, { employerKey: 'acme', date, folderName: 'x2' }), { pathInInfo: 'job/acme/task/x2', data: { start: { year: 2026, month: 11 }, en: { title: '' } } });
	// made, it is a folder of the career at once, its name still to type
	const infoNext = cvInfoBuild([{ key: 'x', pathList: ['/info/work/x1'], data: weJpCareerItemNew(section, { date, folderName: 'x1' }).data }]);
	assert.deepEqual(weJpFolderListGet(infoNext, ['work']), ['x1']);
});

test('pages: a career cut between projects, an employer cut in two going on without its line', async () => {
	const { weJpCareerSplit } = await import('./CvJpPaginationData.js');
	const data = {
		id: 'career',
		employerList: [
			{ key: 'a', projectList: [] },
			{ key: 'b', projectList: [{ key: 'b/1' }, { key: 'b/2' }, { key: 'b/3' }] },
		],
	};
	// the rows as measured: an employer without a project is a break, then each project of b
	const measured = { height: 400, breakList: [['a', 80], ['b/1', 200], ['b/2', 280], ['b/3', 380]].map(([key, bottom]) => ({ key, top: bottom - 60, bottom })) };
	const cut = weJpCareerSplit(data, { space: 300, measured });
	assert.equal(cut.breakKey, 'b/2');
	assert.deepEqual(cut.head.employerList.map((employer) => [employer.key, employer.projectList.map((project) => project.key)]), [['a', []], ['b', ['b/1', 'b/2']]]);
	assert.deepEqual(cut.tail.employerList.map((employer) => [employer.key, employer.isContinued, employer.projectList.map((project) => project.key)]), [['b', true, ['b/3']]]);
	// the head ends inside an employer: its band runs on to the bottom of the page
	assert.equal(cut.head.isEmployerCut, true);
	const atEmployer = weJpCareerSplit(data, { space: 100, measured });
	assert.deepEqual([atEmployer.breakKey, atEmployer.head.employerList.length, atEmployer.tail.employerList[0].isContinued, atEmployer.head.isEmployerCut === true], ['a', 1, undefined, false]);
	// cut after the last project of an employer: the next employer starts the tail whole
	const dataTwo = { id: 'career', employerList: [{ key: 'b', projectList: [{ key: 'b/1' }] }, { key: 'c', projectList: [{ key: 'c/1' }] }] };
	const cutTwo = weJpCareerSplit(dataTwo, { space: 250, measured: { height: 400, breakList: [['b/1', 200], ['c/1', 380]].map(([key, bottom]) => ({ key, top: bottom - 60, bottom })) } });
	assert.deepEqual([cutTwo.head.isEmployerCut, cutTwo.tail.employerList[0].key, cutTwo.tail.employerList[0].isContinued], [false, 'c', undefined]);
	assert.equal(weJpCareerSplit(data, { space: 40, measured }), null);
	assert.equal(weJpCareerSplit(data, { space: 500, measured }), null);
});
