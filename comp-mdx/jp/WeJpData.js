import { assetPathIndexNodeGet } from '@wwf971/react-doc/asset-path';
import { CV_PERIOD_SIGIL, cvPeriodRead, cvPeriodResolve, cvQueryParse, cvSegmentNormalize } from '../query/CvQuery.js';

// The data of the Japanese-style work experience (we-jp), without its drawing (doc/we-jp.md): what is
// its own beside the sheet both forms share (CvJpData.js): its default template, and its section
// "career", the employers of the profile with their projects.
//
// A career is read off the folders of the profile, not off a list written in the paper:
//
//   work/                             section.list: the folder of the employers
//     sample-systems/                 an employer: every folder below it
//       start, end                    dated entries: its period (no end: to the present)
//       jp/name, jp/employment        its values, under the language of the section
//       jp/fact/{id}/label, text      its facts (事業内容, 資本金, …): entries of its own, as many as
//                                     it has, each a label and what it says, in the order of the data
//       project/                      section.projectFolder
//         hr-dashboard/               a project: start, end, jp/title, jp/summary, jp/role, …
//
// Every value drawn is a cell of the sheet whose default text is the query of that value
// ({{work/sample-systems/jp/name}}), so a cell of a career is typed, overridden in one paper and
// saved to the profile exactly as a cell of the top of a CV is.

export const WE_JP_TEMPLATE_DEFAULT = {
	name: '職務経歴書 標準様式',
	form: 'we',
	sectionList: [
		{ id: 'head', type: 'head', title: '職 務 経 歴 書' },
		{ id: 'summary', type: 'text', title: '職務要約', text: '{{summary/jp}}' },
		{ id: 'career', type: 'career', title: '職務経歴', list: 'work' },
		{ id: 'skill', type: 'text', title: '活かせる経験・知識・技術', text: '{{skill/jp}}' },
		{ id: 'license', type: 'history', title: '資格', isNote: true, groupList: [{ id: 'license', list: 'license/jp', isNote: true }] },
		{ id: 'pr', type: 'text', title: '自己PR', text: '{{pr/jp}}' },
		{ id: 'closing', type: 'closing', text: '以上' },
	],
};

// the parts a work experience offers to be added (CvJpData.js CV_JP_FORM_LIST, doc/cv-sheet.md#parts):
// those of its standard template, then a block to fill and the closing line
const weJpSectionOfDefault = (id) => WE_JP_TEMPLATE_DEFAULT.sectionList.find((section) => section.id === id);
export const WE_JP_PART_LIST = [
	{ id: 'head', label: '見出し（職務経歴書・日付・氏名）', section: weJpSectionOfDefault('head') },
	{ id: 'summary', label: '職務要約', section: weJpSectionOfDefault('summary') },
	{ id: 'career', label: '職務経歴', section: weJpSectionOfDefault('career') },
	{ id: 'skill', label: '活かせる経験・知識・技術', section: weJpSectionOfDefault('skill') },
	{ id: 'license', label: '資格', section: weJpSectionOfDefault('license') },
	// 最終学歴, briefly: the latest education of the profile (doc/we-jp.md#最終学歴)
	{ id: 'education', label: '最終学歴', section: { type: 'education', title: '最 終 学 歴', list: 'edu' } },
	{ id: 'pr', label: '自己PR', section: weJpSectionOfDefault('pr') },
	{ id: 'block', label: 'ブロック（タイトルと自由欄）', section: { type: 'text', title: '', text: '' } },
	{ id: 'closing', label: '以上', section: weJpSectionOfDefault('closing') },
];

// the facts of a project a career draws unless its section names others: the key of the value
// under the language, and its label on the form. place: where a project draws it, beside its
// text (side, the default) or under it (main). The facts of an employer are no list of the
// form: they are entries of the employer in the profile (WE_JP_FACT_FOLDER)
export const WE_JP_PROJECT_FACT_LIST = [
	{ id: 'env', label: '環境' },
	{ id: 'role', label: '役割' },
	{ id: 'team', label: '規模' },
	{ id: 'phase', label: '工程' },
	{ id: 'result', label: '実績・取り組み', place: 'main' },
];

export const WE_JP_LIST_DEFAULT = 'work';
export const WE_JP_PROJECT_FOLDER_DEFAULT = 'project';
export const WE_JP_LANG_DEFAULT = 'jp';
// the folder of the facts of an employer, under the language: work/{employer}/jp/fact/{id}, each
// a mapping { label, text }. nothing names a fact but the profile: one is added, renamed and
// removed there, and a paper only leaves one out
export const WE_JP_FACT_FOLDER = 'fact';
export const WE_JP_FACT_LABEL = 'label';
export const WE_JP_FACT_TEXT = 'text';

function mappingIs(value) {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// the facts a section names, or the form's: each { id, label, place }; one without an id is left out
function factListRead(listInput, listDefault) {
	const list = Array.isArray(listInput) ? listInput : listDefault;
	return list.filter((one) => mappingIs(one) && String(one.id ?? '').trim() !== '').map((one) => ({
		id: cvSegmentNormalize(one.id),
		label: String(one.label ?? one.id),
		place: one.place === 'main' ? 'main' : 'side',
	}));
}

// a section "career" as it is read: where its employers are, in which language, with which facts
export function weJpCareerSectionRead(section) {
	return {
		listPath: cvQueryParse(section.list || WE_JP_LIST_DEFAULT).segmentList,
		projectFolder: cvSegmentNormalize(section.projectFolder || WE_JP_PROJECT_FOLDER_DEFAULT),
		lang: cvSegmentNormalize(section.lang || WE_JP_LANG_DEFAULT),
		isNewestFirst: section.isNewestFirst === true,
		projectFactList: factListRead(section.projectFactList, WE_JP_PROJECT_FACT_LIST),
	};
}

// the folders below a path of the profile, in the order of the data: what holds values below
// itself (a value lying at the path itself is no folder)
export function weJpFolderListGet(info, pathList) {
	const node = assetPathIndexNodeGet(info.index, pathList);
	return [...(node?.childByKey.entries() ?? [])].filter(([, child]) => child.childByKey.size > 0).map(([key]) => key);
}

// a period as it is ordered: its start as one number, the latest for one without a start
function periodRankGet(period) {
	const year = Number.parseInt(period.start.year, 10);
	const month = Number.parseInt(period.start.month, 10);
	return Number.isFinite(year) ? year * 12 + (Number.isFinite(month) ? month : 0) : Number.MAX_SAFE_INTEGER;
}

// the projects with their place among those drawn. one without a start is not counted: it is
// no project of a time (other work of the employer, kept beside its projects), and comes last
function ordinalApply(projectList) {
	let ordinal = 0;
	return projectList.map((project) => {
		const isCounted = !project.isHidden && !project.period.isTimeless && project.period.start.status === 'found';
		if (isCounted) ordinal += 1;
		return { ...project, ordinal: isCounted ? ordinal : 0 };
	});
}

function orderApply(list, isNewestFirst) {
	const ranked = list.map((one, index) => ({ one, index, rank: periodRankGet(one.period) }));
	ranked.sort((a, b) => ((a.rank - b.rank) || (a.index - b.index)) * (isNewestFirst && a.rank !== b.rank ? -1 : 1));
	return ranked.map(({ one }) => one);
}

// the career of a paper: its employers, each with its projects, every value a cell
//   cellGet(cellId, rawDefault)   the cell of the sheet (CvJpData.js cvJpCellGet): what the paper or
//                                 its template says of it, else rawDefault
//   hiddenList                    the employers, the projects and the facts of an employer this
//                                 paper leaves out, by their key
//   isEra                         the years of the periods have their era above them ({{period:…|era}})
// -> { employerList, isListEmpty, listText, sideTitle }
//   an employer   { key, id, isHidden, period, name, employment, factList, factPathText, projectList, pathText }
//                 factList: its own entries in the profile, [{ id, key, pathText, labelCell, label, cell,
//                 isShown, isHidden }]: two cells, its label and what it says; isShown: it says
//                 something; isHidden: this paper leaves it out; factPathText: where a new one goes
//   a project     { key, id, isHidden, ordinal, period, title, summary, factSideList, factMainList, pathText }
//                 ordinal: its place among the projects of its employer this paper draws, from 1
//                 (0 for one without a start, which is not numbered)
//   a period      { cell, start, isNow, isTimeless }: its cell, the token of its folder; its start in
//                 the profile ({ status, year, month }), whether it goes on, whether it has no date
//   a fact of a project   { id, label, place, cell, isShown }
// key: what names it in the paper (sample-systems, sample-systems/hr-dashboard, and for a fact
// sample-systems#business); id: its cells' prefix
export function weJpCareerBuild(section, { info, cellGet, hiddenList = [], isEra = false }) {
	const read = weJpCareerSectionRead(section);
	const { listPath, projectFolder, lang } = read;
	const cellOf = (key, field, pathList) => cellGet(`${section.id}:${key}:${field}`, `{{${pathList.join('/')}}}`);
	// a period is one cell whose text is the token of its folder ({{period:work/x}}), drawn as its
	// start over a vertical line over its end. what orders the rows is the dates of the profile
	const periodBuild = (key, basePath) => {
		const folder = basePath.join('/');
		const resolved = cvPeriodResolve(info, cvPeriodRead(folder));
		return {
			cell: cellGet(`${section.id}:${key}:period`, `{{${CV_PERIOD_SIGIL}${folder}${isEra ? '|era' : ''}}}`),
			start: resolved.start,
			isNow: resolved.isNow,
			isTimeless: resolved.isTimeless,
		};
	};
	const factBuild = (key, basePath, fact) => {
		const cell = cellOf(key, fact.id, [...basePath, lang, fact.id]);
		return { ...fact, cell, isShown: cell.text !== '' };
	};
	// the facts of an employer: the folders below its fact folder, in the order of the data. the
	// label and what it says are two cells, each the query of its value, so both are typed in place
	const factOwnListBuild = (employerKey, basePath) => {
		const factPath = [...basePath, lang, WE_JP_FACT_FOLDER];
		return weJpFolderListGet(info, factPath).map((factId) => {
			const key = weJpFactKeyGet(employerKey, factId);
			const labelCell = cellGet(`${section.id}:${employerKey}:${WE_JP_FACT_FOLDER}/${factId}:${WE_JP_FACT_LABEL}`, `{{${[...factPath, factId, WE_JP_FACT_LABEL].join('/')}}}`);
			const cell = cellGet(`${section.id}:${employerKey}:${WE_JP_FACT_FOLDER}/${factId}:${WE_JP_FACT_TEXT}`, `{{${[...factPath, factId, WE_JP_FACT_TEXT].join('/')}}}`);
			return { id: factId, key, pathText: [...factPath, factId].join('/'), labelCell, label: labelCell.text, cell, isShown: cell.text !== '', isHidden: hiddenList.includes(key) };
		});
	};
	const employerList = weJpFolderListGet(info, listPath).map((employerKey) => {
		const basePath = [...listPath, employerKey];
		const projectList = weJpFolderListGet(info, [...basePath, projectFolder]).map((projectKey) => {
			const key = `${employerKey}/${projectKey}`;
			const projectPath = [...basePath, projectFolder, projectKey];
			const factList = read.projectFactList.map((fact) => factBuild(key, projectPath, fact));
			return {
				key,
				id: `${section.id}:${key}`,
				pathText: projectPath.join('/'),
				isHidden: hiddenList.includes(key),
				period: periodBuild(key, projectPath),
				title: cellOf(key, 'title', [...projectPath, lang, 'title']),
				summary: cellOf(key, 'summary', [...projectPath, lang, 'summary']),
				factSideList: factList.filter((fact) => fact.place === 'side'),
				factMainList: factList.filter((fact) => fact.place === 'main'),
			};
		});
		return {
			key: employerKey,
			id: `${section.id}:${employerKey}`,
			pathText: basePath.join('/'),
			isHidden: hiddenList.includes(employerKey),
			period: periodBuild(employerKey, basePath),
			name: cellOf(employerKey, 'name', [...basePath, lang, 'name']),
			employment: cellOf(employerKey, 'employment', [...basePath, lang, 'employment']),
			factList: factOwnListBuild(employerKey, basePath),
			factPathText: [...basePath, lang, WE_JP_FACT_FOLDER].join('/'),
			projectList: ordinalApply(orderApply(projectList, read.isNewestFirst)),
		};
	});
	return {
		employerList: orderApply(employerList, read.isNewestFirst),
		isListEmpty: employerList.length === 0,
		listText: listPath.join('/'),
		// the head of the column of the facts beside a project: the labels of the first of them
		sideTitle: read.projectFactList.filter((fact) => fact.place === 'side').slice(0, 3).map((fact) => fact.label).join('・'),
	};
}

// what names a fact of an employer in a paper (its list of what it leaves out): no key of a
// project is written so
export function weJpFactKeyGet(employerKey, factId) {
	return `${employerKey}#${factId}`;
}

// ---------- a new employer, a new project, a new fact ----------

// a folder name nothing means anything by: lowercase letters and digits, the time first, so that
// folders made one after another keep their order in the data
export function weJpFolderNameNew(dateNow = new Date()) {
	return `${dateNow.getTime().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;
}

// what a new employer, or a new project of an employer, is in the profile: the path of its data
// item below /info, and its data. it starts at the date of the paper, with its name still to type
//   employerKey   the employer of a new project; absent: a new employer
export function weJpCareerItemNew(section, { employerKey, date = new Date(), folderName = weJpFolderNameNew(date) } = {}) {
	const { listPath, projectFolder, lang } = weJpCareerSectionRead(section);
	const pathList = employerKey ? [...listPath, employerKey, projectFolder, folderName] : [...listPath, folderName];
	return {
		pathInInfo: pathList.join('/'),
		data: {
			start: { year: date.getFullYear(), month: date.getMonth() + 1 },
			[lang]: employerKey ? { title: '' } : { name: '' },
		},
	};
}

// a new fact of an employer: its id, a key nothing means anything by, and what it is in the
// profile. its label and what it says are still to type; the sheet shows what each is for
export function weJpFactNew(dateNow = new Date()) {
	return { id: weJpFolderNameNew(dateNow), data: { [WE_JP_FACT_LABEL]: '', [WE_JP_FACT_TEXT]: '' } };
}
