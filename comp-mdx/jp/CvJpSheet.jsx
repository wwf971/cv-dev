import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Download, Files, Pencil, Printer } from 'lucide-react';
import { CellEdit, CellValue, EditSlashToggle, PageFlow, PanelPopup, pageFlowPrintProfileGet, useCell } from '@wwf971/react-doc';
import { cvBadgeRead } from '../query/CvBadge.js';
import { cvPathSplit, cvProfileRead } from '../query/CvProfile.js';
import { cvInfoBuild, cvTextExpand } from '../query/CvQuery.js';
import {
	CV_JP_TEMPLATE_DEFAULT, CV_KIND_INSTANCE, CV_KIND_TEMPLATE, cvJpDateGet, cvJpDateVirtualBuild, cvJpInstanceRead, cvJpSheetBuild, cvJpTemplateRead,
} from './CvJpData.js';
import { CvJpStore } from './CvJpStore.js';
import { CvJpImagePick } from './CvJpImagePick.jsx';
import { cvJpPagination } from './CvJpPagination.jsx';
import { CvJpBasic, CvJpEditContext, CvJpHistory, CvJpText } from './CvJpSection.jsx';
import { cvBadgeToken } from './cv-badge-cell.jsx';
import { cvQueryToken } from './cv-query-cell.js';
import './CvJp.css';

// One CV of the object, drawn as a Japanese-style CV (doc/cv-jp.md). The look follows the
// common form: one A4 width, black rules on white, whatever the theme of the page.
//
// In-place editing (doc/cv-jp.md#editing-in-place): the cells, and the text and note of every
// row, are cells of react-doc's cell edit layer (react-doc: main/doc_page_impl_edit_cell.md). In
// edit mode a click on a cell makes the cell itself the surface its text is typed in, showing
// its words and tokens as written while every other cell shows what it reads; "{{" or /query
// writes a query path of the profile, a segment at a time, /badge a badge of the profile (the
// CV's own token kinds, cv-query-cell.js and cv-badge-cell.jsx), /link a link to a document,
// /object a view of an object. A card under the cell holds the rest. A row of a history opens
// all its fields at once, Tab going through them, and a grip beside it drags it to another
// place. A badge is selected by a click and changed from the card to its right. Nothing of the
// sheet moves: a surface keeps the width of its cell, and only a line break makes it taller.
//
// Pages opens the CV on A4 pages, as printed, in a dialog over the page (doc/cv-jp.md#pages).
//
//   param.instance   the CV shown: a path, a key, name:…; absent: the first
//   param.partition  without an instance named: the first CV of this partition
//   param.profile    the profile read when the CV names none (else metadata.profile of the object)

// the CVs by their partition, in the order they come
function cvInstanceByPartitionGet(instanceList) {
	const listByPartition = new Map();
	for (const asset of instanceList) {
		const { partition } = cvPathSplit(asset.pathList?.[0]);
		listByPartition.set(partition, [...(listByPartition.get(partition) ?? []), asset]);
	}
	return [...listByPartition.entries()];
}

const SOURCE_LABEL = { instance: 'Written in this CV', template: 'From the template', default: 'From the form' };

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

const CvJpCellCard = observer(function CvJpCellCard({ store, service, profile, info, partition, context, instanceAsset, instanceData }) {
	const edit = useContext(CvJpEditContext);
	const { cell, isOffSheet } = store.editor;
	const isMultiline = store.editor.isMultiline === true;
	const preview = cvTextExpand(info, store.draft, context);
	const isSubmitting = store.status === 'submitting';
	// the value in the profile, when this cell is one query
	const { leaf } = cell;
	const queryOwn = cell.query;
	const profileSave = () => (leaf ? store.profileLeafSave(profile, leaf) : store.profileLeafAdd(profile, info, queryOwn, store.draftProfile, partition));
	// words selected in the text can be kept in the profile and named here by their path
	const selection = store.selection;
	const extractProblem = selection ? store.extractProblemGet(info) : '';
	return (
		<CvJpCard store={store} onKeyDown={(event) => { if (event.key === 'Escape' && !event.defaultPrevented) { event.stopPropagation(); store.editorClose(); } }}>
			<div className="doc-cv-jp-editor-head">
				<span>{SOURCE_LABEL[cell.source]}</span>
				<span className="doc-cv-jp-editor-hint">{cell.id}</span>
			</div>
			<div className="doc-cv-jp-editor-hint">Type {'{{'} or /query for a value of the profile, /badge for a badge, /link for a link, /object for an object · {isMultiline ? 'Ctrl+Enter' : 'Enter'} saves · Esc cancels</div>
			{isOffSheet ? (
				<div className="doc-cv-jp-editor-surface">
					<CellEdit cell={edit?.cell} text={store.draft} textVersion={store.draftVersion} ariaLabel={`The text of the cell ${cell.id}`} onTextChange={store.draftSet} onSelectionChange={store.selectionSet} onCancelRequest={store.editorClose} onSubmitRequest={() => edit?.cellSave()} />
				</div>
			) : null}
			<div className="doc-cv-jp-editor-preview" data-empty={preview.text === '' ? '' : undefined}>
				<span className="doc-cv-jp-editor-label">Reads</span> {preview.text === '' ? '(nothing)' : <CellValue cell={edit?.cell} text={store.draft} />}
			</div>
			{preview.missingList.length > 0 ? <p className="doc-cv-jp-editor-missing">Nothing holds {preview.missingList.join(', ')} yet.</p> : null}
			{queryOwn && profile && (leaf || cell.missingList.length > 0) ? (
				<div className="doc-cv-jp-editor-profile">
					<div className="doc-cv-jp-editor-label">This cell reads <span className="doc-cv-jp-editor-leaf-path">{queryOwn}</span> from the profile. Its value there, shared by every CV of the partition {partition || '(none)'}:</div>
					<div className="doc-cv-jp-editor-row">
						<input className="doc-cv-jp-editor-input" aria-label="The value in the profile" value={store.draftProfile} onChange={(event) => store.draftProfileSet(event.target.value)} />
						<button type="button" className="doc-button" disabled={isSubmitting} onClick={profileSave}>Save to the profile</button>
					</div>
				</div>
			) : null}
			{/* a part of the text made a value of the profile: only words, no token in part or whole */}
			{selection && profile ? (
				<div className="doc-cv-jp-editor-profile">
					<div className="doc-cv-jp-editor-label">Keep the selected words in the profile, and name them here by their path: <span className="doc-cv-jp-editor-leaf-path">{selection.text.length > 40 ? `${selection.text.slice(0, 40)}…` : selection.text}</span></div>
					<div className="doc-cv-jp-editor-row">
						<input className="doc-cv-jp-editor-input" aria-label="The path the selected words are kept at" placeholder="Their path: address/jp/building" value={store.extractPath} disabled={!selection.isPlain} onChange={(event) => store.extractPathSet(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !extractProblem) { event.preventDefault(); event.stopPropagation(); void store.selectionExtract(profile, info, partition); } }} />
						<button type="button" className="doc-button" disabled={isSubmitting || extractProblem !== ''} title={extractProblem || `Written into the profile (partition ${partition || '(none)'}), and replaced here by {{${store.extractPath.trim()}}}`} onClick={() => store.selectionExtract(profile, info, partition)}>Keep in the profile</button>
					</div>
					{!selection.isPlain || store.extractPath.trim() !== '' ? <div className="doc-cv-jp-editor-hint">{extractProblem || `The cell will say {{${store.extractPath.trim()}}} in their place.`}</div> : null}
				</div>
			) : null}
			{store.message ? <p className="doc-cv-jp-editor-missing" role="alert">{store.message}</p> : null}
			<div className="doc-cv-jp-editor-actions">
				{cell.isOverride ? <button type="button" className="doc-button" disabled={isSubmitting} onClick={() => store.cellReset(service, instanceAsset, instanceData)}>Back to the template</button> : null}
				<span className="doc-cv-jp-editor-space" />
				<EditSlashToggle slash={edit?.cell?.slash} />
				<button type="button" className="doc-button" onClick={store.editorClose}>Cancel</button>
				<button type="button" className="doc-button" data-primary="" disabled={isSubmitting} onClick={() => edit?.cellSave()}>Save in this CV</button>
			</div>
		</CvJpCard>
	);
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
	const problem = !cell.query ? 'The template of this CV gives the photo itself, so it is changed there.' : !profile ? 'This CV names no profile to keep a photo in.' : profileProblem;
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

const CvJpRowCard = observer(function CvJpRowCard({ store, service, instanceAsset, instanceData }) {
	const edit = useContext(CvJpEditContext);
	const { group, row } = store.editor;
	const isSubmitting = store.status === 'submitting';
	const isOfProfile = Boolean(row) && !row.isExtra;
	return (
		<CvJpCard store={store}>
			<div className="doc-cv-jp-editor-head">
				<span>{isOfProfile ? 'A row of the profile, shown by every CV reading it' : row ? 'A row only this CV has' : 'A new row only this CV has'}</span>
			</div>
			<div className="doc-cv-jp-editor-hint">Tab next field · Enter saves · Shift+Enter a new line · Esc cancels</div>
			{store.message ? <p className="doc-cv-jp-editor-missing" role="alert">{store.message}</p> : null}
			<div className="doc-cv-jp-editor-actions">
				{row ? <button type="button" className="doc-button" disabled={isSubmitting} onClick={() => store.rowRemove(service, instanceAsset, instanceData)}>{isOfProfile ? 'Leave out of this CV' : 'Remove'}</button> : null}
				{group.isOrderOwn ? <button type="button" className="doc-button" disabled={isSubmitting} title="This CV orders the rows of this list itself (dragged)" onClick={() => store.rowOrderReset(service, instanceAsset, instanceData, group)}>Order by time</button> : null}
				<span className="doc-cv-jp-editor-space" />
				<button type="button" className="doc-button" onClick={store.editorClose}>Cancel</button>
				<button type="button" className="doc-button" data-primary="" disabled={isSubmitting} onClick={() => edit?.rowSave()}>Save</button>
			</div>
		</CvJpCard>
	);
});

// what is not drawn now and can be: the optional rows, the rows left out of this CV
const CvJpFieldList = observer(function CvJpFieldList({ sheet, store, service, instanceAsset, instanceData }) {
	const edit = useContext(CvJpEditContext);
	const buttonRef = useRef(null);
	const optionalList = sheet.rowOptionalList.filter((row) => !row.isShown).flatMap((row) => row.cellList);
	const hiddenList = sheet.sectionList.flatMap((section) => (section.groupList ?? []).flatMap((group) => group.rowList.filter((row) => row.isHidden).map((row) => ({ group, row }))));
	return (
		<span className="doc-cv-jp-field">
			<button ref={buttonRef} type="button" className="doc-button" aria-expanded={store.isFieldListOpen} onClick={store.fieldListToggle}>More fields ({optionalList.length + hiddenList.length})</button>
			{store.isFieldListOpen ? (
				<div className="doc-cv-jp-field-list" data-cv-jp-editor="">
					{optionalList.map((one) => (
						<button key={one.id} type="button" className="doc-cv-jp-field-item" onClick={() => store.cellOpen(one.cell, buttonRef.current, one.cell.leaf?.value ?? '', { isOffSheet: true })}>{one.label}</button>
					))}
					{hiddenList.map(({ group, row }) => (
						<button
							key={row.id}
							type="button"
							className="doc-cv-jp-field-item"
							title="Show it in this CV again"
							onClick={() => { store.rowOpen(group, row, null); store.rowRemove(service, instanceAsset, instanceData); store.fieldListToggle(); }}
						>
							{row.year} {edit?.cell ? edit.cell.textGet(row.text) : row.text}
						</button>
					))}
					{optionalList.length + hiddenList.length === 0 ? <span className="doc-note">Everything is drawn.</span> : null}
				</div>
			) : null}
		</span>
	);
});

// the bar of the pages: how many, printing them, downloading them
const CvJpPagesBar = observer(function CvJpPagesBar({ store, pageFlowRef }) {
	const { status, pageCount } = store.pageState;
	const isReady = status === 'done' && pageCount > 0;
	const profile = pageFlowPrintProfileGet();
	const [isDownloading, setIsDownloading] = useState(false);
	const download = async () => {
		setIsDownloading(true);
		try {
			await pageFlowRef.current?.pdfDownload();
		} finally {
			setIsDownloading(false);
		}
	};
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
			<button type="button" className="doc-button" disabled={!isReady || isDownloading} title="Download the pages as a PDF of images: the same in every browser" onClick={download}>
				<Download size={12} aria-hidden="true" /><span>{isDownloading ? 'Making the PDF…' : 'Download PDF'}</span>
			</button>
		</>
	);
});

export const CvJpSheet = observer(function CvJpSheet({ data = {}, config = {} }) {
	const service = config.objectFrontend;
	const param = data.param ?? {};
	const [store] = useState(() => new CvJpStore(param.instance));
	const pageFlowRef = useRef(null);
	const instanceList = service ? service.assetList(CV_KIND_INSTANCE) : [];
	// the CV drawn: the one named; else the first of the partition asked for; else the first
	const instanceOfPartition = param.partition ? instanceList.find((asset) => cvPathSplit(asset.pathList?.[0]).partition === param.partition) : undefined;
	const instanceAsset = store.instanceRef ? service?.assetGet(store.instanceRef) : param.partition ? instanceOfPartition : instanceList[0];
	const instanceRead = instanceAsset ? service.assetDataGet(instanceAsset.key) : undefined;
	const instance = cvJpInstanceRead(instanceRead?.data);
	const instanceData = instanceRead?.data ?? {};
	const templateRef = instance.template || service?.assetList(CV_KIND_TEMPLATE)[0]?.key;
	const templateRead = templateRef ? service?.assetDataGet(templateRef) : undefined;
	const profileRef = instance.profile || param.profile || service?.object.metadata?.profile || '';
	const profile = profileRef && service ? service.otherGet(profileRef) : undefined;
	const date = cvJpDateGet(instance.asOf);
	// a CV reads the profile of its own partition: the first folder of its path (doc/README.md#partitions)
	const partition = cvPathSplit(instanceAsset?.pathList?.[0]).partition;
	const profileRead = profile ? cvProfileRead(profile, cvJpDateVirtualBuild(date), partition) : undefined;
	const info = profileRead?.info ?? cvInfoBuild([]);
	const badgeRead = profile ? cvBadgeRead(profile, partition) : undefined;
	// the document left edit mode, or the object cannot be written any more: the sheet reads again
	const isEditable = service?.isEditable === true;
	// the profile is another object: its values and badges are written while it can be
	const isProfileEditable = isEditable && profile?.isWritable === true;
	// the cell of the sheet's texts: the CV's own token kinds, a query and a badge of the profile,
	// before the kinds of the page (a link, a view of an object). what they read is the profile
	// as it is at this render: the cell keeps the context current, for a token drawn and for the
	// menu listing while the author types
	const cell = useCell({
		tokenList: [cvQueryToken, cvBadgeToken],
		context: {
			info,
			dateNow: date,
			badge: badgeRead,
			isEditing: store.isEditing,
			isProfileEditable,
			profileUnavailableReason: isProfileEditable ? '' : profile?.writeUnavailableReason || service?.editUnavailableReason || 'the profile cannot be written now',
			badgeCreate: (path) => store.badgeCreate(profile, partition, path),
			badgeWrite: (badge, change) => store.badgeWrite(profile, badge, change),
		},
		config,
	});
	const edit = {
		cell,
		// the values of this sheet among the cells of the page: what a selected token is known by
		keyPrefix: config.instanceId ?? 'cv',
		cellSave: () => store.cellSave(service, instanceAsset, instanceData),
		rowSave: () => store.rowSave(service, profile, instanceAsset, instanceData),
		// a token changed from its card: the text written at once, without opening its editor
		cellTextWrite: (cellOne, text) => store.cellTextWrite(service, instanceAsset, instanceData, cellOne, text),
		rowFieldWrite: (group, row, field, text) => store.rowFieldWrite(service, profile, instanceAsset, instanceData, group, row, field, text),
		drop: (group) => store.drop(service, instanceAsset, instanceData, group),
		// what is open is saved: a click elsewhere, another row added, a row dragged
		leave: () => {
			if (store.editor?.kind === 'cell') void store.cellSave(service, instanceAsset, instanceData);
			else if (store.editor?.kind === 'row') void store.rowSave(service, profile, instanceAsset, instanceData);
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
	if (!instanceAsset) return <p className="doc-note">{store.instanceRef ? `There is no CV at ${store.instanceRef}.` : param.partition ? `The partition ${param.partition} has no CV yet: the mode "CVs" of this object makes one.` : 'This object has no CV yet: its mode "CVs" makes one.'}</p>;
	// the badges are read with the rest: one arriving later would make its row taller under the reader
	const isLoading = instanceRead?.status === 'loading' || templateRead?.status === 'loading' || (profileRead?.countLoading ?? 0) > 0 || (badgeRead?.countLoading ?? 0) > 0 || (profile && profile.object.status === 'loading');
	if (isLoading) return <p className="doc-note doc-cv-jp-loading">Reading the CV{profileRead?.countAll ? ` (${profileRead.countAll - profileRead.countLoading} of ${profileRead.countAll})` : ''}…</p>;
	if (instanceRead?.status !== 'done') return <p className="doc-error">{instanceRead?.message}</p>;
	const template = cvJpTemplateRead(templateRead?.status === 'done' ? templateRead.data : CV_JP_TEMPLATE_DEFAULT);
	// cellTextGet: the plain text of a cell, every token as text (what is compared and counted)
	const context = { dateNow: date, cellTextGet: cell.textGet };
	const sheet = cvJpSheetBuild({ template, instance, info, context });
	const titleFile = instanceAsset.name || instanceRead.data?.name || 'cv';
	return (
		<CvJpEditContext.Provider value={edit}>
			<div ref={store.rootElementSet} className="doc-cv-jp not-prose">
				<div className="doc-cv-jp-bar">
					{instanceList.length > 1 ? (
						<select aria-label="The CV" className="doc-cv-jp-select" value={instanceAsset.key} onChange={(event) => { store.instanceSet(event.target.value); }}>
							{cvInstanceByPartitionGet(instanceList).map(([partitionOne, assetList]) => (
								<optgroup key={partitionOne} label={partitionOne || '(no partition)'}>
									{assetList.map((asset) => <option key={asset.key} value={asset.key}>{asset.name || asset.pathList?.[0] || asset.key}</option>)}
								</optgroup>
							))}
						</select>
					) : null}
					<span className="doc-cv-jp-editor-space" />
					<button type="button" className="doc-button" title="The CV on A4 pages, as printed: preview, print, download" onClick={store.pagesOpen}>
						<Files size={12} aria-hidden="true" /><span>Pages…</span>
					</button>
					{store.isEditing ? <CvJpFieldList sheet={sheet} store={store} service={service} instanceAsset={instanceAsset} instanceData={instanceData} /> : null}
					{/* editing the CV is offered while the document is edited; in reading mode the sheet
					    only reads (react-doc: main/doc_page_impl_obj_frontend.md#reading-and-editing) */}
					{service.docState?.isEditing ? (
						<button type="button" className="doc-button" data-primary={store.isEditing ? '' : undefined} aria-pressed={store.isEditing} disabled={!service.isEditable} title={service.isEditable ? 'Edit the cells and rows of this CV' : service.editUnavailableReason} onClick={store.editingToggle}>
							<Pencil size={12} aria-hidden="true" /><span>{store.isEditing ? 'Done' : 'Edit'}</span>
						</button>
					) : null}
				</div>
				{!profile ? <p className="doc-error doc-cv-jp-problem">This CV names no profile: profile: frontend:{'{id}'} in its data, or metadata.profile of the object.</p> : null}
				{profile && profile.object.status !== 'found' ? <p className="doc-error doc-cv-jp-problem">The profile {profileRef}: {profile.object.message}</p> : null}
				{[...(profileRead?.problemList ?? []), ...(badgeRead?.problemList ?? [])].map((problem) => <p key={problem} className="doc-error doc-cv-jp-problem">{problem}</p>)}
				<div className="doc-cv-jp-scroll">
					<div className="doc-cv-jp-paper" data-editing={store.isEditing ? '' : undefined}>
						{sheet.sectionList.map((section) => {
							if (section.type === 'basic') return <CvJpBasic key={section.id} sheet={sheet} store={store} />;
							if (section.type === 'history') return <CvJpHistory key={section.id} section={section} store={store} />;
							return <CvJpText key={section.id} section={section} store={store} />;
						})}
					</div>
				</div>
				{store.editor?.kind === 'cell' && store.editor.isImage ? <CvJpPhotoCard store={store} profile={profile} info={info} partition={partition} profileProblem={isProfileEditable ? '' : profile?.writeUnavailableReason || service.editUnavailableReason || 'The profile cannot be written now.'} /> : null}
				{store.editor?.kind === 'cell' && !store.editor.isImage ? <CvJpCellCard store={store} service={service} profile={profile} info={info} partition={partition} context={context} instanceAsset={instanceAsset} instanceData={instanceData} /> : null}
				{store.editor?.kind === 'row' ? <CvJpRowCard store={store} service={service} instanceAsset={instanceAsset} instanceData={instanceData} /> : null}
				{/* the pages, as printed, in a dialog: the sheet stays where it is. the cell of the
				    sheet is around them, so a page draws a token as the sheet does */}
				<PanelPopup
					panelId={`cvJpPages:${config.instanceId ?? ''}`}
					title={`${titleFile}: pages`}
					isOpen={store.isPagesOpen}
					onClose={store.pagesClose}
					className="doc-cv-jp-pages-popup"
					bodyClassName="doc-cv-jp-pages-popup-body"
					headerRightContent={<span className="doc-cv-jp-pages-bar"><CvJpPagesBar store={store} pageFlowRef={pageFlowRef} /></span>}
				>
					<div className="doc-cv-jp-pages not-prose">
						<PageFlow
							ref={pageFlowRef}
							pagination={cvJpPagination}
							pieceList={cvJpPagination.pieceListGet(data, { sheet })}
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
