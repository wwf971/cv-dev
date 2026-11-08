import { Braces } from 'lucide-react';
import { slashActionDefine, slashEffect } from '@wwf971/react-doc';
import { cvQuerySlashItemListGet } from '../query/CvQuery.js';

// /query: a value of the profile written into a cell as a query path, chosen a segment at a time
// (doc/cv-jp.md#editing-in-place). It is the cell's own slash action, handed to the surface of the
// cell with useEditSlashConfig (react-doc: main/doc_page_impl_edit_slash.md), so it is offered in
// a CV's cells and nowhere else, and the page's actions (/link) are not offered there.
//
//   /query name/          the folders below name: jp/, en/, last/, first/ ...; one chosen goes on
//   /query name/jp/last/  the values there, each with what it reads: kanji 山田, hiragana やまだ
//   /q name/jp/last       the path itself first, when it reads a value: Enter writes {{name/jp/last}}
//
// context: { info, dateNow }: the information of the profile the CV reads, and the date it is written at
export const cvQuerySlashAction = slashActionDefine({
	name: 'query',
	aliasList: ['q'],
	label: 'Query path',
	description: 'a value of the profile, written as {{path}}',
	icon: Braces,
	param: {
		placeholder: 'a path of the profile: name/, birth/, edu/ … (a folder goes on)',
		emptyText: 'Nothing of the profile is at this path',
		itemListGet: (param, context) => cvQuerySlashItemListGet(context.info, param, { dateNow: context.dateNow }),
		itemChoose: (item) => (item.kind === 'dir' ? slashEffect.paramSet(item.paramNext) : slashEffect.replace(`{{${item.query}}}`)),
	},
});
