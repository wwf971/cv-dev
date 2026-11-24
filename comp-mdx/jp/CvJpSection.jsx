import { createContext, useContext } from 'react';
import { observer } from 'mobx-react-lite';
import { GripVertical, Plus } from 'lucide-react';
import { CellEdit, CellValue } from '@wwf971/react-doc';
import { CvJpRowBreakContext } from './cv-page-break-context.js';
import { cvYearEraGet } from '../query/CvText.js';
import { CV_JP_ROW_FIELD_LIST, cvJpGenderIs, cvJpImageSourceIs, cvJpTextLineListBuild, cvJpTextLineReplace } from './CvJpData.js';
import './CvJp.css';

// The sections both forms draw (doc/cv-sheet.md), and the top of a CV (doc/cv-jp.md): a history
// table, a block (a title line and a free area), and the cells, rows and lines inside them. What
// is the work experience's own, its head and its career, is WeJpSection.jsx. The sheet
// (CvJpSheet.jsx) draws them editable in place, with its store; the pages (CvJpPagination.jsx)
// draw them read-only, a part at a time (CV_JP_STORE_READ). Each says where it may be cut
// (data-page-break), which only pagination reads.

// what the cells and rows need of the sheet: the cell of react-doc's cell editing kit its texts
// are drawn and typed with (the tokens of a text: a query of the profile, a link, a view of an
// object; react-doc: main/doc_page_impl_edit_cell.md), and the writes, bound to the CV drawn
export const CvJpEditContext = createContext(null);

// a surface typed in place: in the flow, as wide as the cell was (a line break makes it taller), or
// floating over a piece inside a line (a year, a month), which keeps its box
//   cell   the cell of the sheet (CvJpEditContext): its surface offers the slash mode of its
//          token kinds; absent (a field of a row): plain text
//   textVersion, onSelectionChange   a text set by code (a selected part made a value of the
//          profile), and what is selected in it
// point: where the click that opened it was: the caret goes there, and a token it is on is marked
// (its card under it); else the one token that is the whole text is (react-doc:
// main/doc_page_impl_edit_cell.md#a-token-marked-in-the-typed-text)
export function CvJpSurface({ text, textVersion = 0, width, offset, isFloat = false, anchorRef, ariaLabel, isFocusedInitial = true, point, cell, onTextChange, onSelectionChange, onCancel, onSubmit }) {
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
				selectionInitial={point ? { type: 'point', clientX: point.clientX, clientY: point.clientY } : 'end'}
				isTokenMarkedOnOpen={isFocusedInitial}
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
//   problem       what is wrong with what the cell reads, beside a query nothing answers (a photo
//                 that is no image): marked as such a cell is, while the sheet is edited
//   isOptional    the form is whole without it (a fact of a project, the end of a period): saying
//                 nothing, it is not marked as a cell whose query nothing answers
//   placeholder   what an empty cell shows while the sheet is edited, so that there is something
//                 to click: what it is for
// A cell drawing its own text (no children) in a box of its own (a cell of a table, a line of the
// address) may have its text stand left, centered or right: cell.align (doc/cv-sheet.md#the-alignment-of-a-cell)
export const CvJpCell = observer(function CvJpCell({ cell, store, as: Tag = 'span', className = '', isMultiline = false, isImage = false, isOptional = false, placeholder = '', problem = '', children, style, ...rest }) {
	const edit = useContext(CvJpEditContext);
	const isMissing = !isOptional && (cell.missingList.length > 0 || problem !== '');
	const isEmptyShown = store.isEditing && placeholder !== '' && cell.text === '' && !isImage;
	const isOpen = store.editor?.kind === 'cell' && store.editor.id === cell.id && !store.editor.isOffSheet;
	// a piece inside a line, or a cell too narrow for a query to be read in it (a name, a day):
	// the surface floats over it instead of wrapping into a tall column
	const isFloat = isOpen && !isImage && (Tag === 'span' || (store.editor.width ?? 0) < CV_JP_SURFACE_WIDTH_MIN);
	const onClick = store.isEditing && !isOpen ? (event) => {
		event.stopPropagation();
		store.cellOpen(cell, event.currentTarget, cell.leaf?.value ?? '', { isMultiline, isImage, isAlignable: !isImage && children === undefined, point: { clientX: event.clientX, clientY: event.clientY } });
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
			style={cell.align ? { ...style, textAlign: cell.align } : style}
			data-align={cell.align || undefined}
			data-editable={store.isEditing ? '' : undefined}
			data-open={isOpen ? '' : undefined}
			data-float={isOpen && isFloat ? '' : undefined}
			data-cv-jp-editor={isOpen ? '' : undefined}
			data-missing={store.isEditing && isMissing && !isOpen ? '' : undefined}
			data-empty={isEmptyShown && !isOpen ? '' : undefined}
			title={store.isEditing && !isOpen ? (problem || (isImage ? 'Choose the photo' : isMissing ? `nothing holds ${cell.missingList.join(', ')}` : cell.raw)) : undefined}
			onClick={onClick}
			onKeyDown={onKeyDown}
		>
			{!isOpen || isImage ? (isEmptyShown ? <span className="doc-cv-jp-cell-placeholder">{placeholder}</span> : (children ?? <CvJpCellText cell={cell} store={store} />)) : (
				<>
					{isFloat ? <span className="doc-cv-jp-cell-hold" aria-hidden="true">{children ?? <CvJpCellText cell={cell} store={CV_JP_STORE_READ} />}</span> : null}
					<CvJpSurface
						key={cell.id}
						text={store.draft}
						textVersion={store.draftVersion}
						onSelectionChange={store.selectionSet}
						point={store.editor.point}
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

// the lines of a text, drawn (doc/cv-sheet.md#blocks): a paragraph, an item of a list with its
// lines going on under its text, a small heading, a label with what it says beside it (labels one
// under another line up, as a table without rules would). Every line is drawn with its tokens, on
// the sheet and on its pages. A token of a line is changed from its card where the text holds no
// query: its lines are then the lines of the text as written.
//   lineList   cvJpTextLineListBuild of the text; index: the place of a line in the whole text,
//              kept by a part of a block cut for a page
//   isBreak    every line is a place a page may cut the block after (data-page-break)
export const CvJpLineList = observer(function CvJpLineList({ lineList, cell, store, isBreak = false }) {
	const edit = useContext(CvJpEditContext);
	const isTokenEditable = store.isEditing && cell.isQueryFree === true;
	const lineDraw = (line, index) => {
		if (!edit?.cell) return line.text;
		return (
			<CellValue
				cell={edit.cell}
				text={line.text}
				isEditable={isTokenEditable}
				cellKey={`${edit.keyPrefix}:cell:${cell.id}:${index}`}
				onTextChange={(text) => edit.cellTextWrite(cell, cvJpTextLineReplace(cell.raw, index, line.start, text))}
			/>
		);
	};
	const elementList = [];
	let labelGroup = null;
	lineList.forEach((line, at) => {
		const index = line.index ?? at;
		const breakKey = isBreak ? `line-${index}` : undefined;
		if (line.kind === 'label') {
			if (!labelGroup) {
				labelGroup = [];
				elementList.push(<div key={`group-${index}`} className="doc-cv-jp-line-group">{labelGroup}</div>);
			}
			labelGroup.push(
				<span key={`label-${index}`} className="doc-cv-jp-line-label">{line.label}</span>,
				<div key={`value-${index}`} className="doc-cv-jp-line-value" data-page-break={breakKey}>{lineDraw(line, index)}</div>,
			);
			return;
		}
		labelGroup = null;
		if (line.kind === 'bullet') {
			elementList.push(
				<div key={index} className="doc-cv-jp-line" data-kind="bullet" data-page-break={breakKey}>
					<span className="doc-cv-jp-line-mark">{line.mark}</span>
					<div className="doc-cv-jp-line-body">{lineDraw(line, index)}</div>
				</div>,
			);
			return;
		}
		elementList.push(<div key={index} className="doc-cv-jp-line" data-kind={line.kind} data-page-break={line.kind === 'blank' ? undefined : breakKey}>{line.kind === 'blank' ? null : lineDraw(line, index)}</div>);
	});
	return elementList;
});

// the lines of what a cell says: of a cell of the sheet, or of one a page keeps
export function cvJpCellLineListGet(cell) {
	return cvJpTextLineListBuild(cell.textExpanded ?? cell.text);
}

// the title of a section as a cell: the sheet's, or made of the title a page's piece keeps
export function cvJpTitleCellGet(section) {
	return section.titleCell ?? { id: `${section.id}:title`, text: String(section.title ?? ''), raw: String(section.title ?? ''), missingList: [] };
}

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

// the top of a CV: its title and date, the name, birth, address, contacts, and the photo at the
// right; a part without a photo (section.isPhoto false) has the form the whole width
export const CvJpBasic = observer(function CvJpBasic({ sheet, section, store }) {
	const cell = sheet.cellGet;
	const isPhoto = section?.isPhoto !== false;
	// the widths of the columns of its form, as its options say (doc/cv-sheet.md#the-options-of-a-part)
	const widthKeyStyle = Number(section?.widthKey) > 0 ? { width: `${section.widthKey}px` } : undefined;
	const widthEndStyle = Number(section?.widthEnd) > 0 ? { width: `${section.widthEnd}px` } : undefined;
	const cellGender = cell('gender');
	const cellPhoto = cell('photo');
	// its optional rows, as its options say (doc/cv-sheet.md#the-options-of-a-part): those of the
	// residence in the form, the links under it
	const rowList = section?.rowOptionalList ?? sheet.rowOptionalList ?? [];
	const rowFormList = rowList.filter((row) => row.id !== 'link' && row.isShown);
	const rowLink = rowList.find((row) => row.id === 'link');
	// a row of one cell has it across the rest of the row
	const rowOptionalDraw = (row) => (
		<tr key={row.id}>
			<td className="doc-cv-jp-key">{row.cellList[0].label}</td>
			<CvJpCell as="td" cell={row.cellList[0].cell} store={store} className="doc-cv-jp-value" colSpan={row.cellList.length === 1 ? 3 : undefined} />
			{row.cellList[1] ? <td className="doc-cv-jp-key">{row.cellList[1].label}</td> : null}
			{row.cellList[1] ? <CvJpCell as="td" cell={row.cellList[1].cell} store={store} className="doc-cv-jp-value" /> : null}
		</tr>
	);
	return (
		<div className="doc-cv-jp-basic" data-photo={isPhoto ? undefined : 'none'}>
			<div className="doc-cv-jp-head">
				<div className="doc-cv-jp-title">履 歴 書</div>
				<CvJpCell cell={cell('date')} store={store} className="doc-cv-jp-date" />
			</div>
			<div className="doc-cv-jp-basic-body">
				<div className="doc-cv-jp-form">
					<table className="doc-cv-jp-table doc-cv-jp-table-name">
						<tbody>
							<tr className="doc-cv-jp-row-furigana">
								<td className="doc-cv-jp-key doc-cv-jp-key-width" style={widthKeyStyle}>ふりがな</td>
								<CvJpCell as="td" cell={cell('name-furigana-last')} store={store} className="doc-cv-jp-name-part doc-cv-jp-furigana" />
								<CvJpCell as="td" cell={cell('name-furigana-first')} store={store} className="doc-cv-jp-name-part doc-cv-jp-furigana" />
								<td className="doc-cv-jp-name-rest" />
							</tr>
							<tr className="doc-cv-jp-row-name">
								<td className="doc-cv-jp-key doc-cv-jp-key-width doc-cv-jp-key-spaced" style={widthKeyStyle}>氏 名</td>
								<CvJpCell as="td" cell={cell('name-last')} store={store} className="doc-cv-jp-name-part doc-cv-jp-name" />
								<CvJpCell as="td" cell={cell('name-first')} store={store} className="doc-cv-jp-name-part doc-cv-jp-name" />
								<td className="doc-cv-jp-name-rest" />
							</tr>
						</tbody>
					</table>
					<table className="doc-cv-jp-table doc-cv-jp-table-form">
						<colgroup><col className="doc-cv-jp-key-width" style={widthKeyStyle} /><col /><col className="doc-cv-jp-key-width" style={widthKeyStyle} /><col className="doc-cv-jp-col-end" style={widthEndStyle} /></colgroup>
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
							{rowFormList.map(rowOptionalDraw)}
						</tbody>
					</table>
				</div>
				{/* drawn only when it reads an image; any other text leaves the box empty, marked in edit mode */}
				{isPhoto ? <CvJpCell cell={cellPhoto} store={store} className="doc-cv-jp-photo" as="div" isImage problem={cellPhoto.text && !cvJpImageSourceIs(cellPhoto.text) ? `The photo reads "${cellPhoto.text.length > 40 ? `${cellPhoto.text.slice(0, 40)}…` : cellPhoto.text}", which is no image: choose the photo` : ''}>
					{cvJpImageSourceIs(cellPhoto.text) ? <img src={cellPhoto.text} alt="" className="doc-cv-jp-photo-image" /> : <CvJpPhotoPlaceholder />}
				</CvJpCell> : null}
			</div>
			{rowLink?.isShown ? (
				<table className="doc-cv-jp-table doc-cv-jp-table-form doc-cv-jp-table-link">
					<colgroup><col className="doc-cv-jp-key-width" style={widthKeyStyle} /><col /><col className="doc-cv-jp-key-width" style={widthKeyStyle} /><col /></colgroup>
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
//   isEra   the year has its era above it (the way of the paper, doc/cv-sheet.md#a-year-with-its-era)
export const CvJpRow = observer(function CvJpRow({ group, row, store, isEra = true }) {
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
				point={store.editor.field === name ? store.editor.point : undefined}
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
				{isEra ? <div className="doc-cv-jp-era">{cvYearEraGet(value?.year, value?.month)}</div> : null}
				{field('year', <div>{row?.year}</div>)}
			</td>
			<td ref={anchorRef('month')} className="doc-cv-jp-time" data-field="month" onClick={open('month')} onFocus={focusTrack('month')}>{field('month', row?.month)}</td>
			<td ref={anchorRef('text')} colSpan={group.isNote ? 1 : 2} className="doc-cv-jp-text" data-field="text" onClick={open('text')} onFocus={focusTrack('text')}>
					{/* a badge drawn in its text is a place the row may be cut at on pages (cv-page-break.js) */}
					<CvJpRowBreakContext.Provider value={row?.id ?? ''}>{field('text', row ? <CvJpRowText group={group} row={row} name="text" store={store} /> : null)}</CvJpRowBreakContext.Provider>
				</td>
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
		<table className="doc-cv-jp-table doc-cv-jp-table-history" data-cut-below={section.isCutBelow || section.isLast ? '' : undefined}>
			<colgroup><col className="doc-cv-jp-col-time" /><col className="doc-cv-jp-col-time" /><col /><col className="doc-cv-jp-col-note" /></colgroup>
			<tbody>
				<tr className="doc-cv-jp-row-head">
					<td>年</td>
					<td>月</td>
					<CvJpCell as="td" cell={cvJpTitleCellGet(section)} store={store} colSpan={section.isNote ? 1 : 2} className="doc-cv-jp-title-cell" isOptional placeholder="タイトル" />
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
						...rowList.map((row) => <CvJpRow key={row.id} group={group} row={row} store={store} isEra={section.isEra !== false} />),
						store.editor?.kind === 'row' && store.editor.id === `new:${group.id}` ? <CvJpRow key={`new:${group.id}`} group={group} store={store} isEra={section.isEra !== false} /> : null,
						rowList.length === 0 && store.editor?.id !== `new:${group.id}` ? (
							<tr key={`${group.id}-empty`} className="doc-cv-jp-row doc-cv-jp-row-empty" data-page-break={`${group.id}-empty`}>
								<td className="doc-cv-jp-time" /><td className="doc-cv-jp-time" />
								{/* a query of the rows that reads no entry: said while the sheet is edited, as a cell whose query nothing answers */}
								{store.isEditing && group.isListEmpty ? (
									<td colSpan={group.isNote ? 1 : 2} className="doc-cv-jp-text" data-missing="" title={`nothing of the profile is at ${group.list}: no entry has a year there, or none says what ${group.list} chooses`}>
										<span className="doc-cv-jp-row-empty-note">{`{{${group.list}}}`} reads no entry of the profile</span>
									</td>
								) : <td colSpan={group.isNote ? 1 : 2} className="doc-cv-jp-text" />}
								{group.isNote ? <td className="doc-cv-jp-note" /> : null}
							</tr>
						) : null,
					];
				})}
				{fillHeight > 1 && groupLast ? (
					// the rest of the page under the last row: its columns' rules down to the bottom. a last
					// row cut inside, going on on the next page, goes on into it: no rule between them
					<tr className="doc-cv-jp-row-fill" aria-hidden="true" data-goes-on={groupLast.rowList.at(-1)?.isCutInside ? '' : undefined} style={{ height: `${fillHeight}px` }}>
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

// a block (a section of the type text, doc/cv-sheet.md#blocks): a title line and a free area below
// it, whose text is drawn a line at a time (CvJpLineList). A block without a title has no title
// line; while the sheet is edited the line is there to type one. Laid out on pages it is cut
// between its lines: every line is a place to cut (data-page-break)
//   section.heightMin   the least height of its free area in px (the box of a paper form)
//   section.isIndent    its paragraphs start with an indent
export const CvJpText = observer(function CvJpText({ section, store, fillHeight = 0 }) {
	const titleCell = cvJpTitleCellGet(section);
	const lineList = section.lineList ?? cvJpCellLineListGet(section.cell);
	const heightMin = Number(section.heightMin) > 0 ? Number(section.heightMin) : 0;
	return (
		<table className="doc-cv-jp-table doc-cv-jp-table-text" data-cut-below={section.isCutBelow || section.isLast ? '' : undefined}>
			<tbody>
				{titleCell.text !== '' || store.isEditing ? (
					<tr className="doc-cv-jp-row-head"><CvJpCell as="td" cell={titleCell} store={store} className="doc-cv-jp-title-cell" isOptional placeholder="タイトル" /></tr>
				) : null}
				<tr>
					<CvJpCell as="td" cell={section.cell} store={store} className="doc-cv-jp-paragraph" isMultiline placeholder="ここに文章を書きます" data-indent={section.isIndent ? '' : undefined} style={heightMin > 0 ? { height: `${heightMin}px` } : undefined}>
						<CvJpLineList lineList={lineList} cell={section.cell} store={store} isBreak />
						{fillHeight > 0 ? <span className="doc-cv-jp-fill" style={{ height: `${fillHeight}px` }} /> : null}
					</CvJpCell>
				</tr>
			</tbody>
		</table>
	);
});

// the line closing a paper, at the right under everything: 以上
export const CvJpClosing = observer(function CvJpClosing({ section, store }) {
	return <CvJpCell as="div" cell={section.cell} store={store} className="doc-cv-jp-closing" isOptional placeholder="以上" />;
});

// 最終学歴, briefly (doc/we-jp.md#最終学歴): its title across the table, a row naming the columns, then
// one row: 年月, the school (with its faculty or graduate school), its status and the degree; each a
// cell reading the latest education of the profile. never cut on pages
//   section   cellDate, cellSchool, cellStatus, cellDegree, titleCell; isDegree: the column of the degree
export const CvJpEducation = observer(function CvJpEducation({ section, store }) {
	const isDegree = section.isDegree !== false;
	return (
		<table className="doc-cv-jp-table doc-cv-jp-table-education" data-cut-below={section.isLast ? '' : undefined}>
			<colgroup><col className="doc-cv-jp-col-edu-date" /><col /><col className="doc-cv-jp-col-edu-status" />{isDegree ? <col className="doc-cv-jp-col-edu-degree" /> : null}</colgroup>
			<tbody>
				<tr className="doc-cv-jp-row-head">
					<CvJpCell as="td" cell={cvJpTitleCellGet(section)} store={store} colSpan={isDegree ? 4 : 3} className="doc-cv-jp-title-cell" isOptional placeholder="タイトル" />
				</tr>
				<tr className="doc-cv-jp-row-label">
					<td>年 月</td>
					<td>学 校 名</td>
					<td>状 況</td>
					{isDegree ? <td>学 位</td> : null}
				</tr>
				<tr className="doc-cv-jp-row doc-cv-jp-row-education">
					<CvJpCell as="td" cell={section.cellDate} store={store} className="doc-cv-jp-edu-date" />
					<CvJpCell as="td" cell={section.cellSchool} store={store} className="doc-cv-jp-edu-school" placeholder="学校名" />
					<CvJpCell as="td" cell={section.cellStatus} store={store} className="doc-cv-jp-edu-status" placeholder="卒業・修了…" />
					{isDegree ? <CvJpCell as="td" cell={section.cellDegree} store={store} className="doc-cv-jp-edu-degree" isOptional placeholder="学位" /> : null}
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

