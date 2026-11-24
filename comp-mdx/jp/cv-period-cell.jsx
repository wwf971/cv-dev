import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { CalendarRange } from 'lucide-react';
import { cellTokenDefine, EditValueInline, slashActionDefine, slashEffect } from '@wwf971/react-doc';
import { cvProfileValueWrite } from '../profile/cv-profile-value.js';
import { CvSaveCancel, useCvValueEdit } from '../profile/cv-value-edit.jsx';
import { CV_PERIOD_NOW, CV_PERIOD_SIGIL, cvPeriodRead, cvPeriodResolve, cvPeriodSlashItemListGet } from '../query/CvQuery.js';
import { CvJpEraYear } from './cv-era-cell.jsx';

// A period as a token kind of a sheet's cells (doc/cv-sheet.md#a-period): the sheet's fourth kind
// in react-doc's cell editing kit (react-doc: main/doc_page_impl_edit_cell.md), beside the query,
// the badge and the year with its era. It is how a period is drawn wherever a text is typed, and
// what the career of a work experience draws its own periods with (doc/we-jp.md):
//
//   written   {{period:work/sample-systems}}    a folder of the profile holding start and end
//             {{period:edu/x/start~edu/x/end}}  two dates of the profile
//             {{period:2026/5~2026/10}}         dates written out; {{period:2026/5~}}: to the present
//             after "|": era, each year with its Japanese era above it
//   drawn     its start, a short vertical line under it, its end (or 現在) under that: the years
//             one under the other, the months ending at one edge. as plain text, start〜end
//   typed     with /period (or /range), or by typing "{{period:": a period typed, or a folder of
//             the profile with a start chosen
//
//   its card  marked in the text typed: the dates of the profile it reads, a number a field (its
//             year and month of start and end), kept there at once for every paper of the partition
//
// context (the cell's, kept current by the sheet): { info, dateNow, isEra, profileAccess }

// one date of a period: its year (with its era above it), 年, its month, 月; a year alone has no month
function CvJpPeriodDate({ date, isEra }) {
	return (
		<>
			<span className="doc-cv-period-year">{isEra ? <CvJpEraYear year={date.year} era={date.era} /> : date.year}</span>
			<span>年</span>
			<span className="doc-cv-period-month">{date.month}</span>
			<span>{date.month !== '' ? '月' : ''}</span>
		</>
	);
}

// a period drawn (resolved: cvPeriodResolve): nothing when it has no date at all
export function CvJpPeriod({ resolved, isEra = false }) {
	if (!resolved || resolved.isTimeless) return null;
	return (
		<span className="doc-cv-period">
			{resolved.start.status === 'found' ? <CvJpPeriodDate date={resolved.start} isEra={isEra} /> : null}
			{/* what a 〜 says in a line, between two dates standing one under the other: a short line from
			    the one down to the other (a 〜 turned upright reads as a scribble at this size) */}
			<span className="doc-cv-period-mark" role="img" aria-label="〜" />
			{resolved.isNow ? <span className="doc-cv-period-now">{CV_PERIOD_NOW}</span> : <CvJpPeriodDate date={resolved.end} isEra={isEra} />}
		</span>
	);
}

export const cvPeriodSlashAction = slashActionDefine({
	name: 'period',
	aliasList: ['range'],
	label: 'Period',
	description: 'a period, its start over a vertical line over its end: one typed, or a folder of the profile with a start',
	icon: CalendarRange,
	param: {
		placeholder: 'a period (2026/5~2026/10, 2026/5~ for one going on), or a folder of the profile: work/…, edu/…',
		emptyText: 'Type a start of four digits, or a part of the path of a folder of the profile holding a start',
		itemListGet: (param, context) => cvPeriodSlashItemListGet(context.info, param),
		// the years with their era above them where the paper writes its years so
		itemChoose: (item, param, context) => slashEffect.replace(`{{${CV_PERIOD_SIGIL}${item.body}${context.isEra ? '|era' : ''}}}`),
	},
});

const CvPeriodRender = observer(function CvPeriodRender({ token, cell }) {
	return <CvJpPeriod resolved={cvPeriodResolve(cell.context.info, token.data, { dateNow: cell.context.dateNow })} isEra={Boolean(token.param.era)} />;
});

// the card of a period marked in the text typed: its dates the profile holds, each number typed in
// place and kept there (a year, a month: numbers); an end emptied is 現在. dates written out in the
// token are typed in the text itself
const CvPeriodCard = observer(function CvPeriodCard({ token, cell }) {
	const [write, writeSet] = useState({ status: 'idle', message: '' });
	// Save and Cancel act on the number being typed, as Enter and Esc do
	const edit = useCvValueEdit();
	const access = cell.context.profileAccess ?? {};
	const { info, dateNow } = cell.context;
	const period = token.data;
	const resolved = cvPeriodResolve(info, period, { dateNow });
	const dateList = [
		...(period.start?.kind === 'path' ? [{ label: 'Start', path: period.start.path, date: resolved.start }] : []),
		...(period.end?.kind === 'path' ? [{ label: 'End', path: period.end.path, date: resolved.end, hint: resolved.isNow ? 'none: 現在' : 'empty its year for 現在' }] : []),
	];
	if (dateList.length === 0) return <p className="doc-note doc-cv-value-panel-note">Its dates are written in the text: typed there ({'{{period:2026/5~2026/10}}'}).</p>;
	const isEditable = access.isEditable === true && Boolean(access.profile) && write.status !== 'writing';
	const partitionLabel = (access.profile?.partitionList ?? []).find((one) => one.id === access.partition)?.label || access.partition || '(none)';
	const numberWrite = async (path, text) => {
		writeSet({ status: 'writing', message: '' });
		const result = await cvProfileValueWrite(access.profile, info, path, text, access.partition, { isNumber: true });
		writeSet(result?.code === 0 || result?.code === undefined ? { status: 'idle', message: '' } : { status: 'error', message: result?.message || 'it could not be written' });
	};
	const numberField = (one, part) => (isEditable
		? <EditValueInline className="doc-cv-value-panel-number" value={String(one.date[part] ?? '')} placeholder={part} aria-label={`${one.label}: its ${part}`} onCommit={(text) => numberWrite(`${one.path}/${part}`, text)} {...edit.bind(`${one.label}:${part}`, one.date[part] ?? '')} />
		: <span className="doc-cv-value-panel-number" data-readonly="">{one.date[part] ?? ''}</span>);
	return (
		<div className="doc-cv-value-panel">
			{dateList.map((one) => (
				<div key={one.label} className="doc-cv-value-panel-part">
					<span className="doc-cv-value-panel-part-path" title={one.path}>{one.label}</span>
					<span className="doc-cv-value-panel-date">
						{numberField(one, 'year')}<span>年</span>{numberField(one, 'month')}<span>月</span>
						{one.hint ? <span className="doc-cv-list-muted">{one.hint}</span> : null}
					</span>
				</div>
			))}
			{access.isEditable === true && access.profile ? <div className="doc-cv-value-panel-actions"><CvSaveCancel edit={edit} saveTitle="Keep it in the profile (Enter)" /></div> : null}
			{write.status === 'error' ? <p className="doc-error doc-cv-value-panel-note" role="alert">{write.message}</p> : null}
			<p className="doc-cv-list-muted doc-cv-value-panel-where">
				{isEditable || write.status === 'writing'
					? `In the profile, partition ${partitionLabel}: saved there, for every paper of it.`
					: `In the profile, partition ${partitionLabel}.${access.editUnavailableReason ? ` Not changed here: ${access.editUnavailableReason}.` : ''}`}
			</p>
		</div>
	);
});

export const cvPeriodToken = cellTokenDefine({
	name: 'period',
	label: 'Period',
	description: 'a period, its start over a vertical line over its end: {{period:work/sample-systems}}, {{period:2026/5~2026/10}}',
	brace: { sigil: CV_PERIOD_SIGIL },
	read: (body) => cvPeriodRead(body),
	textGet: (token, cell) => cvPeriodResolve(cell.context.info, token.data, { dateNow: cell.context.dateNow }).text,
	Render: CvPeriodRender,
	slashAction: cvPeriodSlashAction,
	Card: CvPeriodCard,
	cardPlaceList: ['surface'],
});
