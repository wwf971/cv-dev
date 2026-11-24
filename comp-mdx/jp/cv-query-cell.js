import { createElement } from 'react';
import { Braces } from 'lucide-react';
import { cellTokenDefine, slashActionDefine, slashEffect } from '@wwf971/react-doc';
import { cvQueryResolve, cvQuerySlashItemListGet } from '../query/CvQuery.js';
import { CvProfileValuePanel } from '../profile/CvProfileValuePanel.jsx';

// The query path as a token kind of a CV's cells (doc/cv-sheet.md#editing-in-place): the CV's own
// part of react-doc's cell editing kit (react-doc: main/doc_page_impl_edit_cell.md). A cell of a
// CV is a cell of that layer: its text is words and tokens, and beside the kinds every cell of
// the page has (a link, a view of an object) it has this one, which reads the profile:
//
//   written   {{name/jp/first}}: a brace token without a sigil, so every such token of a
//             CV's cell is a query
//   drawn     as the value the query reads (nothing for a query nothing answers)
//   typed     with /query (or /q), or by typing "{{": a segment at a time
//   its card  marked in the text typed (a click on it, the caret coming to its edge): the value it
//             reads, typed in place and kept in the profile (CvProfileValuePanel, the same card a
//             token naming the value from another page has)
//
//   {{ or /query name/   the folders below name: jp/, en/, last/, first/ ...; one chosen goes on
//   name/jp/last/        the values there, each with what it reads: kanji 山田, hiragana やまだ
//   name/jp/last         the path itself first, when it reads a value: Enter writes {{name/jp/last}}
//
// context (the cell's, kept current by the sheet): { info, dateNow, profileAccess }: the information
// of the profile the CV reads, the date it is written at, and the profile itself to change a value
// (one object for the life of the sheet, its fields set at every render: { profile, partition,
// isEditable, editUnavailableReason })

export const cvQuerySlashAction = slashActionDefine({
	name: 'query',
	aliasList: ['q'],
	label: 'Query path',
	description: 'a value of the profile, written as {{path}}',
	icon: Braces,
	param: {
		placeholder: 'a path of the profile: name/, birth/, edu/ … (a folder goes on)',
		emptyText: 'Nothing of the profile is at this path',
		itemListGet: (param, context) => {
			// "{{/": no query starts so, but a badge does ({{/badge/aws/saa}}): the folder leading there
			if (param.startsWith('/')) return '/badge/'.startsWith(param) ? [{ id: 'dir:/badge/', kind: 'dir', label: 'badge/', detail: 'the badges of the profile', paramNext: '/badge/' }] : [];
			return context.info ? cvQuerySlashItemListGet(context.info, param, { dateNow: context.dateNow }) : [];
		},
		itemChoose: (item) => (item.kind === 'dir' ? slashEffect.paramSet(item.paramNext) : slashEffect.replace(`{{${item.query}}}`)),
	},
});

export const cvQueryToken = cellTokenDefine({
	name: 'query',
	label: 'Query path',
	description: 'a value of the profile the CV reads: {{name/jp/first}}',
	brace: { sigil: '' },
	read: (body) => ({ query: body }),
	textGet: (token, cell) => (cell.context.info ? cvQueryResolve(cell.context.info, token.data.query, { dateNow: cell.context.dateNow }).value : ''),
	slashAction: cvQuerySlashAction,
	Card: CvQueryCard,
	// drawn, a click on the value opens its cell: the card is offered while its text is typed
	cardPlaceList: ['surface'],
});

// close, widthSet: the card's own (react-doc's cell editing kit); the panel closes it after one simple
// value saved, and asks for a wide card when the value is a text
function CvQueryCard({ token, cell, close, widthSet }) {
	const access = cell.context.profileAccess ?? {};
	return createElement(CvProfileValuePanel, {
		profile: access.profile,
		partition: access.partition,
		query: token.data.query,
		isEditable: access.isEditable === true,
		editUnavailableReason: access.editUnavailableReason ?? '',
		dateNow: cell.context.dateNow,
		close,
		widthSet,
	});
}
