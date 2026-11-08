import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { GripVertical, Pencil, Plus } from 'lucide-react';
import { EditSlashToggle, EditSourceSurface, useEditSlashConfig } from '@wwf971/react-doc';
import { cvPathSplit, cvProfileRead } from '../query/CvProfile.js';
import { cvInfoBuild, cvTextExpand } from '../query/CvQuery.js';
import { cvYearEraGet } from '../query/CvText.js';
import {
	CV_JP_ROW_FIELD_LIST, CV_JP_TEMPLATE_DEFAULT, CV_KIND_INSTANCE, CV_KIND_TEMPLATE, cvJpDateGet, cvJpDateVirtualBuild, cvJpGenderIs, cvJpInstanceRead, cvJpSheetBuild, cvJpTemplateRead,
} from './CvJpData.js';
import { CvJpStore } from './CvJpStore.js';
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

// what the cells and rows need of the sheet while editing: the slash mode of their surfaces and
// the writes, bound to the CV drawn
const CvJpEditContext = createContext(null);

// a surface typed in place: in the flow, as wide as the cell was (a line break makes it taller), or
// floating over a piece inside a line (a year, a month), which keeps its box
function CvJpSurface({ text, width, offset, isFloat = false, anchorRef, ariaLabel, isFocusedInitial = true, slash, onTextChange, onCancel, onSubmit }) {
	return (
		<span
			ref={anchorRef}
			className={`doc-cv-jp-surface-box${isFloat ? ' doc-cv-jp-surface-float' : ''}`}
			style={isFloat
				? { minWidth: width ? `${Math.ceil(width)}px` : undefined, top: `${offset?.top ?? 0}px`, left: `${offset?.left ?? 0}px` }
				: { width: width ? `${width}px` : '100%' }}
		>
			<EditSourceSurface
				tag="div"
				kind="plain"
				text={text}
				slash={slash}
				isFocusedInitial={isFocusedInitial}
				isTabInserted={false}
				ariaLabel={ariaLabel}
				onTextChange={onTextChange}
				onCancelRequest={onCancel}
				onSubmitRequest={onSubmit}
			/>
		</span>
	);
}

// the narrowest cell a surface is typed in in place; a narrower one floats its surface
const CV_JP_SURFACE_WIDTH_MIN = 160;

// one piece of text a click opens in place; the box it fills stays the same in both modes
//   isMultiline   Enter is a line break (a paragraph); elsewhere Enter saves and Shift+Enter breaks
const CvJpCell = observer(function CvJpCell({ cell, store, as: Tag = 'span', className = '', isMultiline = false, children, ...rest }) {
	const edit = useContext(CvJpEditContext);
	const isMissing = cell.missingList.length > 0;
	const isOpen = store.editor?.kind === 'cell' && store.editor.id === cell.id && !store.editor.isOffSheet;
	// a piece inside a line, or a cell too narrow for a query to be read in it (a name, a day):
	// the surface floats over it instead of wrapping into a tall column
	const isFloat = isOpen && (Tag === 'span' || (store.editor.width ?? 0) < CV_JP_SURFACE_WIDTH_MIN);
	const onClick = store.isEditing && !isOpen ? (event) => {
		event.stopPropagation();
		store.cellOpen(cell, event.currentTarget, cell.leaf?.value ?? '', { isMultiline });
	} : undefined;
	const onKeyDown = isOpen ? (event) => {
		// the surface and its slash menu take their keys first
		if (event.defaultPrevented || event.nativeEvent?.isComposing) return;
		if (event.key === 'Enter' && !event.shiftKey && !isMultiline) {
			event.preventDefault();
			edit?.cellSave();
		} else if (event.key === 'Tab') event.preventDefault();
	} : undefined;
	return (
		<Tag
			{...rest}
			ref={isOpen && !isFloat ? store.anchorSet : undefined}
			className={`doc-cv-jp-cell ${className}`}
			data-editable={store.isEditing ? '' : undefined}
			data-open={isOpen ? '' : undefined}
			data-float={isOpen && isFloat ? '' : undefined}
			data-cv-jp-editor={isOpen ? '' : undefined}
			data-missing={store.isEditing && isMissing && !isOpen ? '' : undefined}
			title={store.isEditing && !isOpen ? (isMissing ? `nothing holds ${cell.missingList.join(', ')}` : cell.raw) : undefined}
			onClick={onClick}
			onKeyDown={onKeyDown}
		>
			{!isOpen ? (children ?? cell.text) : (
				<>
					{isFloat ? <span className="doc-cv-jp-cell-hold" aria-hidden="true">{children ?? cell.text}</span> : null}
					<CvJpSurface
						key={cell.id}
						text={store.draft}
						width={store.editor.width}
						offset={store.editor.offset}
						isFloat={isFloat}
						anchorRef={isFloat ? store.anchorSet : undefined}
						ariaLabel={`The text of the cell ${cell.id}`}
						slash={edit?.slash}
						onTextChange={store.draftSet}
						onCancel={store.editorClose}
						onSubmit={() => edit?.cellSave()}
					/>
				</>
			)}
		</Tag>
	);
});

function CvJpPhotoPlaceholder() {
	return (
		<div className="doc-cv-jp-photo-placeholder">
			<div className="doc-cv-jp-photo-title">写真をはる位置</div>
			<div className="doc-cv-jp-photo-note">
				<div>写真をはる必要がある場合</div>
				<div>1. 縦 36〜40mm 横 24〜30mm</div>
				<div>2. 本人単身胸から上</div>
				<div>3. 裏面のりづけ</div>
			</div>
		</div>
	);
}

const CvJpBasic = observer(function CvJpBasic({ sheet, store }) {
	const cell = sheet.cellGet;
	const cellGender = cell('gender');
	const cellPhoto = cell('photo');
	const [rowResidence, rowLink] = sheet.rowOptionalList;
	const rowOptionalDraw = (row) => (
		<tr key={row.id}>
			<td className="doc-cv-jp-key">{row.cellList[0].label}</td>
			<CvJpCell as="td" cell={row.cellList[0].cell} store={store} className="doc-cv-jp-value" />
			<td className="doc-cv-jp-key">{row.cellList[1].label}</td>
			<CvJpCell as="td" cell={row.cellList[1].cell} store={store} className="doc-cv-jp-value" />
		</tr>
	);
	return (
		<div className="doc-cv-jp-basic">
			<div className="doc-cv-jp-head">
				<div className="doc-cv-jp-title">履 歴 書</div>
				<CvJpCell cell={cell('date')} store={store} className="doc-cv-jp-date" />
			</div>
			<div className="doc-cv-jp-basic-body">
				<div className="doc-cv-jp-form">
					<table className="doc-cv-jp-table doc-cv-jp-table-name">
						<tbody>
							<tr className="doc-cv-jp-row-furigana">
								<td className="doc-cv-jp-key doc-cv-jp-key-width">ふりがな</td>
								<CvJpCell as="td" cell={cell('name-furigana-last')} store={store} className="doc-cv-jp-name-part doc-cv-jp-furigana" />
								<CvJpCell as="td" cell={cell('name-furigana-first')} store={store} className="doc-cv-jp-name-part doc-cv-jp-furigana" />
								<td className="doc-cv-jp-name-rest" />
							</tr>
							<tr className="doc-cv-jp-row-name">
								<td className="doc-cv-jp-key doc-cv-jp-key-width doc-cv-jp-key-spaced">氏 名</td>
								<CvJpCell as="td" cell={cell('name-last')} store={store} className="doc-cv-jp-name-part doc-cv-jp-name" />
								<CvJpCell as="td" cell={cell('name-first')} store={store} className="doc-cv-jp-name-part doc-cv-jp-name" />
								<td className="doc-cv-jp-name-rest" />
							</tr>
						</tbody>
					</table>
					<table className="doc-cv-jp-table doc-cv-jp-table-form">
						<colgroup><col className="doc-cv-jp-key-width" /><col /><col className="doc-cv-jp-key-width" /><col className="doc-cv-jp-col-end" /></colgroup>
						<tbody>
							<tr>
								<td className="doc-cv-jp-key">生年月日</td>
								<td colSpan={2} className="doc-cv-jp-value">
									<div className="doc-cv-jp-birth">
										<span className="doc-cv-jp-birth-year">
											<CvJpCell cell={cell('birth-era')} store={store} className="doc-cv-jp-era" />
											<span><CvJpCell cell={cell('birth-year')} store={store} />年</span>
										</span>
										<span><CvJpCell cell={cell('birth-month')} store={store} />月<CvJpCell cell={cell('birth-day')} store={store} />日</span>
										<span className="doc-cv-jp-age">（満<CvJpCell cell={cell('age')} store={store} />歳）</span>
									</div>
								</td>
								<CvJpCell as="td" cell={cellGender} store={store} className="doc-cv-jp-gender-cell">
									<div className="doc-cv-jp-gender">
										<span>※</span>
										<span>
											<span className="doc-cv-jp-gender-option" data-selected={cvJpGenderIs(cellGender.text, 'male') ? '' : undefined}>男</span>
											<span>・</span>
											<span className="doc-cv-jp-gender-option" data-selected={cvJpGenderIs(cellGender.text, 'female') ? '' : undefined}>女</span>
										</span>
										<span />
									</div>
								</CvJpCell>
							</tr>
							<tr>
								<td className="doc-cv-jp-key">住所</td>
								<td colSpan={3} className="doc-cv-jp-value">
									<CvJpCell cell={cell('postal')} store={store} className="doc-cv-jp-postal" />
									<CvJpCell cell={cell('address')} store={store} className="doc-cv-jp-address" />
								</td>
							</tr>
							<tr className="doc-cv-jp-row-contact">
								<td className="doc-cv-jp-key">メール<br />アドレス</td>
								<CvJpCell as="td" cell={cell('email')} store={store} className="doc-cv-jp-value doc-cv-jp-value-center" />
								<td className="doc-cv-jp-key">電話番号</td>
								<CvJpCell as="td" cell={cell('phone')} store={store} className="doc-cv-jp-value doc-cv-jp-value-center" />
							</tr>
							{rowResidence.isShown ? rowOptionalDraw(rowResidence) : null}
						</tbody>
					</table>
				</div>
				<CvJpCell cell={cellPhoto} store={store} className="doc-cv-jp-photo" as="div">
					{cellPhoto.text ? <img src={cellPhoto.text} alt="" className="doc-cv-jp-photo-image" /> : <CvJpPhotoPlaceholder />}
				</CvJpCell>
			</div>
			{rowLink.isShown ? (
				<table className="doc-cv-jp-table doc-cv-jp-table-form doc-cv-jp-table-link">
					<colgroup><col className="doc-cv-jp-key-width" /><col /><col className="doc-cv-jp-key-width" /><col /></colgroup>
					<tbody>{rowOptionalDraw(rowLink)}</tbody>
				</table>
			) : null}
		</div>
	);
});

// a row of a history. In edit mode a click opens every field of it in place, the one clicked
// focused; Tab and Shift+Tab go through them, Enter saves, Shift+Enter breaks a line, Escape
// cancels. A grip in the margin drags it to another place in its group
const CvJpRow = observer(function CvJpRow({ group, row, store }) {
	const edit = useContext(CvJpEditContext);
	const rowId = row?.id ?? `new:${group.id}`;
	const isOpen = store.editor?.kind === 'row' && store.editor.id === rowId;
	const value = isOpen ? store.draftRow : row;
	const fieldList = CV_JP_ROW_FIELD_LIST.filter((field) => field !== 'note' || group.isNote);
	const open = (field) => (store.isEditing && !isOpen ? (event) => {
		event.stopPropagation();
		store.rowOpen(group, row, event.currentTarget.closest('tr'), { field });
	} : undefined);
	const onKeyDown = isOpen ? (event) => {
		if (event.defaultPrevented || event.nativeEvent?.isComposing) return;
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			edit?.rowSave();
			return;
		}
		if (event.key !== 'Tab') return;
		event.preventDefault();
		const at = fieldList.indexOf(store.editor.field) + (event.shiftKey ? -1 : 1);
		const surface = event.currentTarget.querySelector(`[data-field="${fieldList[at]}"] .doc-edit-surface`);
		if (surface) surfaceFocusAtEnd(surface);
	} : undefined;
	const field = (name, content) => {
		if (!isOpen) return content;
		return (
			<CvJpSurface
				key={`${rowId}:${name}`}
				text={String(store.draftRow[name] ?? '')}
				width={store.editor.widthByField?.[name]}
				isFocusedInitial={store.editor.field === name}
				ariaLabel={`The ${name} of the row`}
				onTextChange={(text) => store.draftRowSet({ [name]: text })}
				onCancel={store.editorClose}
				onSubmit={() => edit?.rowSave()}
			/>
		);
	};
	const focusTrack = (name) => (isOpen ? (event) => store.rowFieldFocus(name, event.currentTarget) : undefined);
	const anchorRef = (name) => (isOpen && store.editor.field === name ? store.anchorSet : undefined);
	const dropAt = store.dropTarget?.rowId === rowId ? (store.dropTarget.isAfter ? 'after' : 'before') : undefined;
	const isDraggable = store.isEditing && !isOpen && Boolean(row);
	return (
		<tr
			className="doc-cv-jp-row"
			data-editable={store.isEditing ? '' : undefined}
			data-open={isOpen ? '' : undefined}
			data-cv-jp-editor={isOpen ? '' : undefined}
			data-drop={dropAt}
			data-dragging={store.dragRow?.rowId === rowId ? '' : undefined}
			onKeyDown={onKeyDown}
			onDragOver={row ? (event) => {
				const rect = event.currentTarget.getBoundingClientRect();
				if (store.dragOver(group, row, event.clientY > rect.top + rect.height / 2)) event.preventDefault();
			} : undefined}
			onDrop={row ? (event) => {
				event.preventDefault();
				edit?.drop(group);
			} : undefined}
		>
			<td ref={anchorRef('year')} className="doc-cv-jp-time" data-field="year" onClick={open('year')} onFocus={focusTrack('year')}>
				{isDraggable ? (
					<span
						className="doc-cv-jp-row-grip"
						draggable
						title="Drag to another place in this list"
						aria-label="Drag the row"
						onClick={(event) => event.stopPropagation()}
						onDragStart={(event) => {
							event.dataTransfer.effectAllowed = 'move';
							event.dataTransfer.setData('text/plain', rowId);
							const tr = event.currentTarget.closest('tr');
							if (tr) event.dataTransfer.setDragImage(tr, 12, tr.offsetHeight / 2);
							edit?.leave();
							store.dragStart(group, row);
						}}
						onDragEnd={store.dragEnd}
					>
						<GripVertical size={14} aria-hidden="true" />
					</span>
				) : null}
				<div className="doc-cv-jp-era">{cvYearEraGet(value?.year, value?.month)}</div>
				{field('year', <div>{row?.year}</div>)}
			</td>
			<td ref={anchorRef('month')} className="doc-cv-jp-time" data-field="month" onClick={open('month')} onFocus={focusTrack('month')}>{field('month', row?.month)}</td>
			<td ref={anchorRef('text')} colSpan={group.isNote ? 1 : 2} className="doc-cv-jp-text" data-field="text" onClick={open('text')} onFocus={focusTrack('text')}>{field('text', row?.text)}</td>
			{group.isNote ? <td ref={anchorRef('note')} className="doc-cv-jp-note" data-field="note" onClick={open('note')} onFocus={focusTrack('note')}>{field('note', row?.note)}</td> : null}
		</tr>
	);
});

// the caret at the end of a surface given the focus
function surfaceFocusAtEnd(surface) {
	surface.focus({ preventScroll: true });
	const range = document.createRange();
	range.selectNodeContents(surface);
	range.collapse(false);
	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
}

const CvJpHistory = observer(function CvJpHistory({ section, store }) {
	return (
		<table className="doc-cv-jp-table doc-cv-jp-table-history">
			<colgroup><col className="doc-cv-jp-col-time" /><col className="doc-cv-jp-col-time" /><col /><col className="doc-cv-jp-col-note" /></colgroup>
			<tbody>
				<tr className="doc-cv-jp-row-head">
					<td>年</td>
					<td>月</td>
					<td colSpan={section.isNote ? 1 : 2}>{section.title}</td>
					{section.isNote ? <td>備 考{store.isEditing && section.groupList[0] && !section.groupList[0].title ? <CvJpRowAdd group={section.groupList[0]} store={store} /> : null}</td> : null}
				</tr>
				{section.groupList.map((group) => {
					const rowList = group.rowList.filter((row) => !row.isHidden);
					return [
						group.title ? (
							<tr key={`${group.id}-head`} className="doc-cv-jp-row-group">
								<td colSpan={group.isNote ? 3 : 4}>
									{group.title}
									{store.isEditing && !group.isNote ? <CvJpRowAdd group={group} store={store} /> : null}
								</td>
								{group.isNote ? <td>備 考<CvJpRowAdd group={group} store={store} isShown={store.isEditing} /></td> : null}
							</tr>
						) : null,
						...rowList.map((row) => <CvJpRow key={row.id} group={group} row={row} store={store} />),
						store.editor?.kind === 'row' && store.editor.id === `new:${group.id}` ? <CvJpRow key={`new:${group.id}`} group={group} store={store} /> : null,
						rowList.length === 0 && store.editor?.id !== `new:${group.id}` ? (
							<tr key={`${group.id}-empty`} className="doc-cv-jp-row doc-cv-jp-row-empty">
								<td className="doc-cv-jp-time" /><td className="doc-cv-jp-time" /><td colSpan={group.isNote ? 1 : 2} className="doc-cv-jp-text" />{group.isNote ? <td className="doc-cv-jp-note" /> : null}
							</tr>
						) : null,
					];
				})}
			</tbody>
		</table>
	);
});

// a row of this CV added: floats on the edge of the heading, so that it moves nothing
const CvJpRowAdd = observer(function CvJpRowAdd({ group, store, isShown = true }) {
	const edit = useContext(CvJpEditContext);
	if (!isShown) return null;
	return (
		<button type="button" className="doc-cv-jp-row-add" title="A row only this CV has" onClick={(event) => { event.stopPropagation(); edit?.leave(); store.rowOpen(group, undefined, null); }}>
			<Plus size={12} aria-hidden="true" />
		</button>
	);
});

const CvJpText = observer(function CvJpText({ section, store }) {
	return (
		<table className="doc-cv-jp-table doc-cv-jp-table-text">
			<tbody>
				<tr className="doc-cv-jp-row-head"><td>{section.title}</td></tr>
				<tr><CvJpCell as="td" cell={section.cell} store={store} className="doc-cv-jp-paragraph" isMultiline /></tr>
			</tbody>
		</table>
	);
});

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

export const CvJpSheet = observer(function CvJpSheet({ data = {}, config = {} }) {
	const service = config.objectFrontend;
	const param = data.param ?? {};
	const [store] = useState(() => new CvJpStore(param.instance));
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
				{(profileRead?.problemList ?? []).map((problem) => <p key={problem} className="doc-error doc-cv-jp-problem">{problem}</p>)}
				<div className="doc-cv-jp-scroll">
					<div className="doc-cv-jp-paper" data-editing={store.isEditing ? '' : undefined}>
						{sheet.sectionList.map((section) => {
							if (section.type === 'basic') return <CvJpBasic key={section.id} sheet={sheet} store={store} />;
							if (section.type === 'history') return <CvJpHistory key={section.id} section={section} store={store} />;
							return <CvJpText key={section.id} section={section} store={store} />;
						})}
					</div>
				</div>
				{store.editor?.kind === 'cell' ? <CvJpCellCard store={store} service={service} profile={profile} info={info} partition={partition} context={context} instanceAsset={instanceAsset} instanceData={instanceData} /> : null}
				{store.editor?.kind === 'row' ? <CvJpRowCard store={store} service={service} instanceAsset={instanceAsset} instanceData={instanceData} /> : null}
			</div>
		</CvJpEditContext.Provider>
	);
});
