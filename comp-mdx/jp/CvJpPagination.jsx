import { CV_JP_PAGE_SPEC, cvJpHistorySplit, cvJpPieceListGet, cvJpTextSplit, weJpCareerSplit } from './CvJpPaginationData.js';
import { CV_JP_STORE_READ, CvJpBasic, CvJpClosing, CvJpEducation, CvJpHistory, CvJpText } from './CvJpSection.jsx';
import { WeJpCareer, WeJpHead } from './WeJpSection.jsx';

// A sheet on pages (doc/cv-sheet.md#pages): its pagination contract, which the mode sheet
// declares in the registry (expose.pagination) and hands to react-doc's PageFlow (react-doc:
// main/doc_page_impl_pagination.md). The flow of a paper is its sections, in order:
//
//   basic     the top of a CV: title, name, birth, address, contacts, photo; never cut
//   head      the top of a work experience: title, date, name; never cut
//   history   a table of 年, 月 and the text: cut between rows; each part has the head of
//             the table, a part cut below is drawn to the bottom of its page
//   career    the employers with their projects: cut between projects, as a history between rows
//   text      a block: cut between the lines of its text
//   closing   the line closing the paper; never cut
//
// The data of a piece is plain: a cut is a cut of the data. A cell, a row and a line keep their
// text as written beside its plain text, and are drawn with the cell of the sheet around the pages
// (CvJpEditContext), so a page shows a token as the sheet does: a link, a badge. Every piece
// stands in the class of its form, as the paper of the sheet does, so it is set the same.

// ---------- the pieces drawn ----------

function PieceBox({ data, children }) {
	return <div className={`doc-cv-jp-form-${data.formKind || 'cv'}`}>{children}</div>;
}

function BasicPiece({ data }) {
	const sheet = { cellGet: (id) => data.cellById[id] ?? { id, text: '', raw: '', missingList: [] }, rowOptionalList: data.rowOptionalList };
	return <PieceBox data={data}><CvJpBasic sheet={sheet} section={{ isPhoto: data.isPhoto !== false, rowOptionalList: data.rowOptionalList, widthKey: data.widthKey, widthEnd: data.widthEnd }} store={CV_JP_STORE_READ} /></PieceBox>;
}

function HeadPiece({ data }) {
	const sheet = { cellGet: (id) => data.cellById[id] ?? { id, text: '', raw: '', missingList: [] } };
	return <PieceBox data={data}><WeJpHead section={data} sheet={sheet} store={CV_JP_STORE_READ} /></PieceBox>;
}

function HistoryPiece({ data, layout }) {
	return <PieceBox data={data}><CvJpHistory section={data} store={CV_JP_STORE_READ} fillHeight={layout?.fillHeight ?? 0} /></PieceBox>;
}

function CareerPiece({ data, layout }) {
	return <PieceBox data={data}><WeJpCareer section={data} store={CV_JP_STORE_READ} fillHeight={layout?.fillHeight ?? 0} /></PieceBox>;
}

function TextPiece({ data, layout }) {
	// its cell holds no text of its own: the lines the piece keeps are what is drawn
	const section = { ...data, cell: { id: data.id, text: data.lineList.map((line) => line.text).join('\n'), raw: '', missingList: [] } };
	return <PieceBox data={data}><CvJpText section={section} store={CV_JP_STORE_READ} fillHeight={layout?.fillHeight ?? 0} /></PieceBox>;
}

function ClosingPiece({ data }) {
	return <PieceBox data={data}><CvJpClosing section={data} store={CV_JP_STORE_READ} /></PieceBox>;
}

function EducationPiece({ data }) {
	return <PieceBox data={data}><CvJpEducation section={data} store={CV_JP_STORE_READ} /></PieceBox>;
}

export const cvJpPagination = {
	pageSpec: CV_JP_PAGE_SPEC,
	pageClassName: 'doc-cv-jp-paper doc-cv-jp-page',
	pieceListGet: cvJpPieceListGet,
	pieceTypeById: {
		basic: { Render: BasicPiece },
		head: { Render: HeadPiece },
		history: { Render: HistoryPiece, split: cvJpHistorySplit, isFilledOnSplit: true },
		career: { Render: CareerPiece, split: weJpCareerSplit, isFilledOnSplit: true },
		text: { Render: TextPiece, split: cvJpTextSplit, isFilledOnSplit: true },
		closing: { Render: ClosingPiece },
		education: { Render: EducationPiece },
	},
};
