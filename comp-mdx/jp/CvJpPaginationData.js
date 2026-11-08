import { paginationBreakLastFitting, paginationTextCutGet } from '@wwf971/react-doc/pagination';
import { CV_JP_CELL_DEFAULT, CV_JP_ROW_OPTIONAL_LIST } from './CvJpData.js';

// The Japanese-style CV on pages, its pure part (doc/cv-jp.md#pages): the flow of a CV and the
// cuts of its pieces, all data. The pieces' drawing and the contract are CvJpPagination.jsx.

// the page of a Japanese-style CV: A4, the margins of the common form
export const CV_JP_PAGE_SPEC = Object.freeze({ width: 210, height: 297, margin: Object.freeze({ top: 9.5, right: 10.5, bottom: 10.5, left: 10.5 }) });

// px a part of a table takes under its last kept row: its bottom rule
const TABLE_BELOW = 2;
// px a part of a text takes under its last kept line: the padding and rule of its cell
const TEXT_BELOW = 9;

// a cell as a piece keeps it: what it says, nothing of where it comes from
function cellPlain(cell) {
	return { id: cell.id, text: cell.text, raw: '', missingList: [] };
}

// the flow of a drawn CV (context.sheet: cvJpSheetBuild's)
export function cvJpPieceListGet(data, context) {
	const { sheet } = context ?? {};
	if (!sheet) return [];
	return sheet.sectionList.map((section) => {
		if (section.type === 'basic') {
			const idList = [...Object.keys(CV_JP_CELL_DEFAULT), ...CV_JP_ROW_OPTIONAL_LIST.flatMap((row) => row.cellList.map((one) => one.id))];
			return {
				type: 'basic',
				data: {
					cellById: Object.fromEntries([...new Set(idList)].map((id) => [id, cellPlain(sheet.cellGet(id))])),
					rowOptionalList: sheet.rowOptionalList.map((row) => ({ id: row.id, isShown: row.isShown, cellList: row.cellList.map((one) => ({ id: one.id, label: one.label, cell: cellPlain(one.cell) })) })),
				},
			};
		}
		if (section.type === 'history') {
			return {
				type: 'history',
				data: {
					id: section.id,
					title: section.title ?? '',
					isNote: section.isNote === true,
					groupList: section.groupList.map((group) => ({
						id: group.id,
						title: group.title ?? '',
						isNote: group.isNote === true,
						rowList: group.rowList.filter((row) => !row.isHidden).map((row) => ({ id: row.id, year: row.year, month: row.month, text: row.text, note: row.note })),
					})),
				},
			};
		}
		return { type: 'text', data: { id: section.id, title: section.title ?? '', text: section.cell?.text ?? '' } };
	});
}

// ---------- cuts ----------

// cut after the last row within space: the head keeps the rows up to it, the tail the rest, a
// group cut in two going on in the tail without its heading
export function cvJpHistorySplit(data, { space, measured }) {
	const found = paginationBreakLastFitting(measured, space, TABLE_BELOW);
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

// cut after the last line within space; the part going on starts at the next line
export function cvJpTextSplit(data, { space, measured }) {
	const cut = paginationTextCutGet(measured, 'text', space, TEXT_BELOW);
	if (!cut) return null;
	const textHead = data.text.slice(0, cut.offset).replace(/\n$/, '');
	const textTail = data.text.slice(cut.offset).replace(/^\n/, '');
	if (!textHead || !textTail) return null;
	return { head: { ...data, text: textHead, isCutBelow: true }, tail: { ...data, text: textTail, isContinued: true }, breakKey: `@${cut.offset}` };
}

