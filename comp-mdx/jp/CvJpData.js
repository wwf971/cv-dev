import { cvEntryListResolve, cvTextExpand } from '../query/CvQuery.js';

// The data of the Japanese-style CV, without its drawing (doc/cv-jp.md).
//
//   a template (kind template, /{partition}/template/{name})   the sections, and the text of every cell
//   an instance (kind instance, /{partition}/instance/{name})  a template, a profile, and what differs from the template
//
// A text of a cell is literal words, or holds queries of the profile in {{ }}. An instance
// overrides a cell with its own text, so both a hard-coded value and another query are one thing.

export const CV_KIND_TEMPLATE = 'template';
export const CV_KIND_INSTANCE = 'instance';

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
	nationality: '{{nationality/jp}}',
	github: '{{github}}',
	homepage: '{{homepage}}',
};

// the cells of a row shown only when one of them says something
export const CV_JP_ROW_OPTIONAL_LIST = [
	{ id: 'residence', cellList: [{ id: 'visa', label: '在留資格' }, { id: 'nationality', label: '本籍' }] },
	{ id: 'link', cellList: [{ id: 'github', label: 'GitHub ページ' }, { id: 'homepage', label: 'ホームページ' }] },
];

export const CV_JP_TEMPLATE_DEFAULT = {
	name: '履歴書',
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
		{ id: 'motivation', type: 'text', title: '志 望 の 動 機', text: '{{motivation/jp}}' },
	],
};

function mappingOf(value) {
	return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

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

export function cvJpTemplateRead(data) {
	const template = mappingOf(data);
	return {
		name: String(template.name ?? ''),
		sectionList: (Array.isArray(template.sectionList) ? template.sectionList : CV_JP_TEMPLATE_DEFAULT.sectionList).map(sectionRead),
		cellById: mappingOf(template.cellById),
	};
}

// what differs from the template:
//   valueByCell        { cellId: text }: this CV's own text of a cell
//   rowExtraByGroup    { groupId: [{ year, month, text, note }] }: rows only this CV has
//   rowHiddenByGroup   { groupId: [entryId] }: entries of the profile this CV leaves out
//   rowOrderByGroup    { groupId: [rowId] }: the order of the rows, when it is not the order of time
export function cvJpInstanceRead(data) {
	const instance = mappingOf(data);
	return {
		name: String(instance.name ?? ''),
		template: String(instance.template ?? ''),
		profile: String(instance.profile ?? ''),
		asOf: String(instance.asOf ?? ''),
		valueByCell: mappingOf(instance.valueByCell),
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

// the text a cell is drawn from, and where that text is said
export function cvJpCellRawGet(cellId, template, instance, section) {
	if (instance.valueByCell[cellId] !== undefined) return { raw: String(instance.valueByCell[cellId] ?? ''), source: 'instance' };
	if (template.cellById[cellId] !== undefined) return { raw: String(template.cellById[cellId] ?? ''), source: 'template' };
	if (section?.text !== undefined) return { raw: String(section.text), source: 'template' };
	return { raw: CV_JP_CELL_DEFAULT[cellId] ?? '', source: 'default' };
}

export function cvJpCellGet(cellId, template, instance, info, context, section) {
	const { raw, source } = cvJpCellRawGet(cellId, template, instance, section);
	return { id: cellId, raw, source, isOverride: source === 'instance', ...cvTextExpand(info, raw, context) };
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

// the CV to draw: the sections, every cell with its text and queries resolved
export function cvJpSheetBuild({ template, instance, info, context }) {
	const cellGet = (cellId, section) => cvJpCellGet(cellId, template, instance, info, context, section);
	const sectionList = template.sectionList.map((section) => {
		if (section.type === 'history') {
			return { ...section, groupList: section.groupList.map((group) => ({ ...group, rowList: cvJpRowListBuild(group, instance, info), isOrderOwn: cvJpRowOrderIsOwn(group, instance) })) };
		}
		if (section.type === 'text') return { ...section, cell: cellGet(section.id, section) };
		return section;
	});
	const rowOptionalList = CV_JP_ROW_OPTIONAL_LIST.map((row) => {
		const cellList = row.cellList.map((one) => ({ ...one, cell: cellGet(one.id) }));
		return { ...row, cellList, isShown: cellList.some((one) => one.cell.text !== '') };
	});
	return { sectionList, cellGet, rowOptionalList };
}

export function cvJpGenderIs(text, gender) {
	const value = String(text ?? '').trim().toLowerCase();
	return gender === 'male' ? ['male', 'm', '男', '男性'].includes(value) : ['female', 'f', '女', '女性'].includes(value);
}

