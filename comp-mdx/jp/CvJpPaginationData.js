import { paginationBreakLastFitting } from '@wwf971/react-doc/pagination';
import { CV_JP_CELL_DEFAULT, CV_JP_ROW_OPTIONAL_LIST } from './CvJpData.js';
import { cvJpRowBreakParse } from './cv-page-break.js';

// A sheet on pages, its pure part (doc/cv-sheet.md#pages): the flow of a paper and the cuts of its
// pieces, all data. The pieces' drawing and the contract are CvJpPagination.jsx.

// the page of a Japanese-style form: A4, the margins of the common form
export const CV_JP_PAGE_SPEC = Object.freeze({ width: 210, height: 297, margin: Object.freeze({ top: 9.5, right: 10.5, bottom: 10.5, left: 10.5 }) });

// px a part of a table takes under its last kept row: its bottom rule
const TABLE_BELOW = 2;
// px a part of a block takes under its last kept line: the padding and rule of its cell
const TEXT_BELOW = 11;

// a cell as a piece keeps it: what it says, nothing of where it comes from. raw: its text as
// written, so that a page draws its tokens as the sheet does (a link, a badge); text: its plain
// text, which also makes the piece another one when what a token reads has changed; textExpanded:
// its text with the queries read, cut into lines where the piece draws lines
function cellPlain(cell) {
	return { id: cell.id, text: cell.text, raw: cell.raw ?? '', textExpanded: cell.textExpanded ?? cell.text, align: cell.align ?? '', missingList: [] };
}

function periodPlain(period) {
	return { cell: cellPlain(period.cell) };
}

// the facts a page draws: those saying something that the paper does not leave out. a fact of
// an employer keeps its label as a cell too (labelCell), drawn as the sheet draws it
function factListPlain(factList) {
	return factList.filter((fact) => fact.isShown && !fact.isHidden).map((fact) => ({
		id: fact.id, label: fact.label, cell: cellPlain(fact.cell), ...(fact.labelCell ? { labelCell: cellPlain(fact.labelCell) } : {}),
	}));
}

// the flow of a drawn paper (context.sheet: cvJpSheetBuild's; context.form: its form, cvJpFormGet):
// its sections, without those it leaves out. every piece says the form it is drawn in (formKind),
// and the last one that it is (isLast): it keeps no margin under it, which would only send it
// to a page of its own when it fits the page but for that margin
export function cvJpPieceListGet(data, context) {
	const pieceList = cvJpPieceListBuild(context);
	if (pieceList.length > 0) pieceList[pieceList.length - 1].data.isLast = true;
	return pieceList;
}

function cvJpPieceListBuild(context) {
	const { sheet, form } = context ?? {};
	if (!sheet) return [];
	const formKind = form?.kind ?? '';
	return sheet.sectionList.filter((section) => !section.isHidden).map((section) => {
		const title = section.titleCell?.raw ?? section.title ?? '';
		if (section.type === 'basic') {
			const idList = [...Object.keys(CV_JP_CELL_DEFAULT), ...CV_JP_ROW_OPTIONAL_LIST.flatMap((row) => row.cellList.map((one) => one.id))];
			return {
				type: 'basic',
				data: {
					formKind,
					isPhoto: section.isPhoto !== false,
					widthKey: section.widthKey,
					widthEnd: section.widthEnd,
					cellById: Object.fromEntries([...new Set(idList)].map((id) => [id, cellPlain(sheet.cellGet(id))])),
					rowOptionalList: (section.rowOptionalList ?? sheet.rowOptionalList).map((row) => ({ id: row.id, isShown: row.isShown, cellList: row.cellList.map((one) => ({ id: one.id, label: one.label, cell: cellPlain(one.cell) })) })),
				},
			};
		}
		if (section.type === 'head') {
			return { type: 'head', data: { formKind, id: section.id, title, cellById: Object.fromEntries(['date', 'name-full'].map((id) => [id, cellPlain(sheet.cellGet(id))])) } };
		}
		if (section.type === 'closing') return { type: 'closing', data: { formKind, id: section.id, cell: cellPlain(section.cell) } };
		if (section.type === 'education') {
			return {
				type: 'education',
				data: {
					formKind, id: section.id, title, isDegree: section.isDegree !== false,
					titleCell: cellPlain(section.titleCell), cellDate: cellPlain(section.cellDate), cellSchool: cellPlain(section.cellSchool),
					cellStatus: cellPlain(section.cellStatus), cellDegree: cellPlain(section.cellDegree),
				},
			};
		}
		if (section.type === 'history') {
			return {
				type: 'history',
				data: {
					formKind,
					id: section.id,
					title,
					isNote: section.isNote === true,
					isEra: section.isEra !== false,
					groupList: section.groupList.map((group) => ({
						id: group.id,
						title: group.title ?? '',
						isNote: group.isNote === true,
						rowList: group.rowList.filter((row) => !row.isHidden).map((row) => ({ id: row.id, year: row.year, month: row.month, text: row.text, note: row.note })),
					})),
				},
			};
		}
		if (section.type === 'career') {
			return {
				type: 'career',
				data: {
					formKind,
					id: section.id,
					title,
					sideTitle: section.sideTitle,
					listText: section.listText,
					employerList: section.employerList.filter((employer) => !employer.isHidden).map((employer) => ({
						key: employer.key,
						period: periodPlain(employer.period),
						name: cellPlain(employer.name),
						employment: cellPlain(employer.employment),
						factList: factListPlain(employer.factList),
						projectList: employer.projectList.filter((project) => !project.isHidden).map((project) => ({
							key: project.key,
							ordinal: project.ordinal,
							period: periodPlain(project.period),
							title: cellPlain(project.title),
							summary: cellPlain(project.summary),
							factSideList: factListPlain(project.factSideList),
							factMainList: factListPlain(project.factMainList),
						})),
					})),
				},
			};
		}
		return {
			type: 'text',
			data: {
				formKind,
				id: section.id,
				title,
				heightMin: Number(section.heightMin) > 0 ? Number(section.heightMin) : 0,
				isIndent: section.isIndent === true,
				// index: the place of a line in the whole text, which a part of the block keeps
				lineList: (section.lineList ?? []).map((line, index) => ({ ...line, index })),
			},
		};
	});
}

// ---------- cuts ----------

// cut after the last row within space: the head keeps the rows up to it, the tail the rest, a
// group cut in two going on in the tail without its heading
export function cvJpHistorySplit(data, { space, measured }) {
	const foundRow = paginationBreakLastFitting({ breakList: (measured?.breakList ?? []).filter((one) => !cvJpRowBreakParse(one.key)) }, space, TABLE_BELOW);
	// the row after the last that fits, when it holds lines of badges: cut inside it, after its last
	// line within space, rather than leaving the space empty (a row of many badges)
	const inside = historyRowInsideCutGet(data, measured, space, foundRow?.key);
	if (inside) return historyRowInsideSplit(data, inside);
	const found = foundRow;
	if (!found) return null;
	const head = { ...data, isCutBelow: true, groupList: [] };
	const tail = { ...data, groupList: [] };
	let isCut = false;
	for (const group of data.groupList) {
		if (isCut) {
			tail.groupList.push(group);
			continue;
		}
		const at = found.key === `${group.id}-empty` ? 0 : group.rowList.findIndex((row) => row.id === found.key);
		if (at < 0) {
			head.groupList.push(group);
			continue;
		}
		isCut = true;
		const rowHead = found.key === `${group.id}-empty` ? [] : group.rowList.slice(0, at + 1);
		const rowTail = found.key === `${group.id}-empty` ? [] : group.rowList.slice(at + 1);
		head.groupList.push({ ...group, rowList: rowHead });
		if (rowTail.length > 0) tail.groupList.push({ ...group, rowList: rowTail, isContinued: true });
	}
	if (!isCut || tail.groupList.length === 0) return null;
	return { head, tail, breakKey: found.key };
}

// a cut inside the row after the last one fitting (rowIdBefore; none: the first row): after the last
// badge of its text ending a line, within space. a line ends where the next badge starts lower. none
// when the row has no such place, or when only its last badge fits (the row then goes whole)
function historyRowInsideCutGet(data, measured, space, rowIdBefore) {
	const rowList = data.groupList.flatMap((group) => group.rowList.map((row) => ({ group, row })));
	const at = rowIdBefore ? rowList.findIndex((one) => one.row.id === rowIdBefore) + 1 : 0;
	const next = rowList[at];
	if (!next) return undefined;
	const insideList = (measured?.breakList ?? []).filter((one) => cvJpRowBreakParse(one.key)?.rowId === next.row.id);
	let cut;
	insideList.forEach((one, index) => {
		const after = insideList[index + 1];
		const isLineEnd = Boolean(after) && after.top > one.top + 2;
		if (isLineEnd && one.bottom + TABLE_BELOW <= space + 0.5) cut = { ...next, key: one.key, offset: cvJpRowBreakParse(one.key).offset };
	});
	return cut;
}

// the head: the rows up to the row cut, and the row cut with its text up to the place; the tail: the
// row going on (its year, month and note not said again: they are the head's), then the rest
function historyRowInsideSplit(data, { group: groupCut, row: rowCut, key, offset }) {
	const text = String(rowCut.text ?? '');
	const head = { ...data, isCutBelow: true, groupList: [] };
	const tail = { ...data, groupList: [] };
	let isCut = false;
	for (const group of data.groupList) {
		if (isCut) {
			tail.groupList.push(group);
			continue;
		}
		if (group !== groupCut) {
			head.groupList.push(group);
			continue;
		}
		isCut = true;
		const at = group.rowList.indexOf(rowCut);
		// isCutInside: it goes on on the next page, so the rules drawn under it to the bottom of the page
		// are its own (no rule between it and them)
		head.groupList.push({ ...group, rowList: [...group.rowList.slice(0, at), { ...rowCut, text: text.slice(0, offset).trimEnd(), isCutInside: true }] });
		const rowGoingOn = { ...rowCut, year: '', month: '', note: '', text: text.slice(offset).replace(/^\s+/, ''), isContinued: true };
		tail.groupList.push({ ...group, rowList: [rowGoingOn, ...group.rowList.slice(at + 1)], isContinued: true });
	}
	return { head, tail, breakKey: key };
}

// a career cut after the last project within space (an employer without a project is a place to
// cut too): the head keeps the rows up to it, the tail the rest, an employer cut in two going on in
// the tail without its line. isEmployerCut: the head ends inside an employer, whose band then
// runs on to the bottom of the page
export function weJpCareerSplit(data, { space, measured }) {
	const found = paginationBreakLastFitting(measured, space, TABLE_BELOW);
	if (!found) return null;
	const head = { ...data, isCutBelow: true, employerList: [] };
	const tail = { ...data, employerList: [] };
	let isCut = false;
	for (const employer of data.employerList) {
		if (isCut) {
			tail.employerList.push(employer);
			continue;
		}
		const at = employer.projectList.findIndex((project) => project.key === found.key);
		if (at < 0) {
			head.employerList.push(employer);
			isCut = found.key === employer.key;
			continue;
		}
		isCut = true;
		head.employerList.push({ ...employer, projectList: employer.projectList.slice(0, at + 1) });
		const projectTail = employer.projectList.slice(at + 1);
		head.isEmployerCut = projectTail.length > 0;
		if (projectTail.length > 0) tail.employerList.push({ ...employer, projectList: projectTail, isContinued: true });
	}
	if (!isCut || tail.employerList.length === 0) return null;
	return { head, tail, breakKey: found.key };
}

// the least a part of a block keeps, so that no page holds one stray line of it: two lines, or one
// line as tall as a few (a paragraph)
const TEXT_PART_LINE_MIN = 2;
const TEXT_PART_HEIGHT_MIN = 60;
// labels one under another are cut apart only when they are more than this many: fewer stay together
const TEXT_LABEL_RUN_MAX = 8;

// a block cut after the last of its lines within space: a line is what its author wrote as one (a
// paragraph, an item of a list), so a paragraph is never cut in two. the cut is moved up until
// both parts read well: a heading stays with what follows it, a short run of labels stays whole,
// neither part is one stray line, and the part going on does not start with an empty line
export function cvJpTextSplit(data, { space, measured }) {
	const { lineList } = data;
	const breakByKey = new Map((measured?.breakList ?? []).map((one) => [one.key, one]));
	const breakOf = (line) => breakByKey.get(`line-${line.index}`);
	const isFitting = (line) => {
		const one = breakOf(line);
		return Boolean(one) && one.bottom + TEXT_BELOW <= space + 0.5;
	};
	// a part reads well: enough lines, or enough height
	const partIsEnough = (partList) => {
		const drawnList = partList.filter((line) => line.kind !== 'blank' && breakOf(line));
		if (drawnList.length >= TEXT_PART_LINE_MIN) return true;
		return drawnList.length > 0 && breakOf(drawnList[drawnList.length - 1]).bottom - breakOf(drawnList[0]).top >= TEXT_PART_HEIGHT_MIN;
	};
	// the run of labels a line stands in: [first, last], or undefined
	const labelRunGet = (at) => {
		if (lineList[at]?.kind !== 'label') return undefined;
		let first = at;
		let last = at;
		while (first > 0 && lineList[first - 1].kind === 'label') first -= 1;
		while (last < lineList.length - 1 && lineList[last + 1].kind === 'label') last += 1;
		return [first, last];
	};
	let at = -1;
	lineList.forEach((line, index) => {
		if (isFitting(line)) at = index;
	});
	// the cut is after the line at; each rule may only move it up
	for (; at >= 0; at -= 1) {
		const line = lineList[at];
		if (line.kind === 'heading' || line.kind === 'blank') continue;
		const run = labelRunGet(at);
		if (run && at < run[1] && run[1] - run[0] < TEXT_LABEL_RUN_MAX) {
			at = run[0];
			continue;
		}
		let lineTail = lineList.slice(at + 1);
		while (lineTail.length > 0 && lineTail[0].kind === 'blank') lineTail = lineTail.slice(1);
		if (lineTail.length === 0) return null;
		if (!partIsEnough(lineTail)) continue;
		if (!partIsEnough(lineList.slice(0, at + 1))) return null;
		return {
			head: { ...data, lineList: lineList.slice(0, at + 1), isCutBelow: true },
			tail: { ...data, lineList: lineTail, isContinued: true },
			breakKey: `line-${line.index}`,
		};
	}
	return null;
}
