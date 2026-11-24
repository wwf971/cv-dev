import { observer } from 'mobx-react-lite';
import { CalendarDays } from 'lucide-react';
import { cellTokenDefine, slashActionDefine, slashEffect } from '@wwf971/react-doc';
import { CV_ERA_SIGIL, cvEraRead, cvEraResolve, cvEraSlashItemListGet } from '../query/CvQuery.js';

// A year with its Japanese era above it, as a token kind of a sheet's cells (doc/cv-sheet.md
// #a-year-with-its-era): the sheet's third kind in react-doc's cell editing kit (react-doc:
// main/doc_page_impl_edit_cell.md), beside the query and the badge. It is how an era is drawn
// anywhere a text is typed, a cell, a row, a line of a block, not only where a form has a place
// for one:
//
//   written   {{era:2019/5}}             a year written out; its month decides the era (令和元)
//             {{era:birth}}              a date of the profile, a mapping with a year: the cell
//             {{era:edu/bachelor/start}} holding it alone is one query of that year, so the
//                                        year is changed in the profile from its card
//   drawn     the era in small type over the year: 平成12 over 2000. what follows (年, 月) is
//             the text's own
//   typed     with /era (or /nengo), or by typing "{{era:": a year typed, or a date of the
//             profile chosen
//
// context (the cell's, kept current by the sheet): { info, dateNow }

// the year with its era above it: the box stands on the line by its year, so a text around it
// keeps its line, and the era rises above it
export function CvJpEraYear({ year, era }) {
	return (
		<span className="doc-cv-era-year">
			<span className="doc-cv-era-year-era">{era}</span>
			<span className="doc-cv-era-year-year">{year}</span>
		</span>
	);
}

export const cvEraSlashAction = slashActionDefine({
	name: 'era',
	aliasList: ['nengo'],
	label: 'Year with its era',
	description: 'a year with its Japanese era above it: one typed, or a date of the profile',
	icon: CalendarDays,
	param: {
		placeholder: 'a year (2019, 2019/5), or a date of the profile: birth, edu/…',
		emptyText: 'Type a year of four digits, or a part of the path of a date of the profile',
		itemListGet: (param, context) => cvEraSlashItemListGet(context.info, param),
		itemChoose: (item) => slashEffect.replace(`{{${CV_ERA_SIGIL}${item.body}}}`),
	},
});

const CvEraRender = observer(function CvEraRender({ token, cell }) {
	const resolved = cvEraResolve(cell.context.info, token.data, { dateNow: cell.context.dateNow });
	if (resolved.status !== 'found') return null;
	return <CvJpEraYear year={resolved.year} era={resolved.era} />;
});

export const cvEraToken = cellTokenDefine({
	name: 'era',
	label: 'Year with its era',
	description: 'a year with its Japanese era above it: {{era:2019/5}}, {{era:birth}}',
	brace: { sigil: CV_ERA_SIGIL },
	read: (body) => cvEraRead(body),
	textGet: (token, cell) => cvEraResolve(cell.context.info, token.data, { dateNow: cell.context.dateNow }).year,
	Render: CvEraRender,
	slashAction: cvEraSlashAction,
});
