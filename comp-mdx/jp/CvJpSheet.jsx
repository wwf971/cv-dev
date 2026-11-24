import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { AlignCenter, AlignLeft, AlignRight, BookmarkPlus, Check, Download, Eye, EyeOff, Files, Pencil, Printer, RotateCcw, Trash2, X } from 'lucide-react';
import { CellEdit, CellField, PageFlow, PanelPopup, pageFlowPrintProfileGet, useCell } from '@wwf971/react-doc';
import { cvBadgeRead } from '../query/CvBadge.js';
import { CV_KIND_ID_INFO, CV_KIND_INFO, cvKindNameOf, cvPartitionListGet, cvPathSplit, cvProfileHoldProblemGet, cvProfileRead } from '../query/CvProfile.js';
import { cvInfoBuild } from '../query/CvQuery.js';
import {
	CV_JP_CELL_PDF_TITLE, CV_JP_KIND_PAPER_LIST, CV_KIND_CV, CV_KIND_PART, CV_KIND_TEMPLATE, cvJpDateGet, cvJpDateVirtualBuild, cvJpFormGet, cvJpInstanceRead, cvJpPaperListGet, cvJpPartTemplateListGet,
	cvJpSectionLabelGet, cvJpSheetBuild, cvJpTemplateRead,
} from './CvJpData.js';
import { CvJpPartEmpty, CvJpPartMenu, CvJpPartOptionCard, CvJpSectionTool, cvJpPartContextMenuHandle } from './CvJpPart.jsx';
import { CvJpStore } from './CvJpStore.js';
import { CvJpImagePick } from './CvJpImagePick.jsx';
import { CvPaperNameField, CvUndoRedo, useCvEditHistory } from './CvPaperName.jsx';
import { cvJpPagination } from './CvJpPagination.jsx';
import { CvJpEditContext } from './CvJpSection.jsx';
import { CvJpSectionBody } from './CvJpSectionBody.jsx';
import { cvBadgeToken } from './cv-badge-cell.jsx';
import { cvEraToken } from './cv-era-cell.jsx';
import { cvPeriodToken } from './cv-period-cell.jsx';
import { cvQueryToken } from './cv-query-cell.js';
import './CvJp.css';

// One paper of the object, drawn as its form says (doc/cv-sheet.md): a Japanese-style CV (cv-jp,
// doc/cv-jp.md) or a Japanese-style work experience (we-jp, doc/we-jp.md). The two are one sheet:
// the kind of the paper names its form, its template the sections drawn, and everything below
// (cells, cards, blocks, pages) is the same for both. The look follows the common forms: one A4
// width, black rules on white, whatever the theme of the page.
//
// In-place editing (doc/cv-sheet.md#editing-in-place): the cells, and the text and note of every
// row, are cells of react-doc's cell editing kit (react-doc: main/doc_page_impl_edit_cell.md). In
// edit mode a click on a cell makes the cell itself the surface its text is typed in, showing
// its words and tokens as written while every other cell shows what it reads; "{{" or /query
// writes a query path of the profile, a segment at a time, /badge a badge of the profile (the
// CV's own token kinds, cv-query-cell.js and cv-badge-cell.jsx), /link a link to a document,
// /object a view of an object. A card under the cell holds the rest. A row of a history opens
// all its fields at once, Tab going through them, and a grip beside it drags it to another
// place. A badge is selected by a click and changed from the card to its right. Nothing of the
// sheet moves: a surface keeps the width of its cell, and only a line break makes it taller.
//
// Pages opens the paper on A4 pages, as printed, in a dialog over the page (doc/cv-sheet.md#pages).
//
// Its sections are the template's and the paper's own blocks (doc/cv-sheet.md#blocks): while the
// sheet is edited each has a few buttons in the right margin of the paper, moving it, leaving it
// out, and adding a block under it.
//
//   param.instance   the paper shown: a path, a key, name:…; absent: the first
//   param.partition  without an instance named: the first paper of this partition
//   param.kind       without an instance named: of this kind (cv, the default; we)
//   param.profile    the profile read when the paper names none (else metadata.profile of the object)
//
// isPaperChoiceHidden: drawn inside the mode Papers (CvJpList.jsx), whose path bar chooses the paper,
// the sheet has no choice of its own
//
// What does not fit is said, never drawn as an empty paper (doc/cv-sheet.md#when-something-does-not-fit):
// a problem of what the paper reads (its profile, its template, the partition) is a line above the
// sheet, in reading mode too; a problem of one cell (a query nothing answers, a photo that is no
// image, a history whose query reads no entry) is marked on the cell while the sheet is edited.

// the papers by their partition and form, in the order they come: [the label of a group, its papers]
function cvInstanceByPartitionGet(instanceList) {
	const listByGroup = new Map();
	for (const asset of instanceList) {
		const { partition } = cvPathSplit(asset.pathList?.[0]);
		const groupLabel = `${partition || '(no partition)'} · ${cvJpFormGet(asset.kind).labelPlural}`;
		listByGroup.set(groupLabel, [...(listByGroup.get(groupLabel) ?? []), asset]);
	}
	return [...listByGroup.entries()];
}

// "a template", "an instance": a kind of asset in a sentence
function cvKindWithArticle(kind) {
	return `${/^[aeiou]/i.test(kind) ? 'an' : 'a'} ${kind || 'asset of no kind'}`;
}

// the problem of the profile a CV names ('' when there is none to say): no profile, an object that
// cannot be read, an object holding no information. a profile is any object whose type holds the
// kind cv.profile.info (read as one otherwise, it would only be empty)
function cvProfileProblemGet(profileRef, profileOther) {
	if (!profileRef) return 'This paper names no profile: profile: frontend:{id} in its data, or metadata.profile of the object.';
	const object = profileOther?.object;
	if (!object || object.status === 'loading') return '';
	if (object.status !== 'found') return `The profile ${profileRef}: ${object.message}`;
	const holdProblem = cvProfileHoldProblemGet(profileOther);
	return holdProblem ? `The profile ${profileRef} (${object.name || object.id}) ${holdProblem}: nothing is read from it.` : '';
}

// a profile holding nothing in the partition of the paper, whose every query then reads nothing:
// which partitions do hold information ('' when this one does)
function cvProfilePartitionNoteGet(profile, profileRead, partition) {
	if (!profile || !profileRead || profileRead.countAll > 0 || profileRead.countLoading > 0) return '';
	const assetList = profile.assetList(cvKindNameOf(profile, CV_KIND_ID_INFO, CV_KIND_INFO)).filter((asset) => asset.status === 'found');
	const partitionFilled = new Set(assetList.map((asset) => cvPathSplit(asset.pathList?.[0]).partition));
	const otherList = cvPartitionListGet(profile, assetList).filter((one) => one.id !== partition && partitionFilled.has(one.id)).map((one) => one.label);
	const place = partition ? `the partition ${partition}` : 'no partition';
	return `The profile ${profile.object.name || profile.object.id} holds no information in ${place}, where this paper lies, so its queries read nothing${otherList.length > 0 ? ` (it holds some in ${otherList.join(', ')})` : ''}.`;
}

// the problem of the template a paper is drawn with ('' when there is none): named and not there,
// naming an asset of another kind, or a template of the other form. the default form is drawn instead
function cvTemplateProblemGet(templateRef, templateRead, form) {
	if (!templateRef || !templateRead || templateRead.status === 'loading') return '';
	if (templateRead.status !== 'done') return `The template ${templateRef}: ${templateRead.message || 'it cannot be read'}. The default form is drawn.`;
	if (templateRead.asset && templateRead.asset.kind !== CV_KIND_TEMPLATE) return `The template ${templateRef} names ${cvKindWithArticle(templateRead.asset.kind)}, not a template. The default form is drawn.`;
	const formOfTemplate = cvJpFormGet(String(templateRead.data?.form ?? CV_KIND_CV));
	if (formOfTemplate.kind !== form.kind) return `The template ${templateRef} is a template of a ${formOfTemplate.label} (form: ${formOfTemplate.kind}), and this paper is a ${form.label}. The default form is drawn.`;
	return '';
}

// the card of what is open: under the cell (or the field of a row) it belongs to, its left edge at
// the cell's, kept inside the sheet; it follows the cell as it grows. It floats, so the sheet never
// moves for it
const CvJpCard = observer(function CvJpCard({ store, children, onKeyDown }) {
	const cardRef = useRef(null);
	const anchor = store.anchorElement;
	useLayoutEffect(() => {
		const card = cardRef.current;
		const root = store.rootElement;
		if (!card || !root || !anchor) return undefined;
		const place = () => {
			const box = root.getBoundingClientRect();
			const rect = anchor.getBoundingClientRect();
			const left = Math.max(0, Math.min(rect.left - box.left, box.width - card.offsetWidth));
			card.style.top = `${Math.round(rect.bottom - box.top + 4)}px`;
			card.style.left = `${Math.round(left)}px`;
		};
		place();
		const observer = new ResizeObserver(place);
		observer.observe(anchor);
		return () => observer.disconnect();
	}, [anchor, store.rootElement]);
	return (
		<div ref={cardRef} className="doc-cv-jp-editor" data-cv-jp-editor="" onKeyDown={onKeyDown}>
			{children}
		</div>
	);
});

// A cell open on the sheet (doc/cv-sheet.md#editing-in-place): its text is typed in place, and each
// token of it has its card under it once marked (a click on it: the value it reads, kept in the
// profile; react-doc: main/doc_page_impl_edit_cell.md#a-token-marked-in-the-typed-text). Beside it,
// floating above its right end so that nothing moves, the few things done with the cell as a whole:
// keep the text in this paper (Enter, or a click elsewhere), cancel (Esc), go back to the
// template, keep selected words in the profile. A cell not drawn on the sheet (opened from More
// fields) is typed in a card instead, under what opened it.
// the ways a cell's text may stand in its box, as the buttons of its bar say them
const CV_JP_ALIGN_BUTTON_LIST = [
	{ align: 'left', Icon: AlignLeft, label: 'Left' },
	{ align: 'center', Icon: AlignCenter, label: 'Centered' },
	{ align: 'right', Icon: AlignRight, label: 'Right' },
];

//   alignNow   how the text of the cell stands now, as the paper and its template say ('' as its form draws it)
const CvJpCellTool = observer(function CvJpCellTool({ store, service, profile, info, partition, instanceAsset, instanceData, alignNow = '' }) {
	const edit = useContext(CvJpEditContext);
	const { cell, isOffSheet } = store.editor;
	const isSubmitting = store.status === 'submitting';
	const isMultiline = store.editor.isMultiline === true;
	const selection = store.selection;
	const isSelectionKeepable = Boolean(profile) && Boolean(selection?.isPlain) && String(selection?.text ?? '').trim() !== '';
	// in the look of the page's Save and Cancel (react-doc's EditActions): small buttons with words,
	// what applies to this cell first, then Save and Cancel
	const alignShown = alignNow || store.editor.alignDefault;
	const group = (
		<span className="doc-cv-jp-tool-group" role="group" aria-label={`The cell ${cell.id}`}>
			{/* how its text stands in its box: written at once, for this paper (doc/cv-sheet.md#the-alignment-of-a-cell) */}
			{store.editor.isAlignable ? (
				<span className="doc-cv-jp-tool-align" role="group" aria-label="How the text stands in the cell">
					{CV_JP_ALIGN_BUTTON_LIST.map(({ align, Icon, label }) => (
						<button
							key={align}
							type="button"
							className="doc-button"
							aria-pressed={alignShown === align}
							disabled={isSubmitting}
							title={`${label}${align === store.editor.alignDefault && !cell.alignTemplate ? ' (as the form draws it)' : align === cell.alignTemplate ? ' (as its template draws it)' : ''}: for this paper`}
							aria-label={label}
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => { if (alignShown !== align) void store.cellAlignSet(service, instanceAsset, instanceData, cell, align); }}
						>
							<Icon size={12} strokeWidth={2.2} aria-hidden="true" />
						</button>
					))}
				</span>
			) : null}
			{isSelectionKeepable ? (
				<button type="button" className="doc-button" aria-pressed={store.isExtractOpen} title="Keep the selected words in the profile, and name them here by their path" onClick={() => store.extractOpenSet(!store.isExtractOpen)}>
					<BookmarkPlus size={12} strokeWidth={2.2} aria-hidden="true" /><span>Keep in profile…</span>
				</button>
			) : null}
			{cell.isOverride ? (
				<button type="button" className="doc-button" disabled={isSubmitting} title="Back to the template: this paper's own text of this cell is taken away" onClick={() => store.cellReset(service, instanceAsset, instanceData)}>
					<RotateCcw size={12} strokeWidth={2.2} aria-hidden="true" /><span>Template</span>
				</button>
			) : null}
			<button type="button" className="doc-button" data-primary="" disabled={isSubmitting} title={`Save this text in this paper (${isMultiline ? 'Ctrl/⌘ + Enter' : 'Enter'}; a click elsewhere saves it too)`} onClick={() => edit?.cellSave()}>
				<Check size={12} strokeWidth={2.2} aria-hidden="true" /><span>Save</span>
			</button>
			<button type="button" className="doc-button" title="Cancel (Esc): the cell as it was" onClick={store.editorClose}>
				<X size={12} strokeWidth={2.2} aria-hidden="true" /><span>Cancel</span>
			</button>
		</span>
	);
	return (
		<>
			{isOffSheet ? (
				<CvJpCard store={store} onKeyDown={(event) => { if (event.key === 'Escape' && !event.defaultPrevented) { event.stopPropagation(); store.editorClose(); } }}>
					<div className="doc-cv-jp-editor-head">
						<span>{cell.label || cell.id}</span>
						{group}
					</div>
					<div className="doc-cv-jp-editor-surface">
						<CellEdit cell={edit?.cell} text={store.draft} textVersion={store.draftVersion} isTokenMarkedOnOpen ariaLabel={`The text of the cell ${cell.id}`} onTextChange={store.draftSet} onSelectionChange={store.selectionSet} onCancelRequest={store.editorClose} onSubmitRequest={() => edit?.cellSave()} />
					</div>
					{store.message ? <p className="doc-cv-jp-editor-missing" role="alert">{store.message}</p> : null}
				</CvJpCard>
			) : (
				<CvJpFloatAbove store={store}>
					{group}
					{store.message ? <span className="doc-error doc-cv-jp-tool-message" role="alert">{store.message}</span> : null}
				</CvJpFloatAbove>
			)}
			{store.isExtractOpen && isSelectionKeepable && !isOffSheet ? <CvJpExtractCard store={store} profile={profile} info={info} partition={partition} /> : null}
		</>
	);
});

// words selected in the text of a cell, kept in the profile at a path typed here and named in their
// place by it ({{address/jp/building}})
const CvJpExtractCard = observer(function CvJpExtractCard({ store, profile, info, partition }) {
	const { selection } = store;
	const isSubmitting = store.status === 'submitting';
	const extractProblem = store.extractProblemGet(info);
	return (
		<CvJpCard store={store} onKeyDown={(event) => { if (event.key === 'Escape' && !event.defaultPrevented) { event.stopPropagation(); store.extractOpenSet(false); } }}>
			<div className="doc-cv-jp-editor-label">Keep the selected words in the profile, and name them here by their path: <span className="doc-cv-jp-editor-leaf-path">{selection.text.length > 40 ? `${selection.text.slice(0, 40)}…` : selection.text}</span></div>
			<div className="doc-cv-jp-editor-row">
				<input className="doc-cv-jp-editor-input" aria-label="The path the selected words are kept at" placeholder="Their path: address/jp/building" value={store.extractPath} onChange={(event) => store.extractPathSet(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !extractProblem) { event.preventDefault(); event.stopPropagation(); void store.selectionExtract(profile, info, partition); } }} />
				<button type="button" className="doc-button" disabled={isSubmitting || extractProblem !== ''} title={extractProblem || `Written into the profile (partition ${partition || '(none)'}), and replaced here by {{${store.extractPath.trim()}}}`} onClick={() => store.selectionExtract(profile, info, partition)}>Keep in the profile</button>
			</div>
			{store.extractPath.trim() !== '' ? <div className="doc-cv-jp-editor-hint">{extractProblem || `The cell will say {{${store.extractPath.trim()}}} in their place.`}</div> : null}
		</CvJpCard>
	);
});

// what floats above the right end of the open cell (its tools): placed in the sheet, so nothing of
// the sheet moves for it; it follows the cell as it grows
//   anchor   what it floats above: the open cell (the default), the row of a history
const CvJpFloatAbove = observer(function CvJpFloatAbove({ store, anchor = store.anchorElement, children }) {
	const floatRef = useRef(null);
	useLayoutEffect(() => {
		const float = floatRef.current;
		const root = store.rootElement;
		if (!float || !root || !anchor) return undefined;
		const place = () => {
			const box = root.getBoundingClientRect();
			const rect = anchor.getBoundingClientRect();
			const left = Math.max(0, Math.min(rect.right - box.left - float.offsetWidth, box.width - float.offsetWidth));
			float.style.top = `${Math.round(rect.top - box.top - float.offsetHeight - 4)}px`;
			float.style.left = `${Math.round(left)}px`;
		};
		place();
		const observer = new ResizeObserver(place);
		observer.observe(anchor);
		observer.observe(float);
		return () => observer.disconnect();
	}, [anchor, store.rootElement]);
	return <div ref={floatRef} className="doc-cv-jp-tool-float" data-cv-jp-editor="">{children}</div>;
});

// the card of the photo: an image, so nothing is typed. The photo is a value of the profile like
// a name is, but a person reads it as "my photo", so the card says where it is kept in plain words
// and whether git sees it, which matters for a picture of a face
//   profileProblem   why the profile cannot be written now ('' when it can)
const CvJpPhotoCard = observer(function CvJpPhotoCard({ store, profile, info, partition, profileProblem }) {
	const cardRef = useRef(null);
	const { cell } = store.editor;
	const { leaf } = cell;
	const isSubmitting = store.status === 'submitting';
	const partitionOne = profile?.partitionList?.find((one) => one.id === partition);
	const partitionLabel = partitionOne?.label || partition || '(none)';
	// the form reads the photo from the profile ({{photo}}); a template may give an image itself
	const problem = !cell.query ? 'The template of this CV gives the photo itself, so it is changed there.' : !profile ? 'This CV reads no profile to keep a photo in.' : profileProblem;
	const photoWrite = (image) => {
		store.draftProfileSet(image);
		return leaf ? store.profileLeafSave(profile, leaf) : store.profileLeafAdd(profile, info, cell.query, image, partition);
	};
	// the keys of the card (Esc) work at once: nothing else is focused when a photo is clicked
	useEffect(() => {
		cardRef.current?.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
	}, []);
	return (
		<CvJpCard store={store} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); store.editorClose(); } }}>
			<div ref={cardRef} className="doc-cv-jp-editor-photo">
				<div className="doc-cv-jp-editor-head"><span>Photo</span></div>
				{problem ? <p className="doc-cv-jp-editor-missing">{problem}</p> : (
					<>
						<div className="doc-cv-jp-editor-label">Kept in the profile, not in this CV: every CV of the partition {partitionLabel} shows the same photo.</div>
						{partitionOne?.isGitIgnored
							? <div className="doc-cv-jp-editor-label">The partition {partitionLabel} is kept out of git, so the photo stays on this machine.</div>
							: <p className="doc-cv-jp-editor-missing">The partition {partitionLabel} is tracked by git: a photo given here is committed with it.</p>}
						<CvJpImagePick label={cell.text ? 'Choose another photo…' : 'Choose a photo…'} isDisabled={isSubmitting} onImage={photoWrite} onProblem={store.messageSet} />
					</>
				)}
				{store.message ? <p className="doc-cv-jp-editor-missing" role="alert">{store.message}</p> : null}
				<div className="doc-cv-jp-editor-actions">
					{!problem && leaf && cell.text ? <button type="button" className="doc-button" disabled={isSubmitting} onClick={() => photoWrite('')}>Remove the photo</button> : null}
					<span className="doc-cv-jp-editor-space" />
					<button type="button" className="doc-button" onClick={store.editorClose}>Close</button>
				</div>
			</div>
		</CvJpCard>
	);
});

// A row of a history open on the sheet: its fields are typed in place (Tab goes to the next one,
// Enter saves, Shift+Enter breaks a line, Esc cancels). Above its right end, as the tools of a
// cell float, what is done with the row as a whole: where it is kept, taking it out of this paper,
// the order of its list, Save and Cancel. A row of the profile is shown by every paper reading it:
// Hide in this paper leaves the profile and the other papers as they are (More fields shows it here
// again). A row only this paper has is deleted. Either is undone with Ctrl/⌘ + Z
const CvJpRowTool = observer(function CvJpRowTool({ store, service, instanceAsset, instanceData }) {
	const edit = useContext(CvJpEditContext);
	const { group, row } = store.editor;
	const isSubmitting = store.status === 'submitting';
	const isOfProfile = Boolean(row) && !row.isExtra;
	const anchor = store.anchorElement?.closest?.('tr') ?? store.anchorElement;
	return (
		<CvJpFloatAbove store={store} anchor={anchor}>
			<span className="doc-cv-jp-tool-group" role="group" aria-label="The row">
				<span className="doc-cv-list-muted doc-cv-jp-tool-where" title={isOfProfile ? 'A row of the profile: what is typed here changes every paper that reads it' : 'A row only this paper has: the profile does not hold it'}>
					{isOfProfile ? 'In the profile' : 'Only this paper'}
				</span>
				{isOfProfile ? (
					<button type="button" className="doc-button" disabled={isSubmitting} title="Not drawn in this paper. The profile keeps the row and every other paper still shows it; More fields shows it here again" onClick={() => store.rowRemove(service, instanceAsset, instanceData)}>
						<EyeOff size={12} strokeWidth={2.2} aria-hidden="true" /><span>Hide in this paper</span>
					</button>
				) : null}
				{row && !isOfProfile ? (
					<button type="button" className="doc-button" disabled={isSubmitting} title="Delete this row: only this paper has it (Ctrl/⌘ + Z brings it back)" onClick={() => store.rowRemove(service, instanceAsset, instanceData)}>
						<Trash2 size={12} strokeWidth={2.2} aria-hidden="true" /><span>Delete</span>
					</button>
				) : null}
				{group.isOrderOwn ? (
					<button type="button" className="doc-button" disabled={isSubmitting} title="This paper orders the rows of this list itself (they were dragged): put them in order of time again" onClick={() => store.rowOrderReset(service, instanceAsset, instanceData, group)}>
						<RotateCcw size={12} strokeWidth={2.2} aria-hidden="true" /><span>Order by time</span>
					</button>
				) : null}
				<button type="button" className="doc-button" data-primary="" disabled={isSubmitting} title="Save the row (Enter; a click elsewhere saves it too). Tab goes to the next field, Shift+Enter breaks a line" onClick={() => edit?.rowSave()}>
					<Check size={12} strokeWidth={2.2} aria-hidden="true" /><span>Save</span>
				</button>
				<button type="button" className="doc-button" title="Cancel (Esc): the row as it was" onClick={store.editorClose}>
					<X size={12} strokeWidth={2.2} aria-hidden="true" /><span>Cancel</span>
				</button>
			</span>
			{store.message ? <span className="doc-error doc-cv-jp-tool-message" role="alert">{store.message}</span> : null}
		</CvJpFloatAbove>
	);
});

// what is not drawn now and can be: the optional rows, the rows, the sections and the parts of a
// career left out of this paper. A block of the paper's own left out can also be deleted for good
const CvJpFieldList = observer(function CvJpFieldList({ sheet, store, service, instanceAsset, instanceData }) {
	const edit = useContext(CvJpEditContext);
	const buttonRef = useRef(null);
	// the rows of the top not drawn because they say nothing (a row its options say never to draw is not offered)
	const optionalList = sheet.rowOptionalList.filter((row) => !row.isShown && row.shown !== 'never').flatMap((row) => row.cellList);
	const hiddenList = sheet.sectionList.flatMap((section) => (section.groupList ?? []).flatMap((group) => group.rowList.filter((row) => row.isHidden).map((row) => ({ group, row }))));
	const sectionHiddenList = sheet.sectionList.filter((section) => section.isHidden);
	// what a career leaves out: an employer, a project, a fact of an employer (said with its employer;
	// one of an employer left out as a whole comes back with it)
	const careerHiddenList = sheet.sectionList.filter((section) => !section.isHidden).flatMap((section) => (section.employerList ?? []).flatMap((employer) => [
		...(employer.isHidden ? [{ section, item: employer, label: employer.name.text || employer.key }] : []),
		...employer.projectList.filter((project) => project.isHidden).map((project) => ({ section, item: project, label: project.title.text || project.key })),
		...(employer.isHidden ? [] : employer.factList.filter((fact) => fact.isHidden).map((fact) => ({ section, item: fact, fact, label: `${employer.name.text || employer.key} · ${fact.label || fact.cell.text || fact.id}` }))),
	]));
	const count = optionalList.length + hiddenList.length + sectionHiddenList.length + careerHiddenList.length;
	return (
		<span className="doc-cv-jp-field">
			<button ref={buttonRef} type="button" className="doc-button" aria-expanded={store.isFieldListOpen} onClick={store.fieldListToggle}>More fields ({count})</button>
			{store.isFieldListOpen ? (
				<div className="doc-cv-jp-field-list" data-cv-jp-editor="">
					{sectionHiddenList.map((section) => (
						<span key={section.id} className="doc-cv-jp-field-row">
							<button type="button" className="doc-cv-jp-field-item" title="A part deleted from this paper: draw it again" onClick={() => edit?.sectionHiddenSet(section.id, false)}><Eye size={12} aria-hidden="true" /> {cvJpSectionLabelGet(section)}</button>
							{section.isOwn ? (
								<button type="button" className="doc-cv-jp-field-item" data-icon="" title="Delete this part of the paper for good, with what it says" aria-label="Delete this part for good" onClick={() => edit?.sectionRemove(section.id)}><Trash2 size={12} aria-hidden="true" /></button>
							) : null}
						</span>
					))}
					{careerHiddenList.map(({ section, item, fact, label }) => (
						<span key={item.key} className="doc-cv-jp-field-row">
							<button type="button" className="doc-cv-jp-field-item" title="Draw it in this paper again" onClick={() => edit?.careerItemHiddenSet(section, item.key, false)}>{label}</button>
							{fact ? (
								<button type="button" className="doc-cv-jp-field-item" data-icon="" disabled={!edit?.isProfileEditable} title="Remove this entry from the profile: from every paper" aria-label="Remove this entry from the profile" onClick={() => edit?.careerFactRemove(fact)}><Trash2 size={12} aria-hidden="true" /></button>
							) : null}
						</span>
					))}
					{optionalList.map((one) => (
						<button key={one.id} type="button" className="doc-cv-jp-field-item" onClick={() => store.cellOpen(one.cell, buttonRef.current, one.cell.leaf?.value ?? '', { isOffSheet: true })}>{one.label}</button>
					))}
					{hiddenList.map(({ group, row }) => (
						<button
							key={row.id}
							type="button"
							className="doc-cv-jp-field-item"
							title="A row of the profile hidden in this paper: show it here again"
							onClick={() => { store.rowOpen(group, row, null); store.rowRemove(service, instanceAsset, instanceData); store.fieldListToggle(); }}
						>
							<Eye size={12} aria-hidden="true" /> {row.year} {edit?.cell ? edit.cell.textGet(row.text) : row.text}
						</button>
					))}
					{count === 0 ? <span className="doc-note">Everything is drawn.</span> : null}
				</div>
			) : null}
		</span>
	);
});

// the title of the paper's PDF, typed in the bar of its pages (doc/cv-sheet.md#pages): a cell of
// the paper, words and queries (履歴書_{{name/jp/kanji}}), drawn as it reads; empty, the paper's
// name. what a PDF reader shows as its title, and what its file is named
const CvJpPdfTitle = observer(function CvJpPdfTitle({ cellTitle, nameOfPaper, titleUsed }) {
	const edit = useContext(CvJpEditContext);
	return (
		// a label: the header of the dialog is its handle, and leaves a label (and what is in it) to itself
		<label className="doc-cv-jp-pages-title" title={`The title a PDF reader shows, and the name of the file: ${titleUsed}`}>
			<span className="doc-cv-list-muted">Title</span>
			{edit?.isPdfTitleEditable ? (
				<CellField
					cell={edit.cell}
					value={cellTitle.raw}
					placeholder={nameOfPaper}
					isEditable
					as="span"
					fieldKey={`${edit.keyPrefix}:${CV_JP_CELL_PDF_TITLE}`}
					onCommit={async (text) => {
						const isDone = await edit.pdfTitleSet(text);
						return isDone ? undefined : { code: -1, message: 'The title was not written.' };
					}}
				/>
			) : <span className="doc-cv-jp-pages-title-read" title={edit?.pdfTitleUnavailableReason}>{titleUsed}</span>}
		</label>
	);
});

// the bar of the pages: how many, printing them, downloading them
const CvJpPagesBar = observer(function CvJpPagesBar({ store, pageFlowRef }) {
	const { status, pageCount } = store.pageState;
	const isReady = status === 'done' && pageCount > 0;
	const profile = pageFlowPrintProfileGet();
	const { pdfState } = store;
	const isDownloading = pdfState.status === 'running';
	return (
		<>
			<span className="doc-cv-list-muted doc-cv-jp-pages-count">{status === 'done' ? `${pageCount} page${pageCount === 1 ? '' : 's'}` : 'Laying out…'}</span>
			<button
				type="button"
				className="doc-button"
				disabled={!isReady}
				title={`Print the pages, or save them as a PDF from the print dialog (its text stays text).${profile.hint ? ` ${profile.label}: ${profile.hint}` : ''}`}
				onClick={() => pageFlowRef.current?.print()}
			>
				<Printer size={12} aria-hidden="true" /><span>Print / PDF</span>
			</button>
			<button
				type="button"
				className="doc-button"
				disabled={!isReady || isDownloading}
				title="Download the pages as a PDF, without a dialog. It is printed by a browser of the development server's machine, so its text is text and its rules are lines. Where that cannot be done (a built page, no Chrome or Edge on that machine) the PDF is one of page images"
				onClick={() => store.pdfDownload(pageFlowRef.current)}
			>
				<Download size={12} aria-hidden="true" /><span>{isDownloading ? 'Making the PDF…' : 'Download PDF'}</span>
			</button>
			{/* what the last download was, when it was the lesser kind: a PDF of images, and why */}
			{pdfState.status === 'done' && pdfState.kind === 'image' ? (
				<span className="doc-cv-list-muted doc-cv-jp-pages-note" title={pdfState.message || 'This page has no development server to print it: a built page.'}>a PDF of page images</span>
			) : null}
			{pdfState.status === 'error' ? <span className="doc-error doc-cv-jp-pages-note" role="alert">{pdfState.message}</span> : null}
		</>
	);
});

export const CvJpSheet = observer(function CvJpSheet({ data = {}, config = {}, isPaperChoiceHidden = false }) {
	const service = config.objectFrontend;
	const param = data.param ?? {};
	const [store] = useState(() => new CvJpStore(param.instance));
	// the profile as the cards of the tokens change it (a value of a query, the dates of a period):
	// one object for the life of the sheet, its fields set at every render, so that handing it to
	// the cell does not draw every token again
	const [profileAccess] = useState(() => ({}));
	const pageFlowRef = useRef(null);
	// what is changed from this sheet is undone with Ctrl/⌘ + Z while the author is at it
	// (doc/cv-sheet.md#undo-and-redo): the history of the block, the panel of papers around it sharing it
	const history = useCvEditHistory(config, { rootGet: () => store.rootElement, isWritable: service?.isEditable === true });
	store.history = history;
	// a step taken back or put again changes what an open cell was typed over: it closes
	useEffect(() => {
		store.editorClose();
	}, [history.appliedCount, store]);
	const instanceList = service ? cvJpPaperListGet(service) : [];
	// the paper drawn: the one named; else the first of the kind and the partition asked for
	const kindAsked = CV_JP_KIND_PAPER_LIST.includes(param.kind) ? param.kind : undefined;
	const instanceAsked = instanceList.find((asset) => (!kindAsked || asset.kind === kindAsked) && (!param.partition || cvPathSplit(asset.pathList?.[0]).partition === param.partition));
	const instanceAsset = store.instanceRef ? service?.assetGet(store.instanceRef) : instanceAsked;
	const instanceRead = instanceAsset ? service.assetDataGet(instanceAsset.key) : undefined;
	const instance = cvJpInstanceRead(instanceRead?.data);
	const instanceData = instanceRead?.data ?? {};
	// its form: the kind of the paper says which. a paper naming no template is drawn as its form
	const form = cvJpFormGet(instanceAsset?.kind);
	const templateRef = instance.template;
	const templateRead = templateRef ? service?.assetDataGet(templateRef) : undefined;
	const profileRef = instance.profile || param.profile || service?.object.metadata?.profile || '';
	const profileOther = profileRef && service ? service.otherGet(profileRef) : undefined;
	// the profile is read only when it is one: an object whose type holds no information (no item of
	// the kind cv.profile.info) would give an empty CV. what is wrong is said above the sheet
	const profileProblem = service ? cvProfileProblemGet(profileRef, profileOther) : '';
	const profile = profileOther && !(profileOther.object.status === 'found' && profileProblem) ? profileOther : undefined;
	const date = cvJpDateGet(instance.asOf);
	// a CV reads the profile of its own partition: the first folder of its path (doc/README.md#partitions)
	const partition = cvPathSplit(instanceAsset?.pathList?.[0]).partition;
	const profileRead = profile ? cvProfileRead(profile, cvJpDateVirtualBuild(date), partition) : undefined;
	// no profile read: still the values of the paper itself (the date it is written at)
	const info = profileRead?.info ?? cvInfoBuild([], cvJpDateVirtualBuild(date));
	const badgeRead = profile ? cvBadgeRead(profile, partition) : undefined;
	// the writes of the sheet, recorded in the history and named by the paper they were made in
	const paperName = instanceAsset ? instanceAsset.name || instanceRead?.data?.name || instanceAsset.key : '';
	const serviceWrite = history.wrap(service, paperName);
	const profileWrite = history.wrap(profile, paperName);
	// the document left edit mode, or the object cannot be written any more: the sheet reads again
	const isEditable = service?.isEditable === true;
	// the profile is another object: its values and badges are written while it can be
	const isProfileEditable = isEditable && profile?.isWritable === true;
	// the cell of the sheet's texts: the sheet's own token kinds, a query and a badge of the profile,
	// before the kinds of the page (a link, a view of an object). what they read is the profile
	// as it is at this render: the cell keeps the context current, for a token drawn and for the
	// menu listing while the author types
	profileAccess.profile = profileWrite;
	profileAccess.partition = partition;
	profileAccess.isEditable = isProfileEditable;
	profileAccess.editUnavailableReason = isProfileEditable ? '' : profile?.writeUnavailableReason || service?.editUnavailableReason || 'the profile cannot be written now';
	const cell = useCell({
		tokenList: [cvQueryToken, cvBadgeToken, cvEraToken, cvPeriodToken],
		context: {
			info,
			dateNow: date,
			profileAccess,
			// the way of the paper with its years: a period typed with /period follows it
			isEra: typeof instance.isEra === 'boolean' ? instance.isEra : typeof templateRead?.data?.isEra === 'boolean' ? templateRead.data.isEra : form.isEra === true,
			badge: badgeRead,
			isEditing: store.isEditing,
			isProfileEditable,
			profileUnavailableReason: isProfileEditable ? '' : profile?.writeUnavailableReason || service?.editUnavailableReason || 'the profile cannot be written now',
			badgeCreate: (path) => store.badgeCreate(profileWrite, partition, path),
			badgeWrite: (badge, change) => store.badgeWrite(profileWrite, badge, change),
			// a write that failed, said where it was asked for: the card of a badge has no editor of the sheet around it
			writeProblem: store.status === 'error' ? store.message : '',
		},
		config,
	});
	const edit = {
		cell,
		// the values of this sheet among the cells of the page: what a selected token is known by
		keyPrefix: config.instanceId ?? 'cv',
		cellSave: () => store.cellSave(serviceWrite, instanceAsset, instanceData),
		rowSave: () => store.rowSave(serviceWrite, profileWrite, instanceAsset, instanceData),
		// a token changed from its card: the text written at once, without opening its editor
		cellTextWrite: (cellOne, text) => store.cellTextWrite(serviceWrite, instanceAsset, instanceData, cellOne, text),
		rowFieldWrite: (group, row, field, text) => store.rowFieldWrite(serviceWrite, profileWrite, instanceAsset, instanceData, group, row, field, text),
		drop: (group) => store.drop(serviceWrite, instanceAsset, instanceData, group),
		// the parts of the paper (CvJpPart.jsx), and the parts of a career: what is open is saved first
		sectionAdd: (sectionIdAfter, part) => { edit.leave(); return store.sectionAdd(serviceWrite, instanceAsset, instanceData, sectionListRef.current, sectionIdAfter, part); },
		sectionDelete: (section) => { edit.leave(); return store.sectionDelete(serviceWrite, instanceAsset, instanceData, section); },
		partMenuOpen: (menu) => { edit.leave(); store.partMenuOpen(menu); },
		// the options of a part, for this paper (CvJpPart.jsx CvJpPartOptionPanel)
		partOptionOpen: (sectionId) => { edit.leave(); store.partOptionOpen(sectionId); },
		sectionOptionSet: (section, option, value) => store.sectionOptionSet(serviceWrite, instanceAsset, instanceData, section, option, value),
		sectionOptionReset: (section) => store.sectionOptionReset(serviceWrite, instanceAsset, instanceData, section),
		sectionMove: (sectionId, delta) => { edit.leave(); return store.sectionMove(serviceWrite, instanceAsset, instanceData, sectionListRef.current, sectionId, delta); },
		sectionHiddenSet: (sectionId, isHidden) => { edit.leave(); return store.sectionHiddenSet(serviceWrite, instanceAsset, instanceData, sectionId, isHidden); },
		sectionRemove: (sectionId) => store.sectionRemove(serviceWrite, instanceAsset, instanceData, sectionId),
		careerItemHiddenSet: (section, key, isHidden) => { edit.leave(); return store.careerItemHiddenSet(serviceWrite, instanceAsset, instanceData, section, key, isHidden); },
		careerItemAdd: (section, employerKey) => store.careerItemAdd(profileWrite, partition, section, employerKey, date),
		// the facts of an employer: entries of the profile, added and removed there
		careerFactAdd: (employer) => store.careerFactAdd(profileWrite, info, employer),
		careerFactRemove: (fact) => { edit.leave(); return store.careerFactRemove(profileWrite, info, fact); },
		eraSet: (isEra) => { edit.leave(); return store.eraSet(serviceWrite, instanceAsset, instanceData, isEra); },
		// the title of the paper's PDF, typed in the bar of its pages (written while the document is edited)
		pdfTitleSet: (text) => store.pdfTitleSet(serviceWrite, instanceAsset, instanceData, text),
		isPdfTitleEditable: isEditable,
		pdfTitleUnavailableReason: isEditable ? '' : `The title is typed while the document is edited (${service?.editUnavailableReason || 'read only'})`,
		isProfileEditable,
		profileUnavailableReason: isProfileEditable ? '' : profile?.writeUnavailableReason || service?.editUnavailableReason || 'the profile cannot be written now',
		// what is open is saved: a click elsewhere, another row added, a row dragged
		leave: () => {
			if (store.editor?.kind === 'cell') void store.cellSave(serviceWrite, instanceAsset, instanceData);
			else if (store.editor?.kind === 'row') void store.rowSave(serviceWrite, profileWrite, instanceAsset, instanceData);
		},
	};
	useEffect(() => {
		if (!isEditable) store.editingSet(false);
	}, [isEditable, store]);
	// a click outside what is open saves it (the cell, the row, their card, the menu of the slash
	// mode) or closes it (the list of the fields not drawn). both are read here, so that the
	// listener is there whenever one of them is open
	const isEditorOpen = Boolean(store.editor);
	const isFieldListOpen = store.isFieldListOpen;
	const editRef = useRef(edit);
	editRef.current = edit;
	// the sections as they are drawn now: what a write of their order starts from
	const sectionListRef = useRef([]);
	useEffect(() => {
		if (!isEditorOpen && !isFieldListOpen) return undefined;
		const onPointerDown = (event) => {
			const target = event.target instanceof Element ? event.target : null;
			if (isFieldListOpen && !target?.closest('.doc-cv-jp-field')) store.fieldListClose();
			if (target?.closest('[data-cv-jp-editor], .doc-edit-popup')) return;
			if (store.editor) editRef.current.leave();
		};
		document.addEventListener('pointerdown', onPointerDown, true);
		return () => document.removeEventListener('pointerdown', onPointerDown, true);
	}, [isEditorOpen, isFieldListOpen, store]);
	if (!service) return <p className="doc-error">CvJpSheet is a mode of a frontend object (ObjectFrontend).</p>;
	if (!instanceAsset) {
		const formAsked = cvJpFormGet(kindAsked);
		return <p className="doc-note">{store.instanceRef ? `There is no paper at ${store.instanceRef}.` : `${param.partition ? `The partition ${param.partition}` : 'This object'} has no ${kindAsked ? formAsked.label : 'paper'} yet: the mode "Papers" of this object makes one.`}</p>;
	}
	// a reference naming a template (or anything else) is not drawn as a paper
	if (!CV_JP_KIND_PAPER_LIST.includes(instanceAsset.kind)) return <p className="doc-error">{store.instanceRef} names {cvKindWithArticle(instanceAsset.kind)} of this object, not a paper (an asset of the kind {CV_JP_KIND_PAPER_LIST.join(' or ')}): the mode "Papers" lists them.</p>;
	// the badges are read with the rest: one arriving later would make its row taller under the reader
	const isLoading = instanceRead?.status === 'loading' || templateRead?.status === 'loading' || (profileRead?.countLoading ?? 0) > 0 || (badgeRead?.countLoading ?? 0) > 0 || (profileOther && profileOther.object.status === 'loading');
	if (isLoading) return <p className="doc-note doc-cv-jp-loading">Reading the {form.label}{profileRead?.countAll ? ` (${profileRead.countAll - profileRead.countLoading} of ${profileRead.countAll})` : ''}…</p>;
	if (instanceRead?.status !== 'done') return <p className="doc-error">{instanceRead?.message}</p>;
	// a template that is not there, or is no template, gives way to the default form, and says so
	const templateProblem = cvTemplateProblemGet(templateRef, templateRead, form);
	const template = cvJpTemplateRead(templateRead?.status === 'done' && !templateProblem ? templateRead.data : form.templateDefault, form);
	const problemList = [
		...(profileProblem ? [profileProblem] : []),
		...(templateProblem ? [templateProblem] : []),
		...template.problemList.map((problem) => `The template ${templateRef}: ${problem}.`),
		...(profileRead?.problemList ?? []),
		...(badgeRead?.problemList ?? []),
	];
	const partitionNote = cvProfilePartitionNoteGet(profile, profileRead, partition);
	// cellTextGet: the plain text of a cell, every token as text (what is compared and counted)
	const context = { dateNow: date, cellTextGet: cell.textGet };
	const sheet = cvJpSheetBuild({ template, instance, info, context });
	const sectionShownList = sheet.sectionList.filter((section) => !section.isHidden);
	// the parts a paper of this form may add: the form's, then the part templates of the object
	const partTemplate = cvJpPartTemplateListGet(form, service.assetList(CV_KIND_PART), (key) => {
		const read = service.assetDataGet(key);
		return read?.status === 'done' ? read.data : undefined;
	});
	sectionListRef.current = sheet.sectionList;
	const nameOfPaper = instanceAsset.name || instanceRead.data?.name || form.kind;
	// the title of its PDF: the cell of it as it reads, else the paper's name
	const cellPdfTitle = sheet.cellGet(CV_JP_CELL_PDF_TITLE);
	const titleFile = String(cellPdfTitle.text ?? '').replace(/\s+/g, ' ').trim() || nameOfPaper;
	return (
		<CvJpEditContext.Provider value={edit}>
			<div ref={store.rootElementSet} className="doc-cv-jp not-prose">
				<div className="doc-cv-jp-bar">
					{/* the paper: chosen here, or, while the sheet is edited, its name typed in the same place
					    (doc/cv-sheet.md#renaming-a-paper); another paper is chosen once it is done */}
					{store.isEditing ? (
						<span className="doc-cv-jp-bar-name">
							<span className="doc-cv-list-muted">Name</span>
							<CvPaperNameField history={history} service={service} asset={instanceAsset} name={paperName} onMessage={store.messageSet} />
						</span>
					) : instanceList.length > 1 && !isPaperChoiceHidden ? (
						<select aria-label="The paper" className="doc-cv-jp-select" value={instanceAsset.key} onChange={(event) => { store.instanceSet(event.target.value); }}>
							{cvInstanceByPartitionGet(instanceList).map(([groupLabel, assetList]) => (
								<optgroup key={groupLabel} label={groupLabel}>
									{assetList.map((asset) => <option key={asset.key} value={asset.key}>{asset.name || asset.pathList?.[0] || asset.key}</option>)}
								</optgroup>
							))}
						</select>
					) : null}
					{store.isEditing && !store.editor && store.message ? <span className="doc-error doc-cv-jp-bar-message" role="alert">{store.message}</span> : null}
					<span className="doc-cv-jp-editor-space" />
					{store.isEditing ? <CvUndoRedo history={history} isWritable={service.isEditable} /> : null}
					<button type="button" className="doc-button" title="The paper on A4 pages, as printed: preview, print, download" onClick={store.pagesOpen}>
						<Files size={12} aria-hidden="true" /><span>Pages…</span>
					</button>
					{/* the years the form draws itself, with their era above them or without: the way of this paper */}
					{store.isEditing ? (
						<span className="doc-cv-jp-bar-switch" title="Whether the years of the rows of a history and of the periods of a career have their Japanese era above them (平成28 over 2016). Anywhere else, a year with its era is typed with /era">
							<span className="doc-cv-list-muted">Era above years</span>
							<span className="doc-edit-segment" role="group" aria-label="Whether the years have their era above them">
								<button type="button" className={!sheet.isEra ? 'is-active' : ''} aria-pressed={!sheet.isEra} onClick={() => edit.eraSet(false)}>Off</button>
								<button type="button" className={sheet.isEra ? 'is-active' : ''} aria-pressed={sheet.isEra} onClick={() => edit.eraSet(true)}>On</button>
							</span>
						</span>
					) : null}
					{store.isEditing ? <CvJpFieldList sheet={sheet} store={store} service={serviceWrite} instanceAsset={instanceAsset} instanceData={instanceData} /> : null}
					{/* editing the paper is offered while the document is edited; in reading mode the sheet
					    only reads (react-doc: main/doc_page_impl_obj_frontend.md#reading-and-editing) */}
					{service.docState?.isEditing ? (
						<button type="button" className="doc-button" data-primary={store.isEditing ? '' : undefined} aria-pressed={store.isEditing} disabled={!service.isEditable} title={service.isEditable ? `Edit the cells, rows and sections of this ${form.label}` : service.editUnavailableReason} onClick={store.editingToggle}>
							<Pencil size={12} aria-hidden="true" /><span>{store.isEditing ? 'Done' : 'Edit'}</span>
						</button>
					) : null}
				</div>
				{problemList.map((problem) => <p key={problem} className="doc-error doc-cv-jp-problem">{problem}</p>)}
				{partitionNote ? <p className="doc-note doc-cv-jp-problem">{partitionNote}</p> : null}
				<div className="doc-cv-jp-scroll">
					<div className={`doc-cv-jp-paper doc-cv-jp-form-${form.kind}`} data-editing={store.isEditing ? '' : undefined}>
						{sectionShownList.map((section) => (
							<div key={section.id} className="doc-cv-jp-section" data-section-id={section.id} data-section-type={section.type} onContextMenu={store.isEditing ? (event) => cvJpPartContextMenuHandle(event, section, edit) : undefined}>
								{store.isEditing ? <CvJpSectionTool section={section} /> : null}
								<CvJpSectionBody section={section} sheet={sheet} store={store} />
							</div>
						))}
						{store.isEditing && sectionShownList.length === 0 ? <CvJpPartEmpty /> : null}
					</div>
				</div>
				{store.editor?.kind === 'cell' && store.editor.isImage ? <CvJpPhotoCard store={store} profile={profileWrite} info={info} partition={partition} profileProblem={isProfileEditable ? '' : profile?.writeUnavailableReason || service.editUnavailableReason || 'The profile cannot be written now.'} /> : null}
				{store.editor?.kind === 'cell' && !store.editor.isImage ? <CvJpCellTool store={store} service={serviceWrite} profile={profileWrite} info={info} partition={partition} instanceAsset={instanceAsset} instanceData={instanceData} alignNow={sheet.cellGet(store.editor.cell.id).align} /> : null}
				{store.isEditing && store.partOptionSectionId && sheet.sectionList.some((one) => one.id === store.partOptionSectionId && !one.isHidden) ? (
					<CvJpPartOptionCard key={store.partOptionSectionId} section={sheet.sectionList.find((one) => one.id === store.partOptionSectionId)} store={store} rootGet={() => store.rootElement} isWritable={service.isEditable} onClose={store.partOptionClose} />
				) : null}
				{store.partMenu && store.isEditing ? <CvJpPartMenu menu={store.partMenu} sectionList={sectionShownList} partTemplate={partTemplate} onClose={store.partMenuClose} /> : null}
				{store.editor?.kind === 'row' ? <CvJpRowTool store={store} service={serviceWrite} instanceAsset={instanceAsset} instanceData={instanceData} /> : null}
				{/* the pages, as printed, in a dialog: the sheet stays where it is. the cell of the
				    sheet is around them, so a page draws a token as the sheet does */}
				<PanelPopup
					panelId={`cvJpPages:${config.instanceId ?? ''}`}
					title={`${nameOfPaper}: pages`}
					isOpen={store.isPagesOpen}
					onClose={store.pagesClose}
					className="doc-cv-jp-pages-popup"
					bodyClassName="doc-cv-jp-pages-popup-body"
					headerRightContent={<span className="doc-cv-jp-pages-bar"><CvJpPdfTitle cellTitle={cellPdfTitle} nameOfPaper={nameOfPaper} titleUsed={titleFile} /><CvJpPagesBar store={store} pageFlowRef={pageFlowRef} /></span>}
				>
					<div className="doc-cv-jp-pages not-prose">
						<PageFlow
							ref={pageFlowRef}
							pagination={cvJpPagination}
							pieceList={cvJpPagination.pieceListGet(data, { sheet, form })}
							title={titleFile}
							onStateChange={store.pageStateSet}
						/>
						{store.pageState.problemList.map((problem) => <p key={problem} className="doc-error doc-cv-jp-problem">{problem}</p>)}
					</div>
				</PanelPopup>
			</div>
		</CvJpEditContext.Provider>
	);
});
