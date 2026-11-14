import { Braces } from 'lucide-react';
import { cellTokenDefine, slashActionDefine, slashEffect } from '@wwf971/react-doc';
import { cvQueryResolve, cvQuerySlashItemListGet } from '../query/CvQuery.js';

// The query path as a token kind of a CV's cells (doc/cv-jp.md#editing-in-place): the CV's own
// part of react-doc's cell edit layer (react-doc: main/doc_page_impl_edit_cell.md). A cell of a
// CV is a cell of that layer: its text is words and tokens, and beside the kinds every cell of
// the page has (a link, a view of an object) it has this one, which reads the profile:
//
//   written   {{name/jp/first}}: a brace token without a sigil, so every such token of a
//             CV's cell is a query
//   drawn     as the value the query reads (nothing for a query nothing answers)
//   typed     with /query (or /q), or by typing "{{": a segment at a time
//
//   {{ or /query name/   the folders below name: jp/, en/, last/, first/ ...; one chosen goes on
//   name/jp/last/        the values there, each with what it reads: kanji 山田, hiragana やまだ
//   name/jp/last         the path itself first, when it reads a value: Enter writes {{name/jp/last}}
//
// context (the cell's, kept current by the sheet): { info, dateNow }: the information of the
// profile the CV reads, and the date it is written at

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
});
