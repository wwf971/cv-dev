import { CV_JP_FORM_LIST, CV_KIND_TEMPLATE, cvJpFormGet } from './CvJpData.js';
import { cvPaperIsUnder } from './CvJpPaperTree.js';

// The table of the mode Papers (CvJpList.jsx, doc/cv-sheet.md#the-table-of-papers): its columns, the
// view an author sets (which columns, in which order, how wide, one line a row or wrapped), and its
// rows: a part for each form and one for the templates, each a heading row then its items.
//
// The view is a data item of the papers object, of the kind view (cv.jp.view in type.yaml), so it is
// kept with the object and read by every block showing its papers:
//
//   name: the table of papers
//   lineMode: wrap                 wrap: a cell's text breaks into lines; line: one line a row, cut
//   columnList:                    the order of the columns; a column left out is shown at the end
//     - { id: name, width: 180 }
//     - { id: partition, width: 110, isHidden: true }

export const CV_KIND_VIEW = 'view';
// where the view of the table is kept: in the first partition, tracked by git with the templates
export const CV_PAPER_VIEW_PATH = '/example/view/papers';
export const CV_PAPER_LINE_WRAP = 'wrap';
export const CV_PAPER_LINE_ONE = 'line';

// every column the table can show. name cannot be hidden: it is what opens a paper
export const CV_PAPER_COLUMN_LIST = [
	{ id: 'name', label: 'name', width: 170, minWidth: 90, isAlwaysShown: true },
	{ id: 'path', label: 'path', width: 160, minWidth: 70 },
	{ id: 'form', label: 'form', width: 72, minWidth: 56, isHiddenDefault: true },
	{ id: 'template', label: 'template', width: 160, minWidth: 70 },
	{ id: 'profile', label: 'profile', width: 160, minWidth: 70 },
	{ id: 'asOf', label: 'as of', width: 130, minWidth: 80 },
	{ id: 'partition', label: 'partition', width: 100, minWidth: 60, isHiddenDefault: true },
];
const CV_PAPER_COLUMN_BY_ID = new Map(CV_PAPER_COLUMN_LIST.map((column) => [column.id, column]));

export function cvPaperColumnGet(id) {
	return CV_PAPER_COLUMN_BY_ID.get(id);
}

// the view when none is kept: every column but those hidden by default, at its own width, wrapped
export function cvPaperViewDefaultGet() {
	return {
		lineMode: CV_PAPER_LINE_WRAP,
		columnList: CV_PAPER_COLUMN_LIST.map((column) => ({ id: column.id, width: column.width, ...(column.isHiddenDefault ? { isHidden: true } : {}) })),
	};
}

// a view as kept, read defensively: unknown columns and a second mention left out, a width under its
// column's least raised to it, a column the view does not name appended as its default; problemList
// says what was left out
export function cvPaperViewRead(data) {
	const view = cvPaperViewDefaultGet();
	const problemList = [];
	if (data === undefined || data === null) return { view, problemList };
	if (typeof data !== 'object' || Array.isArray(data)) return { view, problemList: ['the view of the table is not a mapping of keys: the default view is shown'] };
	if (data.lineMode !== undefined) {
		if ([CV_PAPER_LINE_WRAP, CV_PAPER_LINE_ONE].includes(data.lineMode)) view.lineMode = data.lineMode;
		else problemList.push(`lineMode ${JSON.stringify(data.lineMode)} is neither ${CV_PAPER_LINE_WRAP} nor ${CV_PAPER_LINE_ONE}`);
	}
	if (data.columnList !== undefined) {
		if (!Array.isArray(data.columnList)) {
			problemList.push('columnList is not a list: the default columns are shown');
		} else {
			const columnList = [];
			for (const entry of data.columnList) {
				const id = typeof entry === 'string' ? entry : entry?.id;
				const column = CV_PAPER_COLUMN_BY_ID.get(id);
				if (!column) { problemList.push(`the column ${JSON.stringify(id)} is no column of the table`); continue; }
				if (columnList.some((one) => one.id === id)) { problemList.push(`the column ${id} is named twice`); continue; }
				const width = Number(entry?.width);
				columnList.push({
					id,
					width: Number.isFinite(width) && width > 0 ? Math.max(column.minWidth, Math.round(width)) : column.width,
					...(entry?.isHidden === true && !column.isAlwaysShown ? { isHidden: true } : {}),
				});
			}
			for (const column of CV_PAPER_COLUMN_LIST) {
				if (!columnList.some((one) => one.id === column.id)) columnList.push({ id: column.id, width: column.width, ...(column.isHiddenDefault ? { isHidden: true } : {}) });
			}
			view.columnList = columnList;
		}
	}
	return { view, problemList };
}

// what is written as the data of the item: the view and its name
export function cvPaperViewDataBuild(view) {
	return {
		name: 'the table of papers',
		lineMode: view.lineMode,
		columnList: view.columnList.map((column) => ({ id: column.id, width: column.width, ...(column.isHidden ? { isHidden: true } : {}) })),
	};
}

export function cvPaperViewIsSame(a, b) {
	return JSON.stringify(cvPaperViewDataBuild(a)) === JSON.stringify(cvPaperViewDataBuild(b));
}

// the columns shown, in their order
export function cvPaperColumnShownList(view) {
	return view.columnList.filter((column) => !column.isHidden);
}

// ---------- changes of a view: each answers a new view ----------

export function cvPaperViewLineSet(view, lineMode) {
	return { ...view, lineMode };
}

export function cvPaperViewColumnShownSet(view, id, isShown) {
	if (!isShown && cvPaperColumnGet(id)?.isAlwaysShown) return view;
	return { ...view, columnList: view.columnList.map((column) => (column.id === id ? { id: column.id, width: column.width, ...(isShown ? {} : { isHidden: true }) } : column)) };
}

// a column moved by a step among all (shown or not): -1 earlier, +1 later
export function cvPaperViewColumnMove(view, id, step) {
	const index = view.columnList.findIndex((column) => column.id === id);
	const indexTo = index + step;
	if (index < 0 || indexTo < 0 || indexTo >= view.columnList.length) return view;
	const columnList = [...view.columnList];
	const [column] = columnList.splice(index, 1);
	columnList.splice(indexTo, 0, column);
	return { ...view, columnList };
}

// the order of the columns shown, as the header was dragged: those hidden keep their places
export function cvPaperViewShownOrderSet(view, idShownList) {
	const shownQueue = idShownList.filter((id) => view.columnList.some((column) => column.id === id && !column.isHidden));
	const columnList = view.columnList.map((column) => {
		if (column.isHidden) return column;
		const id = shownQueue.shift();
		return view.columnList.find((one) => one.id === id) ?? column;
	});
	return { ...view, columnList };
}

export function cvPaperViewWidthSet(view, widthById) {
	return {
		...view,
		columnList: view.columnList.map((column) => {
			const width = Number(widthById?.[column.id]);
			return Number.isFinite(width) && width > 0 ? { ...column, width: Math.max(cvPaperColumnGet(column.id).minWidth, Math.round(width)) } : column;
		}),
	};
}

// ---------- the rows ----------

// the words typed to find a paper by its name: every word in the name, letters as they are or not
export function cvPaperNameMatches(name, find) {
	const wordList = String(find ?? '').toLowerCase().split(/\s+/).filter(Boolean);
	const text = String(name ?? '').toLowerCase();
	return wordList.every((word) => text.includes(word));
}

// the parts of a place: a form's papers, then the templates. at the top and in a partition every
// part stands, an empty one saying so; in a folder only the parts it holds; while words are typed
// only the parts holding a match. rowList: a heading row, then a row per item
//   { id, kind: 'part', part }            part: { id, title, count, countAll, emptyText }
//   { id, kind: 'empty', text, partId }   a part holding nothing, saying so
//   { id, kind: 'paper' | 'template', asset, partId }
export function cvPaperRowListBuild({ paperList = [], templateList = [], place, find = '', nameOf = (asset) => asset.name }) {
	const isFolderOfAll = place.kind === 'root' || place.kind === 'partition';
	const isFinding = String(find).trim() !== '';
	const isUnder = (asset) => cvPaperIsUnder(asset.pathList?.[0], place.path);
	const partList = [
		...CV_JP_FORM_LIST.map((form) => ({ id: form.kind, title: form.labelPlural, emptyText: `No ${form.label} yet.`, kind: 'paper', assetList: paperList.filter((asset) => asset.kind === form.kind && isUnder(asset)) })),
		{ id: CV_KIND_TEMPLATE, title: 'Templates', emptyText: 'No template yet: the first paper of a form writes its standard one.', kind: 'template', assetList: templateList.filter(isUnder) },
	];
	const rowList = [];
	for (const part of partList) {
		const matchList = part.assetList.filter((asset) => !isFinding || cvPaperNameMatches(nameOf(asset), find));
		if (isFinding ? matchList.length === 0 : !isFolderOfAll && part.assetList.length === 0) continue;
		rowList.push({ id: `part:${part.id}`, kind: 'part', part: { id: part.id, title: part.title, count: matchList.length, countAll: part.assetList.length, emptyText: part.emptyText } });
		if (part.assetList.length === 0) rowList.push({ id: `empty:${part.id}`, kind: 'empty', text: part.emptyText, partId: part.id });
		for (const asset of matchList) rowList.push({ id: `asset:${asset.key}`, kind: part.kind, asset, partId: part.id });
	}
	return rowList;
}

// the form a row is of: a paper's kind, a template's form
export function cvPaperFormOf(row, formKindOfTemplate) {
	if (row.kind === 'paper') return cvJpFormGet(row.asset.kind);
	return cvJpFormGet(formKindOfTemplate);
}
