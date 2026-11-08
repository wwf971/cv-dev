import { CV_JP_PAGE_SPEC, cvJpHistorySplit, cvJpPieceListGet, cvJpTextSplit } from './CvJpPaginationData.js';
import { CV_JP_STORE_READ, CvJpBasic, CvJpHistory, CvJpText } from './CvJpSection.jsx';

// The Japanese-style CV on pages (doc/cv-jp.md#pages): its pagination contract, which the
// mode sheet declares in the registry (expose.pagination) and hands to react-doc's PageFlow
// (react-doc: main/doc_page_impl_pagination.md). The flow of a CV is its sections, in order:
//
//   basic     the top of the form: title, name, birth, address, contacts, photo; never cut
//   history   a table of 年, 月 and the text: cut between rows; each part has the head of
//             the table, a part cut below is drawn to the bottom of its page
//   text      a section of text (the motivation): cut between lines of its text
//
// The data of a piece is plain and already resolved (texts read from the profile), so the
// pieces draw without the profile, and a cut is a cut of the data.

// ---------- the pieces drawn ----------

function BasicPiece({ data }) {
	const sheet = { cellGet: (id) => data.cellById[id] ?? { id, text: '', raw: '', missingList: [] }, rowOptionalList: data.rowOptionalList };
	return <CvJpBasic sheet={sheet} store={CV_JP_STORE_READ} />;
}

function HistoryPiece({ data, layout }) {
	return <CvJpHistory section={data} store={CV_JP_STORE_READ} fillHeight={layout?.fillHeight ?? 0} />;
}

function TextPiece({ data, layout }) {
	const section = { title: data.title, isContinued: data.isContinued, isCutBelow: data.isCutBelow, cell: { id: data.id, text: data.text, raw: '', missingList: [] } };
	return <CvJpText section={section} store={CV_JP_STORE_READ} fillHeight={layout?.fillHeight ?? 0} />;
}

export const cvJpPagination = {
	pageSpec: CV_JP_PAGE_SPEC,
	pageClassName: 'doc-cv-jp-paper doc-cv-jp-page',
	pieceListGet: cvJpPieceListGet,
	pieceTypeById: {
		basic: { Render: BasicPiece },
		history: { Render: HistoryPiece, split: cvJpHistorySplit, isFilledOnSplit: true },
		text: { Render: TextPiece, split: cvJpTextSplit, isFilledOnSplit: true },
	},
};
