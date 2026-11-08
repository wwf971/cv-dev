import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Download, Pencil, Printer } from 'lucide-react';
import { EditSlashToggle, EditSourceSurface, PageFlow, pageFlowPrintProfileGet, useEditSlashConfig } from '@wwf971/react-doc';
import { cvPathSplit, cvProfileRead } from '../query/CvProfile.js';
import { cvInfoBuild, cvTextExpand } from '../query/CvQuery.js';
import {
	CV_JP_TEMPLATE_DEFAULT, CV_KIND_INSTANCE, CV_KIND_TEMPLATE, cvJpDateGet, cvJpDateVirtualBuild, cvJpInstanceRead, cvJpSheetBuild, cvJpTemplateRead,
} from './CvJpData.js';
import { CvJpStore } from './CvJpStore.js';
import { cvJpPagination } from './CvJpPagination.jsx';
import { CvJpBasic, CvJpEditContext, CvJpHistory, CvJpText } from './CvJpSection.jsx';
import { cvQuerySlashAction } from './cv-query-slash.js';
import './CvJp.css';

// One CV of the object, drawn as a Japanese-style CV (doc/cv-jp.md). The look follows the
// common form: one A4 width, black rules on white, whatever the theme of the page.
//
// In-place editing (doc/cv-jp.md#editing-in-place): in edit mode a click on a cell makes the cell
// itself the surface its text is typed in (react-doc's EditSourceSurface), showing its words and
// {{queries}} while every other cell shows what it reads; /query inserts a query path, a segment at
// a time. A card under the cell holds the rest. A row of a history opens all its fields at once,
// Tab going through them, and a grip beside it drags it to another place. Nothing of the sheet
// moves: a surface keeps the width of its cell, and only a line break makes it taller.
//
//   param.instance   the CV shown: a path, a key, name:…; absent: the first
//   param.profile    the profile read when the CV names none (else metadata.profile of the object)

// the image a photo cell keeps: small enough to live in a data item as text
function cvJpPhotoRead(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error('the file could not be read'));
		reader.onload = () => {
			const image = new Image();
			image.onerror = () => reject(new Error('the file is not an image'));
			image.onload = () => {
				const scale = Math.min(1, 800 / Math.max(image.width, image.height));
				const canvas = document.createElement('canvas');
				canvas.width = Math.round(image.width * scale);
				canvas.height = Math.round(image.height * scale);
				canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
				resolve(canvas.toDataURL('image/jpeg', 0.88));
			};
			image.src = String(reader.result);
		};
		reader.readAsDataURL(file);
	});
}

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
	const isPhoto = cell.id === 'photo';
	const isMultiline = store.editor.isMultiline === true;
	const preview = cvTextExpand(info, store.draft, context);
	const isSubmitting = store.status === 'submitting';
	// the value in the profile, when this cell is one query
	const { leaf } = cell;
	const queryOwn = cell.query;
	const profileSave = () => (leaf ? store.profileLeafSave(profile, leaf) : store.profileLeafAdd(profile, info, queryOwn, store.draftProfile, partition));
	const photoChoose = async (event) => {
		const file = event.target.files?.[0];
		if (!file) return;
		store.draftProfileSet(await cvJpPhotoRead(file));
		await profileSave();
	};
	return (
		<CvJpCard store={store} onKeyDown={(event) => { if (event.key === 'Escape' && !event.defaultPrevented) { event.stopPropagation(); store.editorClose(); } }}>
			<div className="doc-cv-jp-editor-head">
				<span>{SOURCE_LABEL[cell.source]}</span>
				<span className="doc-cv-jp-editor-hint">{cell.id}</span>
			</div>
			<div className="doc-cv-jp-editor-hint">Type /query for a value of the profile · {isMultiline ? 'Ctrl+Enter' : 'Enter'} saves · Esc cancels</div>
			{isOffSheet ? (
				<div className="doc-cv-jp-editor-surface">
					<EditSourceSurface tag="div" kind="plain" text={store.draft} slash={edit?.slash} isTabInserted={false} ariaLabel={`The text of the cell ${cell.id}`} onTextChange={store.draftSet} onCancelRequest={store.editorClose} onSubmitRequest={() => edit?.cellSave()} />
				</div>
			) : null}
			{!isPhoto ? (
				<div className="doc-cv-jp-editor-preview" data-empty={preview.text === '' ? '' : undefined}>
					<span className="doc-cv-jp-editor-label">Reads</span> {preview.text || '(nothing)'}
				</div>
			) : null}
			{preview.missingList.length > 0 ? <p className="doc-cv-jp-editor-missing">Nothing holds {preview.missingList.join(', ')} yet.</p> : null}
			{queryOwn && profile && (leaf || cell.missingList.length > 0) ? (
				<div className="doc-cv-jp-editor-profile">
					<div className="doc-cv-jp-editor-label">In the profile, for every CV of the partition {partition || '(none)'}: <span className="doc-cv-jp-editor-leaf-path">{queryOwn}</span></div>
					{isPhoto ? (
						<input type="file" accept="image/*" aria-label="The photo" onChange={photoChoose} />
					) : (
						<div className="doc-cv-jp-editor-row">
							<input className="doc-cv-jp-editor-input" aria-label="The value in the profile" value={store.draftProfile} onChange={(event) => store.draftProfileSet(event.target.value)} />
							<button type="button" className="doc-button" disabled={isSubmitting} onClick={profileSave}>Save to the profile</button>
						</div>
					)}
				</div>
			) : null}
			{store.message ? <p className="doc-cv-jp-editor-missing" role="alert">{store.message}</p> : null}
			<div className="doc-cv-jp-editor-actions">
				{cell.isOverride ? <button type="button" className="doc-button" disabled={isSubmitting} onClick={() => store.cellReset(service, instanceAsset, instanceData)}>Back to the template</button> : null}
				<span className="doc-cv-jp-editor-space" />
				<EditSlashToggle slash={edit?.slash} />
				<button type="button" className="doc-button" onClick={store.editorClose}>Cancel</button>
				<button type="button" className="doc-button" data-primary="" disabled={isSubmitting} onClick={() => edit?.cellSave()}>Save in this CV</button>
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
				<span>{isOfProfile ? 'In the profile, for every CV' : row ? 'A row only this CV has' : 'A new row only this CV has'}</span>
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
							{row.year} {row.text}
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
	const [store] = useState(() => new CvJpStore(param.instance, param.view));
	const pageFlowRef = useRef(null);
	// what /query reads when it lists: the profile as it is at this render (the context is handed
	// to the slash mode when it starts, and read when it lists)
	const slashContextRef = useRef({ info: undefined, dateNow: undefined });
	const slash = useEditSlashConfig({ actionList: [cvQuerySlashAction], context: slashContextRef.current });
	const instanceList = service ? service.assetList(CV_KIND_INSTANCE) : [];
	const instanceAsset = store.instanceRef ? service?.assetGet(store.instanceRef) : instanceList[0];
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
	const edit = {
		slash,
		cellSave: () => store.cellSave(service, instanceAsset, instanceData),
		rowSave: () => store.rowSave(service, profile, instanceAsset, instanceData),
		drop: (group) => store.drop(service, instanceAsset, instanceData, group),
		// what is open is saved: a click elsewhere, another row added, a row dragged
		leave: () => {
			if (store.editor?.kind === 'cell') void store.cellSave(service, instanceAsset, instanceData);
			else if (store.editor?.kind === 'row') void store.rowSave(service, profile, instanceAsset, instanceData);
		},
	};
	// the document left edit mode, or the object cannot be written any more: the sheet reads again
	const isEditable = service?.isEditable === true;
	useEffect(() => {
		if (!isEditable) store.editingSet(false);
	}, [isEditable, store]);
	// a click outside what is open (the cell, the row, the card, the menu of /query) saves it
	useEffect(() => {
		if (!store.editor && !store.isFieldListOpen) return undefined;
		const onPointerDown = (event) => {
			if (event.target.closest?.('[data-cv-jp-editor], .doc-edit-popup')) return;
			if (store.isFieldListOpen && !event.target.closest?.('.doc-cv-jp-field')) store.fieldListToggle();
			if (store.editor) edit.leave();
		};
		document.addEventListener('pointerdown', onPointerDown, true);
		return () => document.removeEventListener('pointerdown', onPointerDown, true);
	});
	if (!service) return <p className="doc-error">CvJpSheet is a mode of a frontend object (ObjectFrontend).</p>;
	if (!instanceAsset) return <p className="doc-note">{store.instanceRef ? `There is no CV at ${store.instanceRef}.` : 'This object has no CV yet: its mode "CVs" makes one.'}</p>;
	const isLoading = instanceRead?.status === 'loading' || templateRead?.status === 'loading' || (profileRead?.countLoading ?? 0) > 0 || (profile && profile.object.status === 'loading');
	if (isLoading) return <p className="doc-note doc-cv-jp-loading">Reading the CV{profileRead?.countAll ? ` (${profileRead.countAll - profileRead.countLoading} of ${profileRead.countAll})` : ''}…</p>;
	if (instanceRead?.status !== 'done') return <p className="doc-error">{instanceRead?.message}</p>;
	const template = cvJpTemplateRead(templateRead?.status === 'done' ? templateRead.data : CV_JP_TEMPLATE_DEFAULT);
	const context = { dateNow: date };
	const info = profileRead?.info ?? cvInfoBuild([]);
	slashContextRef.current.info = info;
	slashContextRef.current.dateNow = date;
	const sheet = cvJpSheetBuild({ template, instance, info, context });
	const isPages = store.view === 'pages';
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
					{isPages ? <CvJpPagesBar store={store} pageFlowRef={pageFlowRef} /> : null}
					<span className="doc-edit-segment" role="group" aria-label="View">
						<button type="button" className={!isPages ? 'is-active' : ''} aria-pressed={!isPages} title="The CV as one sheet, edited in place" onClick={() => store.viewSet('sheet')}>Sheet</button>
						<button type="button" className={isPages ? 'is-active' : ''} aria-pressed={isPages} title="The CV on A4 pages, as printed" onClick={() => store.viewSet('pages')}>Pages</button>
					</span>
					{store.isEditing && !isPages ? <CvJpFieldList sheet={sheet} store={store} service={service} instanceAsset={instanceAsset} instanceData={instanceData} /> : null}
					{/* editing the CV is offered while the document is edited; in reading mode the sheet
					    only reads (react-doc: main/doc_page_impl_obj_frontend.md#reading-and-editing) */}
					{service.docState?.isEditing && !isPages ? (
						<button type="button" className="doc-button" data-primary={store.isEditing ? '' : undefined} aria-pressed={store.isEditing} disabled={!service.isEditable} title={service.isEditable ? 'Edit the cells and rows of this CV' : service.editUnavailableReason} onClick={store.editingToggle}>
							<Pencil size={12} aria-hidden="true" /><span>{store.isEditing ? 'Done' : 'Edit'}</span>
						</button>
					) : null}
				</div>
				{!profile ? <p className="doc-error doc-cv-jp-problem">This CV names no profile: profile: frontend:{'{id}'} in its data, or metadata.profile of the object.</p> : null}
				{profile && profile.object.status !== 'found' ? <p className="doc-error doc-cv-jp-problem">The profile {profileRef}: {profile.object.message}</p> : null}
				{(profileRead?.problemList ?? []).map((problem) => <p key={problem} className="doc-error doc-cv-jp-problem">{problem}</p>)}
				{isPages ? (
					<div className="doc-cv-jp-scroll doc-cv-jp-pages">
						<PageFlow
							ref={pageFlowRef}
							pagination={cvJpPagination}
							pieceList={cvJpPagination.pieceListGet(data, { sheet })}
							title={titleFile}
							onStateChange={store.pageStateSet}
						/>
						{store.pageState.problemList.map((problem) => <p key={problem} className="doc-error doc-cv-jp-problem">{problem}</p>)}
					</div>
				) : (
					<div className="doc-cv-jp-scroll">
						<div className="doc-cv-jp-paper" data-editing={store.isEditing ? '' : undefined}>
							{sheet.sectionList.map((section) => {
								if (section.type === 'basic') return <CvJpBasic key={section.id} sheet={sheet} store={store} />;
								if (section.type === 'history') return <CvJpHistory key={section.id} section={section} store={store} />;
								return <CvJpText key={section.id} section={section} store={store} />;
							})}
						</div>
					</div>
				)}
				{store.editor?.kind === 'cell' ? <CvJpCellCard store={store} service={service} profile={profile} info={info} partition={partition} context={context} instanceAsset={instanceAsset} instanceData={instanceData} /> : null}
				{store.editor?.kind === 'row' ? <CvJpRowCard store={store} service={service} instanceAsset={instanceAsset} instanceData={instanceData} /> : null}
			</div>
		</CvJpEditContext.Provider>
	);
});
