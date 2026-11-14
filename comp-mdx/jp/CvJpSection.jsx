import { createContext, useContext } from 'react';
import { observer } from 'mobx-react-lite';
import { GripVertical, Plus } from 'lucide-react';
import { CellEdit, CellValue } from '@wwf971/react-doc';
import { cvYearEraGet } from '../query/CvText.js';
import { CV_JP_ROW_FIELD_LIST, cvJpGenderIs } from './CvJpData.js';
import './CvJp.css';

// The sections of a Japanese-style CV as they are drawn (doc/cv-jp.md): the top of the form, a
// history table, a section of text, and the cells and rows inside them. The sheet
// (CvJpSheet.jsx) draws them editable in place, with its store; the pages (CvJpPagination.jsx)
// draw them read-only, a part at a time (CV_JP_STORE_READ). Each says where it may be cut
// (data-page-break, data-page-text), which only pagination reads.

// what the cells and rows need of the sheet: the cell of react-doc's cell edit layer its texts
// are drawn and typed with (the tokens of a text: a query of the profile, a link, a view of an
// object; react-doc: main/doc_page_impl_edit_cell.md), and the writes, bound to the CV drawn
export const CvJpEditContext = createContext(null);

// a surface typed in place: in the flow, as wide as the cell was (a line break makes it taller), or
// floating over a piece inside a line (a year, a month), which keeps its box
//   cell   the cell of the sheet (CvJpEditContext): its surface offers the slash mode of its
//          token kinds; absent (a field of a row): plain text
//   textVersion, onSelectionChange   a text set by code (a selected part made a value of the
//          profile), and what is selected in it
export function CvJpSurface({ text, textVersion = 0, width, offset, isFloat = false, anchorRef, ariaLabel, isFocusedInitial = true, cell, onTextChange, onSelectionChange, onCancel, onSubmit }) {
	return (
		<span
			ref={anchorRef}
			className={`doc-cv-jp-surface-box${isFloat ? ' doc-cv-jp-surface-float' : ''}`}
			style={isFloat
				? { minWidth: width ? `${Math.ceil(width)}px` : undefined, top: `${offset?.top ?? 0}px`, left: `${offset?.left ?? 0}px` }
				: { width: width ? `${width}px` : '100%' }}
		>
			<CellEdit
				cell={cell}
				text={text}
				textVersion={textVersion}
				isFocusedInitial={isFocusedInitial}
				ariaLabel={ariaLabel}
				onTextChange={onTextChange}
				onSelectionChange={onSelectionChange}
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
//   isImage       the cell is an image (the photo): a click opens its card only, and the cell stays
//                 as drawn: there is no text to type in it
export const CvJpCell = observer(function CvJpCell({ cell, store, as: Tag = 'span', className = '', isMultiline = false, isImage = false, children, ...rest }) {
	const edit = useContext(CvJpEditContext);
	const isMissing = cell.missingList.length > 0;
	const isOpen = store.editor?.kind === 'cell' && store.editor.id === cell.id && !store.editor.isOffSheet;
	// a piece inside a line, or a cell too narrow for a query to be read in it (a name, a day):
	// the surface floats over it instead of wrapping into a tall column
	const isFloat = isOpen && !isImage && (Tag === 'span' || (store.editor.width ?? 0) < CV_JP_SURFACE_WIDTH_MIN);
	const onClick = store.isEditing && !isOpen ? (event) => {
		event.stopPropagation();
		store.cellOpen(cell, event.currentTarget, cell.leaf?.value ?? '', { isMultiline, isImage });
	} : undefined;
	const onKeyDown = isOpen && !isImage ? (event) => {
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
			title={store.isEditing && !isOpen ? (isImage ? 'Choose the photo' : isMissing ? `nothing holds ${cell.missingList.join(', ')}` : cell.raw) : undefined}
			onClick={onClick}
			onKeyDown={onKeyDown}
		>
			{!isOpen || isImage ? (children ?? <CvJpCellText cell={cell} store={store} />) : (
				<>
					{isFloat ? <span className="doc-cv-jp-cell-hold" aria-hidden="true">{children ?? <CvJpCellText cell={cell} store={CV_JP_STORE_READ} />}</span> : null}
					<CvJpSurface
						key={cell.id}
						text={store.draft}
						textVersion={store.draftVersion}
						onSelectionChange={store.selectionSet}
						width={store.editor.width}
						offset={store.editor.offset}
						isFloat={isFloat}
						anchorRef={isFloat ? store.anchorSet : undefined}
						ariaLabel={`The text of the cell ${cell.id}`}
						cell={edit?.cell}
						onTextChange={store.draftSet}
						onCancel={store.editorClose}
						onSubmit={() => edit?.cellSave()}
					/>
				</>
			)}
		</Tag>
	);
});

// what a cell says, drawn: every token by its kind (a query as its value, a link as a link, a
// badge as its image, an object by its view), on the sheet and on its pages alike. Without the
// cell of a sheet around it (a piece drawn alone), and for a section of text on a page (cut
// between the lines of its plain text), its plain text. While the sheet is edited, a token
// with a card (a badge) is selected by a click and changed from the card beside it
const CvJpCellText = observer(function CvJpCellText({ cell, store }) {
	const edit = useContext(CvJpEditContext);
	if (!edit?.cell || cell.isPlain) return cell.text;
	return (
		<CellValue
			cell={edit.cell}
			text={cell.raw}
			isEditable={store.isEditing}
			cellKey={`${edit.keyPrefix}:cell:${cell.id}`}
			onTextChange={(text) => edit.cellTextWrite(cell, text)}
		/>
	);
});

// the text or the note of a row, drawn the same way: a row of a history is made of cells too
const CvJpRowText = observer(function CvJpRowText({ group, row, name, store }) {
	const edit = useContext(CvJpEditContext);
	const text = String(row?.[name] ?? '');
	if (!edit?.cell) return text;
	return (
		<CellValue
			cell={edit.cell}
			text={text}
			isEditable={store.isEditing}
			cellKey={`${edit.keyPrefix}:row:${group.id}:${row?.id}:${name}`}
			onTextChange={(textNext) => edit.rowFieldWrite(group, row, name, textNext)}
		/>
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

export const CvJpBasic = observer(function CvJpBasic({ sheet, store }) {
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
				<CvJpCell cell={cellPhoto} store={store} className="doc-cv-jp-photo" as="div" isImage>
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
// cancels. A grip in the margin drags it to another place in its group. Its text and its note
// are cells as the cells of the top are: they hold tokens (a badge beside a licence, a link),
// typed with the same slash mode; the year and the month are plain
export const CvJpRow = observer(function CvJpRow({ group, row, store }) {
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
				cell={CV_JP_ROW_FIELD_CELL_LIST.includes(name) ? edit?.cell : undefined}
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
			data-page-break={row ? rowId : undefined}
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
			<td ref={anchorRef('text')} colSpan={group.isNote ? 1 : 2} className="doc-cv-jp-text" data-field="text" onClick={open('text')} onFocus={focusTrack('text')}>{field('text', row ? <CvJpRowText group={group} row={row} name="text" store={store} /> : null)}</td>
			{group.isNote ? <td ref={anchorRef('note')} className="doc-cv-jp-note" data-field="note" onClick={open('note')} onFocus={focusTrack('note')}>{field('note', row ? <CvJpRowText group={group} row={row} name="note" store={store} /> : null)}</td> : null}
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

// a history table. Laid out on pages (CvJpPagination.jsx) it is cut between rows: every row
// is a place to cut (data-page-break), a group's heading is not (it goes with its first row), a
// part goes on with its group's rows without the heading again (isContinued), a part cut
// below has no margin under it (isCutBelow), and fillHeight draws its rules to the page's bottom
export const CvJpHistory = observer(function CvJpHistory({ section, store, fillHeight = 0 }) {
	const groupLast = section.groupList[section.groupList.length - 1];
	return (
		<table className="doc-cv-jp-table doc-cv-jp-table-history" data-cut-below={section.isCutBelow ? '' : undefined}>
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
						group.title && !group.isContinued ? (
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
							<tr key={`${group.id}-empty`} className="doc-cv-jp-row doc-cv-jp-row-empty" data-page-break={`${group.id}-empty`}>
								<td className="doc-cv-jp-time" /><td className="doc-cv-jp-time" /><td colSpan={group.isNote ? 1 : 2} className="doc-cv-jp-text" />{group.isNote ? <td className="doc-cv-jp-note" /> : null}
							</tr>
						) : null,
					];
				})}
				{fillHeight > 1 && groupLast ? (
					// the rest of the page under the last row: its columns' rules down to the bottom
					<tr className="doc-cv-jp-row-fill" aria-hidden="true" style={{ height: `${fillHeight}px` }}>
						<td /><td /><td colSpan={groupLast.isNote ? 1 : 2} />{groupLast.isNote ? <td /> : null}
					</tr>
				) : null}
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

// a section of text. Laid out on pages it is cut between lines of its text (data-page-text);
// a part going on has no indent of its first line (isContinued)
export const CvJpText = observer(function CvJpText({ section, store, fillHeight = 0 }) {
	return (
		<table className="doc-cv-jp-table doc-cv-jp-table-text" data-cut-below={section.isCutBelow ? '' : undefined}>
			<tbody>
				<tr className="doc-cv-jp-row-head"><td>{section.title}</td></tr>
				<tr>
					<CvJpCell as="td" cell={section.cell} store={store} className="doc-cv-jp-paragraph" isMultiline data-page-text="text" data-continued={section.isContinued ? '' : undefined}>
						{fillHeight > 0 ? <>{section.cell.text}<span className="doc-cv-jp-fill" style={{ height: `${fillHeight}px` }} /></> : undefined}
					</CvJpCell>
				</tr>
			</tbody>
		</table>
	);
});

// what the sections are drawn with where nothing is edited (the pages of a CV): a store that
// is never editing
export const CV_JP_STORE_READ = Object.freeze({ isEditing: false, editor: null, dragRow: null, dropTarget: null, draft: '', draftRow: {} });

// the fields of a row that are cells: they hold tokens beside words
const CV_JP_ROW_FIELD_CELL_LIST = ['text', 'note'];

