import { createElement } from 'react';
import { Braces, BadgePlus } from 'lucide-react';
import { cellTokenDefine, slashActionDefine, slashCommandItemListGet, slashEffect, slashParamCommandRead } from '@wwf971/react-doc';
import { cvQueryNewSlashItemListGet, cvQueryResolve, cvQuerySlashItemListGet, cvQueryVersionSet } from '../query/CvQuery.js';
import { CvProfileValuePanel } from '../profile/CvProfileValuePanel.jsx';

// The query path as a token kind of a CV's cells (doc/cv-sheet.md#editing-in-place): the CV's own
// part of react-doc's cell editing kit (react-doc: main/doc_page_impl_edit_cell.md). A cell of a
// CV is a cell of that layer: its text is words and tokens, and beside the kinds every cell of
// the page has (a link, a view of an object) it has this one, which reads the profile:
//
//   written   {{name/jp/first}}: a brace token without a sigil, so every such token of a
//             CV's cell is a query. {{pr/jp@2}}: the version 2 of that value, whatever its head is
//   drawn     as the value the query reads (nothing for a query nothing answers)
//   typed     with /query (or /q), or by typing "{{": a segment at a time; a value that does
//             not exist yet with /new (doc/cv-query.md#a-new-value-where-it-is-named)
//   its card  marked in the text typed (a click on it, the caret coming to its edge): the value it
//             reads, typed in place and kept in the profile, with its versions (CvProfileValuePanel,
//             the same card a token naming the value from another page has)
//
//   {{ or /query name/   the folders below name: jp/, en/, last/, first/ ...; one chosen goes on
//   name/jp/last/        the values there, each with what it reads: kanji 山田, hiragana やまだ
//   name/jp/last         the path itself first, when it reads a value: Enter writes {{name/jp/last}}
//   pr/jp@               the versions of that value: @head, @3, @2 ...; one chosen is read whatever
//                        the head becomes
//   hobby/jp             a path nothing holds: "+ hobby/jp, a new value": the token is written and
//                        its card opens, where the value is typed and added to the profile
//   name/jp//new         a command of the place (react-doc: main/doc_page_impl_edit_slash.md#commands-inside-a-path):
//                        /new goes on with name/jp/, to name a new value under it
//
// context (the cell's, kept current by the sheet): { info, dateNow, profileAccess }: the information
// of the profile the CV reads, the date it is written at, and the profile itself to change a value
// (one object for the life of the sheet, its fields set at every render: { profile, partition,
// isEditable, editUnavailableReason })

// the commands of a place of the profile, typed as "/" and a name where a segment would start
const CV_QUERY_COMMAND_LIST = [{ name: 'new', label: 'New value', description: 'a value that does not exist yet, named under this path' }];

// whether a value may be made from this cell now: the profile can be written
const isNewOfferedGet = (context) => context.profileAccess?.isEditable === true;

export const cvQueryNewSlashAction = slashActionDefine({
	name: 'new',
	aliasList: ['add'],
	label: 'New value',
	description: 'a value the profile does not hold yet: its path, then its value',
	icon: BadgePlus,
	param: {
		placeholder: 'the path of the new value: a folder to go on under, then its name (work/acme/jp/name)',
		emptyText: 'Type the name of the new value',
		itemListGet: (param, context) => {
			if (!context.info) return [];
			if (!isNewOfferedGet(context)) return [{ id: 'note:locked', kind: 'note', label: context.profileAccess?.editUnavailableReason || 'The profile cannot be written now', detail: '' }];
			return cvQueryNewSlashItemListGet(context.info, param, { dateNow: context.dateNow });
		},
		itemChoose: (item) => {
			if (item.kind === 'dir') return slashEffect.paramSet(item.paramNext);
			// the token written and marked: its card opens, where the value is typed and added
			if (item.kind === 'new') return slashEffect.replace(`{{${item.query}}}`, { isMarked: true });
			if (item.kind === 'query') return slashEffect.replace(`{{${item.query}}}`);
			return undefined;
		},
	},
});

export const cvQuerySlashAction = slashActionDefine({
	name: 'query',
	aliasList: ['q'],
	label: 'Query path',
	description: 'a value of the profile, written as {{path}}',
	icon: Braces,
	param: {
		placeholder: 'a path of the profile: name/, birth/, edu/ … (a folder goes on; a new path makes a value)',
		emptyText: 'Nothing of the profile is at this path',
		itemListGet: (param, context) => {
			// "/query /": no query starts so, but a badge does ({{/badge/aws/saa}}, whose own kind
			// "{{/" enters): the folder leading there
			const badgeItemList = param.startsWith('/') && '/badge/'.startsWith(param) ? [{ id: 'dir:/badge/', kind: 'dir', label: 'badge/', detail: 'the badges of the profile', paramNext: '/badge/' }] : [];
			// "/" where a segment would start: the commands of the place ("name/jp//new")
			const command = slashParamCommandRead(param);
			if (command) {
				const commandItemList = isNewOfferedGet(context) ? slashCommandItemListGet(CV_QUERY_COMMAND_LIST, command.query).map((item) => ({ ...item, base: command.base })) : [];
				return [...(command.base === '' ? badgeItemList : []), ...commandItemList];
			}
			if (param.startsWith('/')) return badgeItemList;
			return context.info ? cvQuerySlashItemListGet(context.info, param, { dateNow: context.dateNow }, 40, { isNewOffered: isNewOfferedGet(context) }) : [];
		},
		itemChoose: (item) => {
			if (item.kind === 'dir') return slashEffect.paramSet(item.paramNext);
			// a command of the place: /new goes on with the place walked so far
			if (item.kind === 'command') return slashEffect.actionSet(item.name, item.base);
			if (item.kind === 'new') return slashEffect.replace(`{{${item.query}}}`, { isMarked: true });
			return slashEffect.replace(`{{${item.query}}}`);
		},
	},
});

export const cvQueryToken = cellTokenDefine({
	name: 'query',
	label: 'Query path',
	description: 'a value of the profile the CV reads: {{name/jp/first}}',
	brace: { sigil: '' },
	read: (body) => ({ query: body }),
	textGet: (token, cell) => (cell.context.info ? cvQueryResolve(cell.context.info, token.data.query, { dateNow: cell.context.dateNow }).value : ''),
	// "{{" enters the first: the walk through the profile; /new makes a value of the same kind
	slashAction: [cvQuerySlashAction, cvQueryNewSlashAction],
	Card: CvQueryCard,
	// drawn, a click on the value opens its cell: the card is offered while its text is typed
	cardPlaceList: ['surface'],
});

// close, widthSet: the card's own (react-doc's cell editing kit); the panel closes it after one simple
// value saved, and asks for a wide card when the value is a text. tokenSet writes the token again:
// the panel pins the cell to a version, or lets it follow the head again. markedBy 'insert': the
// token was just written by /new or a new path, and the value is typed at once
function CvQueryCard({ token, cell, tokenSet, close, widthSet, markedBy }) {
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
		isFocusedInitial: markedBy === 'insert',
		// the version this place reads, changed where the token is written: none follows the head
		versionPinSet: (versionId) => tokenSet({ body: cvQueryVersionSet(token.data.query, versionId) }),
	});
}
