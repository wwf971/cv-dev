import { useContext } from 'react';
import { observer } from 'mobx-react-lite';
import { EyeOff, Plus, Trash2 } from 'lucide-react';
import { CvJpCell, CvJpEditContext, CvJpLineList, cvJpCellLineListGet, cvJpTitleCellGet } from './CvJpSection.jsx';
import './CvJp.css';
import './WeJp.css';

// The sections of a Japanese-style work experience that are its own (doc/we-jp.md): its head (the
// title, the date, the name) and its career (the employers of the profile with their projects).
// Its other sections, blocks and history tables, are those of the sheet (CvJpSection.jsx). Every
// value is a cell of the sheet (CvJpCell), so it is typed in place, overridden in one paper and
// saved to the profile as a cell of a CV is.

// the top of the form: the title in the middle, then the date and the name at the right
export const WeJpHead = observer(function WeJpHead({ section, sheet, store }) {
	const cell = sheet.cellGet;
	return (
		<div className="doc-we-jp-head">
			<CvJpCell as="div" cell={cvJpTitleCellGet(section)} store={store} className="doc-we-jp-title" isOptional placeholder="タイトル" />
			<div className="doc-we-jp-head-meta">
				<CvJpCell as="div" cell={cell('date')} store={store} className="doc-we-jp-date" />
				<div className="doc-we-jp-name">
					<span className="doc-we-jp-name-label">氏名</span>
					<CvJpCell cell={cell('name-full')} store={store} className="doc-we-jp-name-value" />
				</div>
			</div>
		</div>
	);
});

// a period: one cell whose text is the token of its folder in the profile ({{period:work/x}},
// cv-period-cell.jsx), drawn as its start over a vertical line over its end, or 現在 while it has
// none. A click opens the cell; its card holds the four numbers of the profile. Something without
// a date (other work of an employer) draws nothing; while the sheet is edited its place is there
const WeJpPeriod = observer(function WeJpPeriod({ period, store }) {
	return <CvJpCell as="div" cell={period.cell} store={store} className="doc-we-jp-period" isOptional placeholder="期間" />;
});

// a fact with its label: drawn when it says something; while the sheet is edited an empty one is
// drawn too, so that it can be typed. one the paper leaves out is drawn in neither
function factListShownGet(factList, store) {
	return factList.filter((fact) => !fact.isHidden && (fact.isShown !== false || store.isEditing));
}

// what a fact of an employer offers while the sheet is edited, over its corner when the pointer
// is on it, so that nothing of the line moves for it: leaving it out of this paper (More fields
// draws it again), and taking it out of the profile, for every paper
const WeJpFactTool = observer(function WeJpFactTool({ section, fact }) {
	const edit = useContext(CvJpEditContext);
	const name = fact.label || 'entry';
	return (
		<span className="doc-we-jp-fact-tool" data-cv-jp-editor="">
			<button type="button" className="doc-we-jp-fact-button" title={`Leave ${name} out of this paper; the profile keeps it, and More fields draws it again`} aria-label={`Leave ${name} out of this paper`} onClick={(event) => { event.stopPropagation(); edit?.careerItemHiddenSet(section, fact.key, true); }}>
				<EyeOff size={12} aria-hidden="true" />
			</button>
			<button type="button" className="doc-we-jp-fact-button" data-danger="" disabled={!edit?.isProfileEditable} title={edit?.isProfileEditable ? `Remove ${name} from the profile: from every paper` : edit?.profileUnavailableReason} aria-label={`Remove ${name} from the profile`} onClick={(event) => { event.stopPropagation(); edit?.careerFactRemove(fact); }}>
				<Trash2 size={12} aria-hidden="true" />
			</button>
		</span>
	);
});

// what floats beside a row while the sheet is edited, in the margin of the paper: leaving the
// employer or the project out of this paper
const WeJpItemHide = observer(function WeJpItemHide({ section, item, label }) {
	const edit = useContext(CvJpEditContext);
	return (
		<button type="button" className="doc-we-jp-item-hide" title={`Leave this ${label} out of this paper; the profile keeps it, and More fields draws it again`} aria-label={`Leave this ${label} out of this paper`} onClick={(event) => { event.stopPropagation(); edit?.careerItemHiddenSet(section, item.key, true); }}>
			<EyeOff size={13} aria-hidden="true" />
		</button>
	);
});

// the line of an employer: across the table, in the grey of a heading. The grey goes on as a narrow
// band down the left of its projects (WeJpProjectRow), so the two read as one frame around them:
// what stands inside the frame is of that employer
const WeJpEmployerRow = observer(function WeJpEmployerRow({ section, employer, store }) {
	const edit = useContext(CvJpEditContext);
	const factList = factListShownGet(employer.factList, store);
	const isEmploymentDrawn = employer.employment.text !== '' || store.isEditing;
	const isProjectDrawn = employer.projectList.some((project) => !project.isHidden);
	return (
		// an employer without a project is a place to cut after; with projects, its line stays with the first
		<tr className="doc-we-jp-row-employer" data-page-break={isProjectDrawn ? undefined : employer.key}>
			<td className="doc-we-jp-band" data-open={isProjectDrawn ? '' : undefined} />
			<td className="doc-we-jp-period-cell">
				{store.isEditing ? <WeJpItemHide section={section} item={employer} label="employer" /> : null}
				<WeJpPeriod period={employer.period} store={store} />
			</td>
			<td colSpan={2} className="doc-we-jp-employer">
				<div className="doc-we-jp-employer-line">
					<CvJpCell cell={employer.name} store={store} className="doc-we-jp-employer-name" placeholder="会社名" />
					{isEmploymentDrawn ? <CvJpCell cell={employer.employment} store={store} className="doc-we-jp-employment" isOptional placeholder="雇用形態" /> : null}
				</div>
				{/* its facts: entries of the employer in the profile, each a label and what it says, both
				    cells. while the sheet is edited: the tools of each, and a new one at the end */}
				{factList.length > 0 || store.isEditing ? (
					<div className="doc-we-jp-fact-line">
						{factList.map((fact) => (
							<span key={fact.id} className="doc-we-jp-fact">
								<CvJpCell cell={fact.labelCell} store={store} className="doc-we-jp-fact-label" isOptional placeholder="項目名" />
								<CvJpCell cell={fact.cell} store={store} isOptional placeholder="内容" />
								{store.isEditing ? <WeJpFactTool section={section} fact={fact} /> : null}
							</span>
						))}
						{store.isEditing ? (
							<button type="button" className="doc-we-jp-fact-add" disabled={!edit?.isProfileEditable} title={edit?.isProfileEditable ? 'A new entry of this company (事業内容, 資本金, …), in the profile: its label and what it says are typed in place' : edit?.profileUnavailableReason} aria-label="A new entry of this company" onClick={(event) => { event.stopPropagation(); edit?.leave(); edit?.careerFactAdd(employer); }}>
								<Plus size={11} aria-hidden="true" /><span>項目</span>
							</button>
						) : null}
					</div>
				) : null}
				{store.isEditing ? (
					<button type="button" className="doc-cv-jp-row-add" disabled={!edit?.isProfileEditable} title={edit?.isProfileEditable ? 'A new project of this employer, in the profile' : edit?.profileUnavailableReason} aria-label="A new project of this employer" onClick={(event) => { event.stopPropagation(); edit?.leave(); edit?.careerItemAdd(section, employer.key); }}>
						<Plus size={12} aria-hidden="true" />
					</button>
				) : null}
			</td>
		</tr>
	);
});

// a project: a row inside the frame of its employer. Its first cell is the band, with the place
// of the project among those of its employer
//   isBandOpen   the band goes on under this row (another project, or the rest of a page the
//                employer is cut by)
const WeJpProjectRow = observer(function WeJpProjectRow({ section, project, store, isBandOpen }) {
	const factSideList = factListShownGet(project.factSideList, store);
	const factMainList = factListShownGet(project.factMainList, store);
	return (
		<tr className="doc-we-jp-row-project" data-page-break={project.key}>
			<td className="doc-we-jp-band" data-open={isBandOpen ? '' : undefined}>{project.ordinal > 0 ? project.ordinal : null}</td>
			<td className="doc-we-jp-period-cell">
				{store.isEditing ? <WeJpItemHide section={section} item={project} label="project" /> : null}
				<WeJpPeriod period={project.period} store={store} />
			</td>
			<td className="doc-we-jp-project">
				<CvJpCell as="div" cell={project.title} store={store} className="doc-we-jp-project-title" placeholder="プロジェクト名" />
				{project.summary.text !== '' || store.isEditing ? (
					<CvJpCell as="div" cell={project.summary} store={store} className="doc-we-jp-project-text" isMultiline isOptional placeholder="概要・業務内容">
						<CvJpLineList lineList={cvJpCellLineListGet(project.summary)} cell={project.summary} store={store} />
					</CvJpCell>
				) : null}
				{factMainList.map((fact) => (
					<div key={fact.id} className="doc-we-jp-project-fact">
						<div className="doc-we-jp-fact-label">{fact.label}</div>
						<CvJpCell as="div" cell={fact.cell} store={store} className="doc-we-jp-project-text" isMultiline isOptional placeholder="—">
							<CvJpLineList lineList={cvJpCellLineListGet(fact.cell)} cell={fact.cell} store={store} />
						</CvJpCell>
					</div>
				))}
			</td>
			<td className="doc-we-jp-side">
				{/* the labels in a column of their own, as wide as the widest: what they say lines up beside them */}
				<div className="doc-we-jp-side-list">
					{factSideList.map((fact) => [
						<div key={`${fact.id}-label`} className="doc-we-jp-fact-label">{fact.label}</div>,
						<CvJpCell key={fact.id} as="div" cell={fact.cell} store={store} className="doc-we-jp-side-value" isMultiline isOptional placeholder="—" />,
					])}
				</div>
			</td>
		</tr>
	);
});

// the career: a table of 期間, what was done, and the facts beside it. Each employer is a line
// across the table (its period, its name, how the person was employed, facts of the company),
// then a row per project, numbered, inside the frame the employer's grey makes around them
// (doc/we-jp.md#the-look). Laid out on pages (CvJpPagination.jsx) it is cut between rows: every
// project is a place to cut, an employer's line is not (it stays with its first project), a part
// going on with the projects of an employer does not repeat its line (isContinued), and
// fillHeight draws the rules, and the band of an employer cut by the page (isEmployerCut), to
// the page's bottom
export const WeJpCareer = observer(function WeJpCareer({ section, store, fillHeight = 0 }) {
	const edit = useContext(CvJpEditContext);
	const employerList = section.employerList.filter((employer) => !employer.isHidden);
	const isFilled = fillHeight > 1;
	return (
		<table className="doc-cv-jp-table doc-we-jp-table-career" data-cut-below={section.isCutBelow || section.isLast ? '' : undefined}>
			<colgroup><col className="doc-we-jp-col-band" /><col className="doc-we-jp-col-period" /><col /><col className="doc-we-jp-col-side" /></colgroup>
			<tbody>
				<tr className="doc-cv-jp-row-head">
					<td colSpan={2}>期 間</td>
					<CvJpCell as="td" cell={cvJpTitleCellGet(section)} store={store} className="doc-cv-jp-title-cell" isOptional placeholder="タイトル" />
					<td>
						{section.sideTitle}
						{store.isEditing ? (
							<button type="button" className="doc-cv-jp-row-add" disabled={!edit?.isProfileEditable} title={edit?.isProfileEditable ? 'A new employer, in the profile' : edit?.profileUnavailableReason} aria-label="A new employer" onClick={(event) => { event.stopPropagation(); edit?.leave(); edit?.careerItemAdd(section); }}>
								<Plus size={12} aria-hidden="true" />
							</button>
						) : null}
					</td>
				</tr>
				{employerList.map((employer, employerIndex) => {
					const projectList = employer.projectList.filter((project) => !project.isHidden);
					const isCutHere = isFilled && section.isEmployerCut === true && employerIndex === employerList.length - 1;
					return [
						employer.isContinued ? null : <WeJpEmployerRow key={employer.key} section={section} employer={employer} store={store} />,
						...projectList.map((project, index) => <WeJpProjectRow key={project.key} section={section} project={project} store={store} isBandOpen={index < projectList.length - 1 || isCutHere} />),
					];
				})}
				{employerList.length === 0 ? (
					<tr className="doc-we-jp-row-project doc-we-jp-row-empty" data-page-break="empty">
						<td colSpan={2} className="doc-we-jp-period-cell" />
						{/* no employer at the folder of the section: said while the sheet is edited, as a history whose query reads no entry */}
						{store.isEditing && section.isListEmpty ? (
							<td colSpan={2} data-missing="" title={`the profile holds no folder below ${section.listText}: an employer is a folder there, ${section.listText}/sample-company`}>
								<span className="doc-cv-jp-row-empty-note">{`{{${section.listText}}}`} holds no employer in the profile</span>
							</td>
						) : <td colSpan={2} />}
					</tr>
				) : null}
				{isFilled ? (
					<tr className="doc-cv-jp-row-fill" aria-hidden="true" style={{ height: `${fillHeight}px` }}>
						{section.isEmployerCut === true ? <td className="doc-we-jp-band" data-fill="" /> : null}
						<td colSpan={section.isEmployerCut === true ? 1 : 2} /><td /><td />
					</tr>
				) : null}
			</tbody>
		</table>
	);
});
