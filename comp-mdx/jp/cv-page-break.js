// Places a row of a history may be cut at, inside it, on pages (doc/cv-sheet.md#pages): after a
// badge of its text, so that a row of many badges in lines starts on one page and goes on on the
// next (CvJpPaginationData.js cvJpHistorySplit). The row gives its id to what is drawn in its text;
// a badge drawn there marks itself as a place to cut (data-page-break), named by the row and the
// offset in the row's text where the badge ends. Pure, so that the splits are tested in node; the
// context the row gives its id by is cv-page-break-context.js

const ROW_BREAK_SEPARATOR = '@';

export function cvJpRowBreakKey(rowId, offset) {
	return `${rowId}${ROW_BREAK_SEPARATOR}${offset}`;
}

// { rowId, offset } of a key of a place inside a row; undefined for any other key
export function cvJpRowBreakParse(key) {
	const text = String(key ?? '');
	const at = text.lastIndexOf(ROW_BREAK_SEPARATOR);
	if (at <= 0) return undefined;
	const offset = Number(text.slice(at + 1));
	return Number.isInteger(offset) && offset > 0 ? { rowId: text.slice(0, at), offset } : undefined;
}
