import { cvEntryListResolve, cvQueryParse, cvSegmentNormalize, cvTextExpand } from '../query/CvQuery.js';
import { WE_JP_PART_LIST, WE_JP_TEMPLATE_DEFAULT, weJpCareerBuild } from './WeJpData.js';

// The data of a sheet, without its drawing (doc/cv-sheet.md): what the two Japanese-style forms,
// the CV (cv-jp) and the work experience (we-jp), share. What is the work experience's own is
// WeJpData.js.
//
//   a template (kind template, /{partition}/template/{name})   the sections of a form, and the text of its cells
//   a paper (kind cv or we, /{partition}/cv/{name}, /{partition}/we/{name})
//                                                              a template, a profile, and what differs from the template
//
// A text of a cell is literal words with tokens in it: queries of the profile in {{ }}, and
// what every cell of react-doc's cell editing kit may hold (a link, a view of an object). A
// paper overrides a cell with its own text, so a hard-coded value, another query and a
// link are one thing.

export const CV_KIND_TEMPLATE = 'template';
export const CV_KIND_CV = 'cv';
export const CV_KIND_WE = 'we';
// a part template: one part of a form, ready to be added to a paper (doc/cv-sheet.md#parts)
export const CV_KIND_PART = 'part';

// the cells of the section "basic": what each says unless a template or instance says otherwise
export const CV_JP_CELL_DEFAULT = {
	date: '{{date/jp}}現在',
	'name-furigana-last': '{{name/jp/last/hiragana}}',
	'name-furigana-first': '{{name/jp/first/hiragana}}',
	'name-last': '{{name/jp/last/kanji}}',
	'name-first': '{{name/jp/first/kanji}}',
	'birth-era': '{{birth/era}}',
	'birth-year': '{{birth/year}}',
	'birth-month': '{{birth/month}}',
	'birth-day': '{{birth/day}}',
	age: '{{birth/age}}',
	gender: '{{gender}}',
	postal: '{{address/jp/postal}}',
	address: '{{address/jp/text}}',
	email: '{{email}}',
	phone: '{{phone/jp}}',
	photo: '{{photo}}',
	visa: '{{visa/jp}}',
	'visa-expiry': '{{visa/expiry/jp}}',
	nationality: '{{nationality/jp}}',
	github: '{{github}}',
	homepage: '{{homepage}}',
	// the section "head": the name as a whole, its parts joined
	'name-full': '{{name/jp/kanji}}',
};

// the cell of the title of a paper's PDF (doc/cv-sheet.md#pages): what a PDF reader shows as its
// title and what its file is named, words and queries (履歴書_{{name/jp/kanji}}); empty: the
// paper's name. a cell of the paper (valueByCell), a template may give one (cellById)
export const CV_JP_CELL_PDF_TITLE = 'pdf-title';

// the rows of the top a paper may draw or not (the options of the part: doc/cv-sheet.md#the-options-of-a-part):
// each shown when one of its cells says something, always, or never, as its option says
//   option     the key of the option of the part saying it
export const CV_JP_ROW_OPTIONAL_LIST = [
	{ id: 'visa', option: 'rowVisa', cellList: [{ id: 'visa', label: '在留資格' }, { id: 'visa-expiry', label: '在留期限' }] },
	{ id: 'nationality', option: 'rowNationality', cellList: [{ id: 'nationality', label: '国籍' }] },
	{ id: 'link', option: 'rowLink', cellList: [{ id: 'github', label: 'GitHub ページ' }, { id: 'homepage', label: 'ホームページ' }] },
];

// ---------- the options of a part (doc/cv-sheet.md#the-options-of-a-part) ----------

// when a row of the top is drawn
export const CV_JP_ROW_SHOWN_LIST = [
	{ value: 'auto', label: 'If filled', description: 'drawn when one of its cells says something' },
	{ value: 'always', label: 'Always', description: 'drawn, empty or not: a place to write by hand' },
	{ value: 'never', label: 'Never', description: 'not drawn, whatever the profile holds' },
];

// what a part of a type lets a paper change of it, in the card of its options (CvJpPart.jsx). each
//   { key, label, description, group, kind: boolean | choice | number, choiceList?, min?, max?, default }
//   group   the heading it stands under in the card (CV_JP_PART_OPTION_GROUP_LABEL)
// a value is kept on the part (its section, in a template or a part of the paper's own) and, for
// one paper, in its optionBySection: the paper's over the part's over the default
export const CV_JP_PART_OPTION_GROUP_LABEL = { shown: 'What it draws', width: 'Widths (px)', block: 'The block', career: 'The career' };
export const CV_JP_PART_OPTION_LIST_BY_TYPE = {
	basic: [
		{ key: 'isPhoto', label: '写真欄', group: 'shown', description: 'The photo box at the right of the name. Without it the form takes the whole width.', kind: 'boolean', default: true },
		{ key: 'rowVisa', label: '在留資格', group: 'shown', description: 'A row of 在留資格 and 在留期限, the status of residence and its expiry: {{visa/jp}}, {{visa/expiry/jp}}.', kind: 'choice', choiceList: CV_JP_ROW_SHOWN_LIST, default: 'auto' },
		{ key: 'rowNationality', label: '国籍', group: 'shown', description: 'A row of the nationality: {{nationality/jp}}.', kind: 'choice', choiceList: CV_JP_ROW_SHOWN_LIST, default: 'auto' },
		{ key: 'rowLink', label: 'リンク', group: 'shown', description: 'A row of links under the top, GitHub ページ and ホームページ: {{github}}, {{homepage}}.', kind: 'choice', choiceList: CV_JP_ROW_SHOWN_LIST, default: 'auto' },
		// the columns of its form: a heading, a value, a heading, the right value (電話番号, 在留期限, the gender);
		// the first value takes the rest of the width
		{ key: 'widthKey', label: '見出し', group: 'width', description: 'The width of a column of headings (ふりがな, 生年月日, 電話番号).', kind: 'number', min: 60, max: 240, default: 115 },
		{ key: 'widthEnd', label: '右の欄', group: 'width', description: 'The width of the column at the right (電話番号, 在留期限, the gender); the e-mail address takes the rest.', kind: 'number', min: 60, max: 360, default: 118 },
	],
	text: [
		{ key: 'isIndent', label: '段落の字下げ', group: 'block', description: 'Every paragraph starts with an indent.', kind: 'boolean', default: false },
		{ key: 'heightMin', label: '最小の高さ', group: 'block', description: 'The least height of its free area in px, as the box of a paper form; 0: as tall as its text.', kind: 'number', min: 0, max: 1000, default: 0 },
	],
	career: [
		{ key: 'isNewestFirst', label: '新しい順', group: 'career', description: 'The employers and their projects, the newest first.', kind: 'boolean', default: false },
	],
	education: [
		{ key: 'isDegree', label: '学位', group: 'shown', description: 'A column of the degree obtained: {{edu/{…}/degree/jp}}.', kind: 'boolean', default: true },
	],
};

// ---------- 最終学歴: the last school, briefly (doc/we-jp.md#最終学歴) ----------

// the education a paper names as the last: of the dated entries under list (edu), grouped by the
// education they start or end (edu/master/start, edu/master/end: edu/master), the one ending last (by
// its end, else its start: one still going on). { itemPath: edu/master, datePath: edu/master/end,
// isEnded }, or undefined when the profile holds none
export function cvJpEducationLastGet(info, list = 'edu') {
	const head = cvQueryParse(list).segmentList;
	const itemByPath = new Map();
	for (const entry of info?.entryList ?? []) {
		const path = (entry.pathList?.[0] ?? []).map(String);
		if (path.length <= head.length || head.some((one, index) => cvSegmentNormalize(path[index]) !== one)) continue;
		const last = cvSegmentNormalize(path[path.length - 1]);
		const isBound = last === 'start' || last === 'end';
		const itemPath = (isBound ? path.slice(0, -1) : path).join('/');
		const item = itemByPath.get(itemPath) ?? { itemPath };
		item[isBound ? last : 'dated'] = { entry, path: path.join('/') };
		itemByPath.set(itemPath, item);
	}
	const rankOf = (entry) => Number(entry.value.year) * 100 + (Number(entry.value.month) || 0);
	let found;
	for (const item of itemByPath.values()) {
		const date = item.end ?? item.dated ?? item.start;
		if (!date || !Number.isFinite(rankOf(date.entry))) continue;
		if (!found || rankOf(date.entry) >= found.rank) found = { itemPath: item.itemPath, datePath: date.path, isEnded: Boolean(item.end ?? item.dated), rank: rankOf(date.entry) };
	}
	return found ? { itemPath: found.itemPath, datePath: found.datePath, isEnded: found.isEnded } : undefined;
}

export function cvJpPartOptionListGet(type) {
	return CV_JP_PART_OPTION_LIST_BY_TYPE[type] ?? [];
}

// an option's value as it may be kept, or undefined when what is written is none of its values
function partOptionValueRead(option, value) {
	if (option.kind === 'boolean') return typeof value === 'boolean' ? value : undefined;
	if (option.kind === 'choice') return option.choiceList.some((one) => one.value === value) ? value : undefined;
	if (option.kind === 'number') return typeof value === 'number' && Number.isFinite(value) && value >= (option.min ?? 0) && value <= (option.max ?? Infinity) ? value : undefined;
	return undefined;
}

// a section with the options of a paper on it: { ...section, [key]: value, optionBase, optionOwnList }
//   optionBase      each option as the part says it, before the paper: what a value of the paper
//                   equal to it is taken away for
//   optionOwnList   the keys the paper sets itself
function sectionOptionApply(section, optionByKey) {
	const optionList = cvJpPartOptionListGet(section.type);
	if (optionList.length === 0) return section;
	const optionBase = Object.fromEntries(optionList.map((option) => [option.key, partOptionValueRead(option, section[option.key]) ?? option.default]));
	const own = Object.fromEntries(optionList.map((option) => [option.key, partOptionValueRead(option, mappingOf(optionByKey)[option.key])]).filter(([, value]) => value !== undefined));
	return { ...section, ...optionBase, ...own, optionBase, optionOwnList: Object.keys(own) };
}

// the rows of a top (a section of the type basic) as its options say: each with its cells and isShown
function rowOptionalListBuild(section, cellGet) {
	return CV_JP_ROW_OPTIONAL_LIST.map((row) => {
		const cellList = row.cellList.map((one) => ({ ...one, cell: cellGet(one.id) }));
		const shown = section[row.option] ?? 'auto';
		const isShown = shown === 'always' || (shown === 'auto' && cellList.some((one) => one.cell.text !== ''));
		return { ...row, cellList, shown, isShown };
	});
}

export const CV_JP_TEMPLATE_DEFAULT = {
	name: '履歴書 標準様式',
	sectionList: [
		{ id: 'basic', type: 'basic' },
		{
			id: 'history',
			type: 'history',
			title: '学 歴・職 歴',
			groupList: [
				{ id: 'edu', title: '学 歴', list: 'edu/jp' },
				{ id: 'work', title: '職 歴', list: 'work/jp', isNote: true },
			],
		},
		{
			id: 'license',
			type: 'history',
			title: '免 許・資 格',
			isNote: true,
			groupList: [{ id: 'license', list: 'license/jp', isNote: true }],
		},
		{ id: 'motivation', type: 'text', title: '志 望 の 動 機', text: '{{motivation/jp}}', heightMin: 120, isIndent: true },
	],
};

// the parts a CV offers to be added (doc/cv-sheet.md#parts): the top with a photo or without, those
// of its standard template, a block of self-PR, a block to fill, the closing line. Each is { id,
// label, section }: the section a new part is made of (its id given when it is added)
const cvJpSectionOfDefault = (id) => CV_JP_TEMPLATE_DEFAULT.sectionList.find((section) => section.id === id);
export const CV_JP_PART_LIST = [
	{ id: 'basic', label: '基本情報（写真あり）', section: { type: 'basic' } },
	{ id: 'basic-no-photo', label: '基本情報（写真なし）', section: { type: 'basic', isPhoto: false } },
	{ id: 'history', label: '学歴・職歴', section: cvJpSectionOfDefault('history') },
	{ id: 'license', label: '免許・資格', section: cvJpSectionOfDefault('license') },
	{ id: 'motivation', label: '志望の動機', section: cvJpSectionOfDefault('motivation') },
	{ id: 'pr', label: '自己PR', section: { type: 'text', title: '自 己 P R', text: '{{pr/jp}}', heightMin: 120, isIndent: true } },
	{ id: 'block', label: 'ブロック（タイトルと自由欄）', section: { type: 'text', title: '', text: '' } },
	{ id: 'closing', label: '以上', section: { type: 'closing', text: '以上' } },
];

// the forms: each a kind of paper of the object, with the template drawn when a paper names none
//   label, labelPlural   how a paper of it is called in a sentence, and a list of them
//   templatePath         where its standard template is written in a partition, by the first paper
//   isEra                whether the years the form draws itself have their era above them, unless
//                        its template or a paper says otherwise (doc/cv-sheet.md#a-year-with-its-era)
//   partList             the parts it offers to be added to a paper, before the part templates of
//                        the object (cvJpPartTemplateListGet)
export const CV_JP_FORM_LIST = [
	{ kind: CV_KIND_CV, id: 'cv-jp', label: 'CV', labelPlural: 'CVs', templateDefault: CV_JP_TEMPLATE_DEFAULT, templatePath: '/template/cv-jp-standard', isEra: true, partList: CV_JP_PART_LIST },
	{ kind: CV_KIND_WE, id: 'we-jp', label: 'work experience', labelPlural: 'Work experiences', templateDefault: WE_JP_TEMPLATE_DEFAULT, templatePath: '/template/we-jp-standard', isEra: false, partList: WE_JP_PART_LIST },
];
export const CV_JP_KIND_PAPER_LIST = CV_JP_FORM_LIST.map((form) => form.kind);

// the form of a kind of paper; the CV for anything else
export function cvJpFormGet(kind) {
	return CV_JP_FORM_LIST.find((form) => form.kind === kind) ?? CV_JP_FORM_LIST[0];
}

// the papers of an object, of every form or of one: its assets of the kinds cv and we, in the
// order the object lists them
export function cvJpPaperListGet(service, kind) {
	const kindList = kind ? [kind] : CV_JP_KIND_PAPER_LIST;
	return service.assetList().filter((asset) => kindList.includes(asset.kind));
}

function mappingIs(value) {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mappingOf(value) {
	return mappingIs(value) ? value : {};
}

// how the text of a cell may stand in its box (doc/cv-sheet.md#the-alignment-of-a-cell); a cell
// naming none stands as its form draws it
export const CV_JP_ALIGN_LIST = ['left', 'center', 'right'];

// { cellId: left | center | right }, whatever was written in its place
function alignByCellRead(value) {
	return Object.fromEntries(Object.entries(mappingOf(value)).filter(([, align]) => CV_JP_ALIGN_LIST.includes(align)));
}

// a copy of a paper or a template (doc/cv-sheet.md#duplicating-a-paper): beside it, in the same
// folder of the same partition, named after it. { name, path, data }:
//   name   its name with （コピー）, （コピー 2）, … : the first no asset of the object has
//   path   its path with -copy, -copy-2, … at the end: the first no asset has
//   data   what it holds, its name the new one (where it holds one); everything else as it is (its
//          template, its profile, its own cells, rows and parts)
//   assetList   the assets of the object, whose names and paths are taken
export function cvJpPaperCopyGet(asset, data, assetList = []) {
	const nameTakenSet = new Set(assetList.map((one) => one.name).filter(Boolean));
	const pathTakenSet = new Set(assetList.flatMap((one) => one.pathList ?? []));
	const nameBase = String(asset.name || mappingOf(data).name || asset.key).replace(/（コピー(?: \d+)?）$/, '');
	const pathBase = String(asset.pathList?.[0] ?? `/${asset.kind}/${asset.key}`).replace(/-copy(?:-\d+)?$/, '');
	let count = 1;
	const suffixGet = (one) => (one === 1 ? '' : ` ${one}`);
	while (nameTakenSet.has(`${nameBase}（コピー${suffixGet(count)}）`)) count += 1;
	const name = `${nameBase}（コピー${suffixGet(count)}）`;
	count = 1;
	while (pathTakenSet.has(`${pathBase}-copy${count === 1 ? '' : `-${count}`}`)) count += 1;
	const path = `${pathBase}-copy${count === 1 ? '' : `-${count}`}`;
	const dataCopy = structuredClone(mappingIs(data) ? data : {});
	if (mappingIs(data) && (typeof data.name === 'string' || CV_JP_KIND_PAPER_LIST.includes(asset.kind) || asset.kind === CV_KIND_TEMPLATE)) dataCopy.name = name;
	return { name, path, data: dataCopy };
}

// the kinds of section the sheet draws; a section of another type is left out and reported
//   basic     the top of a CV: name, birth, address, contacts, photo (isPhoto: false, without it)
//   head      the top of a work experience: its title, the date, the name
//   history   a table of dated entries: 年, 月, the text, sometimes 備考
//   career    the employers of the profile with their projects (WeJpData.js)
//   text      a block: a title line and a free area below it
//   closing   a line at the right under everything: 以上
//   education the last school, briefly: 年月, the school, its status (卒業, 修了, …) and the degree, read
//             from the latest education of the profile (doc/we-jp.md#最終学歴)
export const CV_JP_SECTION_TYPE_LIST = ['basic', 'head', 'history', 'career', 'text', 'closing', 'education'];
// the kind of section a paper adds of its own
export const CV_JP_SECTION_TYPE_BLOCK = 'text';

// a section as it is drawn: a template written by hand may leave out anything
function sectionRead(section, index) {
	const one = mappingOf(section);
	return {
		...one,
		id: String(one.id ?? `section-${index}`),
		type: String(one.type ?? 'text'),
		groupList: Array.isArray(one.groupList) ? one.groupList.map((group, groupIndex) => ({ ...mappingOf(group), id: String(mappingOf(group).id ?? `group-${groupIndex}`) })) : [],
	};
}

// a part of a paper's own, or of a part template: a section of a type the sheet draws, a block
// when its type is none of them
function sectionPartRead(section, index) {
	const one = sectionRead(section, index);
	return { ...one, type: CV_JP_SECTION_TYPE_LIST.includes(one.type) ? one.type : CV_JP_SECTION_TYPE_BLOCK };
}

// a template as it is drawn: { name, form, sectionList, cellById, problemList }. what is left out
// is left out (no sectionList: the sections of the default form); what cannot be drawn (a section
// that is no mapping, of a type the sheet does not know) is left out and said in problemList,
// which the sheet shows above itself
//   form   the form the paper is of (cvJpFormGet): its default is drawn where the template says nothing
export function cvJpTemplateRead(data, form = CV_JP_FORM_LIST[0]) {
	const problemList = [];
	if (data !== undefined && data !== null && !mappingIs(data)) problemList.push('the template is not a mapping of keys: the default form is drawn');
	const template = mappingOf(data);
	let sectionSource = form.templateDefault.sectionList;
	if (Array.isArray(template.sectionList)) sectionSource = template.sectionList;
	else if (template.sectionList !== undefined) problemList.push('its sectionList is not a list: the sections of the default form are drawn');
	const sectionList = [];
	sectionSource.forEach((source, index) => {
		if (!mappingIs(source)) {
			problemList.push(`its section ${index + 1} is not a mapping of keys (id, type, title, …): left out`);
			return;
		}
		const section = sectionRead(source, index);
		if (!CV_JP_SECTION_TYPE_LIST.includes(section.type)) {
			problemList.push(`its section ${section.id} has the type "${section.type}", none of ${CV_JP_SECTION_TYPE_LIST.join(', ')}: left out`);
			return;
		}
		if (section.type === 'history' && !Array.isArray(source.groupList)) problemList.push(`its section ${section.id} is a history without a groupList: it has no rows`);
		if (sectionList.some((one) => one.id === section.id)) {
			problemList.push(`its section ${index + 1} has the id "${section.id}" of a section before it: left out`);
			return;
		}
		sectionList.push(section);
	});
	return {
		name: String(template.name ?? ''),
		form: String(template.form ?? CV_KIND_CV),
		isEra: typeof template.isEra === 'boolean' ? template.isEra : form.isEra === true,
		sectionList,
		cellById: mappingOf(template.cellById),
		alignByCell: alignByCellRead(template.alignByCell),
		problemList,
	};
}

// whether a text can be drawn as an image: an image kept as text (data:image/…), a url, a path of
// an image file. the photo is drawn only then, else its box stays empty and is marked in edit mode
export function cvJpImageSourceIs(text) {
	const value = String(text ?? '').trim();
	if (value === '' || /\s/.test(value)) return false;
	return /^(data:image\/|https?:\/\/|blob:)/i.test(value) || /\.(png|jpe?g|gif|webp|avif|svg)([?#].*)?$/i.test(value);
}

// a list of texts, whatever was written in its place
function textListOf(value) {
	return Array.isArray(value) ? value.filter((one) => typeof one === 'string' || typeof one === 'number').map(String) : [];
}

// what differs from the template:
//   valueByCell        { cellId: text }: this paper's own text of a cell
//   rowExtraByGroup    { groupId: [{ year, month, text, note }] }: rows only this paper has
//   rowHiddenByGroup   { groupId: [entryId] }: entries of the profile this paper leaves out (of a
//                      career, by its section: its employers and projects, by their key)
//   rowOrderByGroup    { groupId: [rowId] }: the order of the rows, when it is not the order of time
//   sectionExtraList   [{ id, type, … }]: parts only this paper has, each a whole section (made
//                      from a part template: doc/cv-sheet.md#parts)
//   sectionHiddenList  [sectionId]: sections this paper leaves out
//   sectionOrderList   [sectionId]: the order of the sections, when it is not the template's
//   optionBySection    { sectionId: { key: value } }: the options of a part, for this paper
//                      (doc/cv-sheet.md#the-options-of-a-part)
//   alignByCell        { cellId: left | center | right }: how this paper stands the text of a cell
//                      in its box, where it differs from its template (alignByCell) and its form
//   isEra              the era above the years, for this paper; undefined: its template's way
export function cvJpInstanceRead(data) {
	const instance = mappingOf(data);
	return {
		isEra: typeof instance.isEra === 'boolean' ? instance.isEra : undefined,
		sectionExtraList: (Array.isArray(instance.sectionExtraList) ? instance.sectionExtraList : [])
			.filter((one) => mappingIs(one) && typeof one.id === 'string' && one.id !== '')
			.map((one, index) => sectionPartRead(one, index)),
		sectionHiddenList: textListOf(instance.sectionHiddenList),
		sectionOrderList: textListOf(instance.sectionOrderList),
		name: String(instance.name ?? ''),
		template: String(instance.template ?? ''),
		profile: String(instance.profile ?? ''),
		asOf: String(instance.asOf ?? ''),
		valueByCell: mappingOf(instance.valueByCell),
		alignByCell: alignByCellRead(instance.alignByCell),
		optionBySection: Object.fromEntries(Object.entries(mappingOf(instance.optionBySection)).filter(([, one]) => mappingIs(one))),
		rowExtraByGroup: mappingOf(instance.rowExtraByGroup),
		rowHiddenByGroup: mappingOf(instance.rowHiddenByGroup),
		rowOrderByGroup: mappingOf(instance.rowOrderByGroup),
	};
}

// a date of an instance (2026-01-15), or today: what {{date/...}} and an age are read at
export function cvJpDateGet(asOf, dateToday = new Date()) {
	const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(asOf ?? '').trim());
	return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : dateToday;
}

export function cvJpDateVirtualBuild(date) {
	const pad = (value) => String(value).padStart(2, '0');
	return {
		date: {
			jp: `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日`,
			year: date.getFullYear(),
			month: date.getMonth() + 1,
			day: date.getDate(),
		},
	};
}

// the text a cell is drawn from, and where that text is said: the paper, its template, else what
// the section drawing it says of it (rawDefault: the text of a block, the query of a value of a
// career), else the form
export function cvJpCellRawGet(cellId, template, instance, rawDefault) {
	if (instance.valueByCell[cellId] !== undefined) return { raw: String(instance.valueByCell[cellId] ?? ''), source: 'instance' };
	if (template.cellById[cellId] !== undefined) return { raw: String(template.cellById[cellId] ?? ''), source: 'template' };
	if (rawDefault !== undefined) return { raw: String(rawDefault), source: 'template' };
	return { raw: CV_JP_CELL_DEFAULT[cellId] ?? '', source: 'default' };
}

// a cell as it is drawn: its text as written (raw), where that text is said, and what it says:
//   text          its plain text: the queries read, and, with context.cellTextGet (the cell of
//                 react-doc's cell editing kit the sheet draws its cells with), every other token
//                 as text too (a link as its label): what the pages print and what is compared
//   textExpanded  its text with the queries read and every other token as written: what is cut into
//                 lines (cvJpTextLineListBuild), each then drawn with its tokens
//   isQueryFree   it holds no query: its lines are lines of its text as written
//   missingList   the queries nothing answers; leaf, query: when the cell is one query
export function cvJpCellGet(cellId, { template, instance, info, context, rawDefault }) {
	const { raw, source } = cvJpCellRawGet(cellId, template, instance, rawDefault);
	const expanded = cvTextExpand(info, raw, context);
	// how its text stands in its box: the paper's, else its template's, else its form's ('')
	const alignTemplate = template.alignByCell?.[cellId] ?? '';
	return {
		id: cellId,
		raw,
		source,
		align: instance.alignByCell?.[cellId] ?? alignTemplate,
		alignTemplate,
		isOverride: source === 'instance',
		...expanded,
		textExpanded: expanded.textKept,
		isQueryFree: !expanded.partList.some((part) => part.kind === 'query'),
		text: context?.cellTextGet ? context.cellTextGet(raw) : expanded.text,
	};
}

// ---------- the lines of a block ----------

// a line that is a heading inside a block: ■ 得意な分野, 【業務内容】, ＜サービス拡大のための開発力＞
const LINE_HEADING_REGEX = /^\s*(■.*|【[^】]*】|＜[^＞]*＞|<[^<>]*>)\s*$/;
// a line starting with a label: 【役割】設計・実装, [GitHub] https://… (not a link, [label](target)),
// ［開発環境］React (the brackets of full width, as a Japanese keyboard types them)
const LINE_LABEL_REGEX = /^(\s*(?:【([^】\n]{1,24})】|\[([^\]\n]{1,24})\](?!\()|［([^］\n]{1,24})］)[ \t　]*)(\S.*)$/;
// a line starting with a mark of a list: ・ • - * (1) 1. ①
const LINE_BULLET_REGEX = /^(\s*)([・•◦▪‣]|[-*](?=\s)|\(\d{1,2}\)|\d{1,2}[.)）](?=\s)|[①-⑳])[ \t　]*(.*)$/;

// the lines of a text as a block draws them (doc/cv-sheet.md#blocks): a text stays one string of
// words and tokens, and how a line starts says what it is, the way such a text is written by hand:
//   blank     an empty line: a gap between paragraphs
//   heading   ■ …, 【…】 or ＜…＞ alone: a small heading
//   label     【役割】…, [GitHub] … or ［GitHub］…: a label, then what it says; labels one under another line up
//   bullet    ・… - … (1) … 1. …: an item of a list, its lines going on under its text
//   text      anything else: a paragraph
// -> [{ kind, text, start, mark?, label? }]
//   text    what is drawn of the line after its mark or label, tokens as written
//   start   where that text starts in the line: a token changed in it is written back there
export function cvJpTextLineListBuild(textInput) {
	const text = String(textInput ?? '');
	if (text === '') return [];
	return text.split('\n').map((line) => {
		if (line.trim() === '') return { kind: 'blank', text: '', start: line.length };
		if (LINE_HEADING_REGEX.test(line)) return { kind: 'heading', text: line.trim(), start: line.length - line.trimStart().length };
		const label = LINE_LABEL_REGEX.exec(line);
		if (label) return { kind: 'label', label: label[2] ?? label[3] ?? label[4], text: label[5], start: label[1].length };
		const bullet = LINE_BULLET_REGEX.exec(line);
		if (bullet && bullet[3] !== '') return { kind: 'bullet', mark: bullet[2], text: bullet[3], start: line.length - bullet[3].length };
		return { kind: 'text', text: line, start: 0 };
	});
}

// a text with what is drawn of one of its lines replaced (a token of that line changed from its card)
export function cvJpTextLineReplace(textInput, lineIndex, start, textNext) {
	const lineList = String(textInput ?? '').split('\n');
	if (lineIndex < 0 || lineIndex >= lineList.length) return String(textInput ?? '');
	lineList[lineIndex] = `${lineList[lineIndex].slice(0, start)}${textNext}`;
	return lineList.join('\n');
}

// ---------- the sections of a paper ----------

// an id of something a paper makes of its own (a block): lowercase letters and digits, the time first
export function cvJpIdNew() {
	return `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;
}

// the sections a paper draws: those of its template and its own parts, in the template's order
// with its parts after them, or in the order the paper gives (a section it does not name, added
// to the template since, follows at the end); isHidden: the paper leaves it out, isOwn: its own part
export function cvJpSectionListResolve(template, instance) {
	const idTemplateSet = new Set(template.sectionList.map((section) => section.id));
	const ownList = instance.sectionExtraList.filter((section) => !idTemplateSet.has(section.id)).map((section) => ({ ...section, isOwn: true }));
	const sectionList = [...template.sectionList, ...ownList];
	const orderList = instance.sectionOrderList;
	const rankGet = (section) => {
		const at = orderList.indexOf(section.id);
		return at < 0 ? orderList.length : at;
	};
	const ordered = orderList.length === 0 ? sectionList
		: sectionList.map((section, index) => ({ section, index })).sort((a, b) => (rankGet(a.section) - rankGet(b.section)) || (a.index - b.index)).map((one) => one.section);
	return ordered.map((section) => ({ ...sectionOptionApply(section, instance.optionBySection?.[section.id]), isHidden: instance.sectionHiddenList.includes(section.id) }));
}

// the ids of the sections with one moved a place up or down among those drawn (delta: -1, 1): a
// paper is its parts stacked, any of them may stand anywhere. undefined when it cannot move
export function cvJpSectionOrderMove(sectionList, sectionId, delta) {
	const idList = sectionList.map((section) => section.id);
	const shownList = sectionList.filter((section) => !section.isHidden).map((section) => section.id);
	const at = shownList.indexOf(sectionId);
	const atTarget = at + delta;
	if (at < 0 || atTarget < 0 || atTarget >= shownList.length) return undefined;
	const idTarget = shownList[atTarget];
	const rest = idList.filter((id) => id !== sectionId);
	rest.splice(rest.indexOf(idTarget) + (delta > 0 ? 1 : 0), 0, sectionId);
	return rest;
}

// the ids of the sections with a new one placed after another; sectionIdAfter '' places it first,
// one not there last
export function cvJpSectionOrderInsert(sectionList, sectionIdNew, sectionIdAfter) {
	const idList = sectionList.map((section) => section.id);
	if (sectionIdAfter === '') return [sectionIdNew, ...idList];
	const at = idList.indexOf(sectionIdAfter);
	idList.splice(at < 0 ? idList.length : at + 1, 0, sectionIdNew);
	return idList;
}

// the cells of a section that are its own: what a paper holds of a part it removes
export function cvJpSectionCellIdList(sectionId) {
	return [sectionId, `${sectionId}:title`];
}

// ---------- the parts a paper adds (doc/cv-sheet.md#parts) ----------

// what a part is called where it is chosen and listed (More fields, a step of the history): its
// title without the spaces of the form (志望の動機), else what its type is
const CV_JP_SECTION_TYPE_LABEL = { basic: '基本情報', head: '見出し', history: '履歴', career: '職務経歴', text: 'ブロック', closing: '以上', education: '最終学歴' };
export function cvJpSectionLabelGet(section) {
	const title = String(section?.titleCell?.text ?? section?.title ?? '').replace(/\s+/g, '');
	if (title) return title;
	if (section?.type === 'basic') return section.isPhoto === false ? '基本情報（写真なし）' : '基本情報';
	return CV_JP_SECTION_TYPE_LABEL[section?.type] ?? String(section?.id ?? '');
}

// a part template of the object (kind part): { name, form, section }; undefined when it holds no
// section to draw
//   form      the form it is a part of (cv, the default; we)
export function cvJpPartRead(data) {
	const part = mappingOf(data);
	if (!mappingIs(part.section)) return undefined;
	const section = sectionPartRead(part.section, 0);
	return { name: String(part.name ?? ''), form: String(part.form ?? CV_KIND_CV), section };
}

// the parts a paper of a form may add: the form's own (its partList), then the part templates of
// the object of that form, each { key, label, section, path? }; the section without an id (a part
// added is given one)
//   partAssetList   the assets of the kind part, readDataGet(key) their data as read (undefined
//                   while it is read)
export function cvJpPartTemplateListGet(form, partAssetList = [], readDataGet = () => undefined) {
	const sectionOf = (section) => {
		const { id: _id, ...rest } = section;
		return rest;
	};
	const formList = (form?.partList ?? []).map((part) => ({ key: `form:${part.id}`, label: part.label, section: sectionOf(part.section) }));
	const objectList = [];
	for (const asset of partAssetList) {
		const part = cvJpPartRead(readDataGet(asset.key));
		if (!part || part.form !== (form?.kind ?? CV_KIND_CV)) continue;
		objectList.push({ key: `object:${asset.key}`, label: part.name || asset.name || cvJpSectionLabelGet(part.section), section: sectionOf(part.section), path: asset.pathList?.[0] ?? '' });
	}
	return { formList, objectList };
}

// a new part of a paper from the section of a part template: a copy of it with an id of its own
export function cvJpSectionNew(section, id = cvJpIdNew()) {
	const { id: _id, isHidden: _hidden, isOwn: _own, titleCell: _titleCell, optionBase: _optionBase, optionOwnList: _optionOwnList, rowOptionalList: _rowList, ...rest } = structuredClone(section ?? {});
	return { id, ...rest, type: CV_JP_SECTION_TYPE_LIST.includes(rest.type) ? rest.type : CV_JP_SECTION_TYPE_BLOCK };
}

// the fields of a row of a history, in the order Tab goes through them
export const CV_JP_ROW_FIELD_LIST = ['year', 'month', 'text', 'note'];

// the id of a row only this CV has: kept in the row, so that its place in an order survives the
// rows before it being removed
export function cvJpRowIdNew() {
	return `r${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;
}

// the ids of a group with one moved before or after another
export function cvJpRowOrderMove(idList, idMoved, idTarget, isAfter) {
	const rest = idList.filter((id) => id !== idMoved);
	const at = rest.indexOf(idTarget);
	if (at < 0) return idList;
	rest.splice(isAfter ? at + 1 : at, 0, idMoved);
	return rest;
}

function rowExtraBuild(row, index, groupId) {
	const one = mappingOf(row);
	const idOwn = typeof one.id === 'string' && one.id ? one.id : undefined;
	return {
		id: `extra:${groupId}:${idOwn ?? index}`,
		idOwn,
		extraIndex: index,
		isExtra: true,
		year: String(one.year ?? ''),
		month: String(one.month ?? ''),
		text: String(one.text ?? ''),
		note: String(one.note ?? ''),
	};
}

// the rows of a group of a history table: the entries of its query, without those this CV
// hides, and this CV's own rows, in order of time, or in the order this CV gives them (rows the
// order does not name, added since, follow in order of time)
export function cvJpRowListBuild(group, instance, info) {
	const hiddenList = Array.isArray(instance.rowHiddenByGroup[group.id]) ? instance.rowHiddenByGroup[group.id] : [];
	const entryList = group.list ? cvEntryListResolve(info, group.list) : [];
	const rowFromEntry = entryList.map((entry) => ({ ...entry, isHidden: hiddenList.includes(entry.id) }));
	const rowExtra = (Array.isArray(instance.rowExtraByGroup[group.id]) ? instance.rowExtraByGroup[group.id] : []).map((row, index) => rowExtraBuild(row, index, group.id));
	const rowList = [...rowFromEntry, ...rowExtra].sort((a, b) => (Number(a.year) - Number(b.year)) || ((Number.parseInt(a.month, 10) || 0) - (Number.parseInt(b.month, 10) || 0)));
	const orderList = Array.isArray(instance.rowOrderByGroup?.[group.id]) ? instance.rowOrderByGroup[group.id].map(String) : [];
	if (orderList.length === 0) return rowList;
	const rankGet = (row) => {
		const at = orderList.indexOf(row.id);
		return at < 0 ? orderList.length : at;
	};
	return rowList.map((row, index) => ({ row, index })).sort((a, b) => (rankGet(a.row) - rankGet(b.row)) || (a.index - b.index)).map((one) => one.row);
}

// whether a group's rows are in an order of this CV's own
export function cvJpRowOrderIsOwn(group, instance) {
	return Array.isArray(instance.rowOrderByGroup?.[group.id]) && instance.rowOrderByGroup[group.id].length > 0;
}

// the paper to draw: its sections (those it leaves out too, isHidden), every cell with its text
// and queries resolved
//   cellGet(cellId, rawDefault)   a cell of the sheet
//   a section    titleCell: its title, a cell ({id}:title) as its text is ({id})
//   a history    groupList, each with its rowList
//   a block      cell, lineList: the lines of what it says
//   a closing    cell: its line
//   a career     employerList (WeJpData.js weJpCareerBuild)
//   isEra        the years the form draws itself (the rows of a history, the periods of a career)
//                have their era above them: the paper's way, else its template's
export function cvJpSheetBuild({ template, instance, info, context }) {
	const cellGet = (cellId, rawDefault) => cvJpCellGet(cellId, { template, instance, info, context, rawDefault });
	const isEra = instance.isEra ?? template.isEra === true;
	const sectionList = cvJpSectionListResolve(template, instance).map((sectionOne) => {
		const section = { ...sectionOne, titleCell: cellGet(`${sectionOne.id}:title`, String(sectionOne.title ?? '')) };
		if (section.type === 'history') {
			return {
				...section,
				isEra,
				groupList: section.groupList.map((group) => {
					const rowList = cvJpRowListBuild(group, instance, info);
					// the query of its rows reads no entry of the profile: marked in edit mode, as a cell
					// whose query nothing answers (a CV without any work yet has no rows there either)
					const isListEmpty = Boolean(group.list) && !rowList.some((row) => !row.isExtra);
					return { ...group, rowList, isListEmpty, isOrderOwn: cvJpRowOrderIsOwn(group, instance) };
				}),
			};
		}
		if (section.type === 'text') {
			const cell = cellGet(section.id, String(section.text ?? ''));
			return { ...section, cell, lineList: cvJpTextLineListBuild(cell.textExpanded) };
		}
		if (section.type === 'closing') return { ...section, cell: cellGet(section.id, String(section.text ?? '')) };
		if (section.type === 'career') {
			const hiddenList = Array.isArray(instance.rowHiddenByGroup[section.id]) ? instance.rowHiddenByGroup[section.id] : [];
			return { ...section, ...weJpCareerBuild(section, { info, cellGet, hiddenList, isEra }) };
		}
		// the top: its rows as its options say
		if (section.type === 'basic') return { ...section, rowOptionalList: rowOptionalListBuild(section, cellGet) };
		// 最終学歴: cells reading the latest education of the profile, each a cell of the paper
		// ({id}:date, :school, :status, :degree) that a paper may say otherwise
		if (section.type === 'education') {
			const list = String(section.list || 'edu');
			const last = cvJpEducationLastGet(info, list);
			const item = last?.itemPath ?? `${list}/latest`;
			const date = last?.datePath ?? `${item}/end`;
			return {
				...section,
				educationPath: last?.itemPath ?? '',
				cellDate: cellGet(`${section.id}:date`, `{{${date}/year}}年{{${date}/month}}月`),
				cellSchool: cellGet(`${section.id}:school`, `{{${item}/school/jp}}`),
				cellStatus: cellGet(`${section.id}:status`, `{{${item}/status}}`),
				cellDegree: cellGet(`${section.id}:degree`, `{{${item}/degree/jp}}`),
			};
		}
		return section;
	});
	// the optional rows of the top of a CV (of the first top drawn, else the first): what More fields
	// offers to type; none for a form without that top
	const basicFirst = sectionList.find((section) => section.type === 'basic' && !section.isHidden) ?? sectionList.find((section) => section.type === 'basic');
	const rowOptionalList = basicFirst?.rowOptionalList ?? [];
	return { sectionList, cellGet, rowOptionalList, isEra };
}

export function cvJpGenderIs(text, gender) {
	const value = String(text ?? '').trim().toLowerCase();
	return gender === 'male' ? ['male', 'm', '男', '男性'].includes(value) : ['female', 'f', '女', '女性'].includes(value);
}

