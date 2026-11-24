import { makeAutoObservable, observable } from 'mobx';
import { cellTextRangeReplace } from '@wwf971/react-doc';
import { CV_KIND_BADGE, CV_KIND_ID_BADGE, cvBadgeCreateInput } from '../query/CvBadge.js';
import { CV_INFO_FOLDER, cvDataRemove, cvDataSet, cvLeafPlaceGet, cvLeafValueBuild, cvQueryParse, cvQueryResolve } from '../query/CvQuery.js';
import { CV_KIND_ID_INFO, CV_KIND_INFO, cvInfoCreateInput, cvKindNameOf } from '../query/CvProfile.js';
import {
	CV_JP_CELL_PDF_TITLE, CV_JP_ROW_FIELD_LIST, cvJpRowIdNew, cvJpRowOrderMove, cvJpSectionCellIdList, cvJpSectionLabelGet, cvJpSectionNew, cvJpSectionOrderInsert, cvJpSectionOrderMove,
} from './CvJpData.js';
import { WE_JP_FACT_LABEL, weJpCareerItemNew, weJpFactNew } from './WeJpData.js';

// The state of one drawn sheet, a CV or a work experience (doc/cv-sheet.md): which paper, in-place
// editing, the cell or row being edited, a row being dragged. Every write goes through the api of
// the objects (config.objectFrontend): a paper's own text into its item, a value of the profile
// into the profile's item.
//
// In-place editing (doc/cv-sheet.md#editing-in-place): the cell itself becomes the surface its text
// is typed in; the card under it holds the rest (where the text comes from, the value in the
// profile, saving). Nothing of the sheet moves when a cell opens: the surface keeps the cell's
// width, and only a line break makes it taller.
//
//   editor   what is open, or null:
//     { kind: 'cell', id, cell, point, width, offset, isOffSheet }
//        point       where the click was: the caret goes there
//        width       the content width of the cell when it opened: the surface keeps it
//        offset      { top, left } of its content in it: a floating surface starts where its text was
//        isOffSheet  the cell is not drawn (an optional row not shown): its text is typed in the card
//     { kind: 'row', id, group, row, field, point, widthByField }
//        row         undefined for a new row of this CV
//        field       the field focused: year, month, text, note
//   anchorElement   what the card stands under: the open cell, the focused field of the row
//   selection       what is selected in the text of the open cell: { start, end, text, isPlain }
//                   (react-doc's CellEdit). a selection of words only can be kept in the profile
//                   as a value and named in its place (selectionExtract); extractPath: the path
//                   typed for it. draftVersion: the draft was set by code, the surface shows it again
//   isPagesOpen     the pages of the CV are shown, in their dialog
export class CvJpStore {
	instanceRef = '';
	isEditing = false;
	isFieldListOpen = false;
	editor = null;
	anchorElement = null;
	draft = '';
	draftVersion = 0;
	selection = null;
	extractPath = '';
	// the card asking the path selected words are kept at in the profile is open
	isExtractOpen = false;
	draftProfile = '';
	draftRow = { year: '', month: '', text: '', note: '' };
	status = 'idle';
	message = '';
	rootElement = null;
	// a row dragged to another place in its group: { groupId, rowId }, and where it would go
	dragRow = null;
	dropTarget = null;
	// the pages of the CV (CvJpPagination.jsx), as printed, shown in a dialog over the page
	isPagesOpen = false;
	// what the pages say of themselves: { status: measuring | done, pageCount, problemList }
	pageState = { status: 'measuring', pageCount: 0, problemList: [] };
	// the download of the pages as a PDF: { status: idle | running | done | error, kind, message }
	//   kind      what the last one was: text (printed by a browser of the development server's
	//             machine) or image (drawn in the page: the fallback); message: why an image
	pdfState = { status: 'idle', kind: '', message: '' };
	// the menu of parts open (CvJpPart.jsx): { mode: add | part, point, sectionIdAfter, sectionId }, or null
	partMenu = null;
	// the part whose options are shown in their panel (CvJpPart.jsx CvJpPartOptionPanel), or ''
	partOptionSectionId = '';
	// the history of the block (cv-edit-history.js), set by the sheet: the writes of one writeRun
	// are one step of it (a badge's data and its name)
	history = null;

	constructor(instanceRef) {
		this.instanceRef = instanceRef ?? '';
		makeAutoObservable(this, { rootElement: observable.ref, editor: observable.ref, anchorElement: observable.ref, selection: observable.ref, partMenu: observable.ref, history: false }, { autoBind: true });
	}

	rootElementSet(element) {
		this.rootElement = element;
	}

	instanceSet(ref) {
		this.instanceRef = ref;
		this.editorClose();
	}

	editingSet(isEditing) {
		if (this.isEditing === isEditing) return;
		this.isEditing = isEditing;
		if (!isEditing) this.editorClose();
	}

	editingToggle() {
		this.isEditing = !this.isEditing;
		this.isFieldListOpen = false;
		this.editorClose();
	}

	pagesOpen() {
		if (this.editor) this.editorClose();
		this.isFieldListOpen = false;
		this.isPagesOpen = true;
	}

	pagesClose() {
		this.isPagesOpen = false;
	}

	pageStateSet(state) {
		this.pageState = { status: state.status, pageCount: state.pageCount, problemList: state.problemList ?? [] };
	}

	// the pages downloaded as a PDF (pageFlow: the ref of react-doc's PageFlow), and what was made
	async pdfDownload(pageFlow) {
		if (!pageFlow || this.pdfState.status === 'running') return;
		this.pdfState = { status: 'running', kind: '', message: '' };
		let result;
		try {
			result = await pageFlow.pdfDownload();
		} catch (error) {
			result = { code: -1, message: String(error?.message ?? error) };
		}
		this.pdfStateSet(result?.code === 0
			? { status: 'done', kind: result.data?.kind ?? '', message: result.data?.reason ?? '' }
			: { status: 'error', kind: '', message: result?.message ?? 'the PDF was not made' });
	}

	pdfStateSet(state) {
		this.pdfState = state;
	}

	partMenuOpen(menu) {
		this.isFieldListOpen = false;
		this.partMenu = menu;
	}

	partMenuClose() {
		this.partMenu = null;
	}

	partOptionOpen(sectionId) {
		this.partMenu = null;
		this.partOptionSectionId = sectionId;
	}

	partOptionClose() {
		this.partOptionSectionId = '';
	}

	fieldListToggle() {
		this.isFieldListOpen = !this.isFieldListOpen;
	}

	fieldListClose() {
		this.isFieldListOpen = false;
	}

	anchorSet(element) {
		if (element && element !== this.anchorElement) this.anchorElement = element;
	}

	// a cell opened in place: element is the cell, point where it was clicked
	//   isImage       the cell is an image (the photo): nothing is typed in it, its card gives the image
	//   isAlignable   the cell draws its own text: in a box of its own (a cell of a table, a line), its
	//                 text may be set left, centered or right (alignDefault: how its form stands it)
	cellOpen(cell, element, valueProfile, { point, isOffSheet = false, isMultiline = false, isImage = false, isAlignable = false } = {}) {
		if (!this.isEditing) return;
		this.isFieldListOpen = false;
		const alignDefault = isAlignable && !isOffSheet ? alignOfFormGet(element) : '';
		this.editor = {
			kind: 'cell', id: cell.id, cell, point, width: isOffSheet ? undefined : contentWidthGet(element), offset: isOffSheet ? undefined : contentOffsetGet(element), isOffSheet, isMultiline, isImage,
			isAlignable: alignDefault !== '', alignDefault,
		};
		this.anchorElement = element;
		this.draft = cell.raw;
		this.selection = null;
		this.extractPath = '';
		this.isExtractOpen = false;
		this.draftProfile = valueProfile ?? '';
		this.status = 'idle';
		this.message = '';
	}

	// a row opened in place, every field a surface; field: the one clicked
	rowOpen(group, row, element, { field = 'text', point } = {}) {
		if (!this.isEditing) return;
		const widthByField = {};
		for (const one of CV_JP_ROW_FIELD_LIST) {
			const td = element?.querySelector?.(`[data-field="${one}"]`);
			if (td) widthByField[one] = contentWidthGet(td);
		}
		this.editor = { kind: 'row', id: row?.id ?? `new:${group.id}`, group, row, field, point, widthByField };
		this.anchorElement = element?.querySelector?.(`[data-field="${field}"]`) ?? element;
		this.draftRow = { year: row?.year ?? '', month: row?.month ?? '', text: row?.text ?? '', note: row?.note ?? '' };
		this.status = 'idle';
		this.message = '';
	}

	rowFieldFocus(field, element) {
		if (this.editor?.kind !== 'row') return;
		if (this.editor.field !== field) this.editor = { ...this.editor, field };
		this.anchorSet(element);
	}

	editorClose() {
		this.editor = null;
		this.anchorElement = null;
		this.selection = null;
		this.extractPath = '';
		this.isExtractOpen = false;
		this.status = 'idle';
		this.message = '';
	}

	draftSet(text) {
		this.draft = text;
	}

	extractOpenSet(isOpen) {
		this.isExtractOpen = isOpen;
	}

	// what is selected in the text of the open cell (the last selection inside it)
	selectionSet(selection) {
		const one = selection && selection.end > selection.start ? selection : null;
		if (one === null && this.selection === null) return;
		if (one && this.selection && one.start === this.selection.start && one.end === this.selection.end && one.text === this.selection.text) return;
		this.selection = one;
		this.message = '';
	}

	extractPathSet(text) {
		this.extractPath = text;
		this.message = '';
	}

	// why the selected words cannot be kept in the profile at the path typed ('' when they can):
	// only words are kept (no token in the selection, in part or whole), at a path nothing holds yet
	extractProblemGet(info) {
		const selection = this.selection;
		if (!selection || selection.text.trim() === '') return 'Select some words of the cell.';
		if (!selection.isPlain) return 'The selection holds a token, in part or whole: select words only.';
		const { segmentList } = cvQueryParse(this.extractPath);
		if (segmentList.length === 0) return 'Name the path it is kept at: address/jp/building.';
		const resolved = cvQueryResolve(info, segmentList.join('/'));
		if (resolved.status === 'found' && resolved.value !== selection.text) return `${segmentList.join('/')} holds ${String(resolved.value).slice(0, 40)} already.`;
		return '';
	}

	// the selected words kept in the profile as a value at the path typed, and named in their place
	// by a query of it: the cell reads the same, and every CV can now read the value. a path
	// holding exactly those words already is only named
	async selectionExtract(profile, info, partition) {
		const problem = this.extractProblemGet(info);
		if (problem) {
			this.message = problem;
			return false;
		}
		const { start, end, text } = this.selection;
		const path = cvQueryParse(this.extractPath).segmentList.join('/');
		const editorAtStart = this.editor;
		if (cvQueryResolve(info, path).status !== 'found') {
			this.status = 'submitting';
			const place = cvLeafPlaceGet(info, path);
			let result;
			try {
				result = place.assetKey
					? await profile.assetWrite(place.assetKey, cvDataSet(profile.assetDataGet(place.assetKey).data, place.keyPath, text), path)
					: await profile.assetCreate(cvInfoCreateInput(partition, place, place.keyPath.length > 0 ? cvDataSet({}, place.keyPath, text) : text, cvKindNameOf(profile, CV_KIND_ID_INFO, CV_KIND_INFO)));
			} catch (error) {
				result = { code: -1, message: String(error?.message ?? error) };
			}
			this.extractResultApply(result, editorAtStart, start, end, path);
			return result?.code === 0 || result === undefined;
		}
		this.extractResultApply({ code: 0 }, editorAtStart, start, end, path);
		return true;
	}

	extractResultApply(result, editorAtStart, start, end, path) {
		if (result?.code !== 0 && result !== undefined) {
			this.status = 'error';
			this.message = result?.message ?? 'the value was not written';
			return;
		}
		this.status = 'idle';
		// the cell may be another one when the answer comes: the draft of that one is left alone
		if (this.editor !== editorAtStart) return;
		this.draft = cellTextRangeReplace(this.draft, start, end, `{{${path}}}`);
		this.draftVersion += 1;
		this.selection = null;
		this.extractPath = '';
		this.isExtractOpen = false;
		this.message = '';
	}

	messageSet(text) {
		this.message = String(text ?? '');
	}

	draftProfileSet(text) {
		this.draftProfile = text;
	}

	draftRowSet(change) {
		this.draftRow = { ...this.draftRow, ...change };
	}

	// isEditorKept: the write is not the save of what is open (a badge made while a cell is
	// typed, a token changed from its card): the editor stays as it is
	async writeRun(write, { isEditorKept = false } = {}) {
		// the editor may be another one when the answer comes (a click on the next cell saves this one)
		const editorAtStart = this.editor;
		this.status = 'submitting';
		this.message = '';
		let result;
		try {
			result = await (this.history ? this.history.stepRun(write) : write());
		} catch (error) {
			result = { code: -1, message: String(error?.message ?? error) };
		}
		if (result?.code === 0 || result === undefined) {
			if (this.editor === editorAtStart && !isEditorKept) this.editorClose();
			else this.status = 'idle';
			return true;
		}
		this.status = 'error';
		this.message = result?.message ?? 'the write failed';
		return false;
	}

	// the text of a cell written at once, without its editor: a token of it changed from its card
	// (a badge given another size, taken out)
	cellTextWrite(service, instanceAsset, instanceData, cell, text) {
		if (text === cell.raw) return Promise.resolve(true);
		return this.writeRun(() => service.assetWrite(instanceAsset.key, cvDataSet(instanceData, ['valueByCell', cell.id], text), `the cell ${cell.id}`), { isEditorKept: true });
	}

	// this CV's own text of the cell: written only when it differs from what the cell says now
	cellSave(service, instanceAsset, instanceData) {
		const cell = this.editor?.cell;
		if (!cell) return Promise.resolve(true);
		if (this.draft === cell.raw) {
			this.editorClose();
			return Promise.resolve(true);
		}
		const dataNext = cvDataSet(instanceData, ['valueByCell', cell.id], this.draft);
		return this.writeRun(() => service.assetWrite(instanceAsset.key, dataNext, `the cell ${cell.id}`));
	}

	// how the text of a cell stands in its box, for this paper: kept only where it differs from what
	// its template (else its form) says, so that a paper names only what it changed
	cellAlignSet(service, instanceAsset, instanceData, cell, align) {
		const alignBase = cell.alignTemplate || this.editor?.alignDefault || '';
		const dataNext = align === alignBase
			? cvDataRemove(instanceData, ['alignByCell', cell.id])
			: cvDataSet(instanceData, ['alignByCell', cell.id], align);
		return this.writeRun(() => service.assetWrite(instanceAsset.key, dataNext, `the cell ${cell.id} ${align === 'center' ? 'centered' : `to the ${align}`}`), { isEditorKept: true });
	}

	// the title of the paper's PDF (CvJpData.js CV_JP_CELL_PDF_TITLE): a cell of the paper, taken
	// away when emptied, so that the paper's name is the title again
	pdfTitleSet(service, instanceAsset, instanceData, text) {
		const textNext = String(text ?? '');
		const isEmpty = textNext.trim() === '';
		const dataNext = isEmpty ? cvDataRemove(instanceData, ['valueByCell', CV_JP_CELL_PDF_TITLE]) : cvDataSet(instanceData, ['valueByCell', CV_JP_CELL_PDF_TITLE], textNext);
		return this.writeRun(() => service.assetWrite(instanceAsset.key, dataNext, isEmpty ? 'the title of its PDF: its name' : `the title of its PDF: ${textNext}`), { isEditorKept: true });
	}

	cellReset(service, instanceAsset, instanceData) {
		const cell = this.editor?.cell;
		if (!cell) return Promise.resolve(true);
		const dataNext = cvDataRemove(instanceData, ['valueByCell', cell.id]);
		return this.writeRun(() => service.assetWrite(instanceAsset.key, dataNext, `the cell ${cell.id} back to its template`));
	}

	// the value in the profile the cell reads: every CV reading it changes
	profileLeafSave(profile, leaf) {
		const data = profile.assetDataGet(leaf.assetKey).data;
		const dataNext = cvDataSet(data, leaf.keyPath, cvLeafValueBuild(this.draftProfile, leaf.isList));
		return this.writeRun(() => profile.assetWrite(leaf.assetKey, dataNext, leaf.path));
	}

	// a value the profile does not hold yet: the place the query names, in the partition of the CV
	profileLeafAdd(profile, info, query, value, partition) {
		const { segmentList } = cvQueryParse(query);
		const place = cvLeafPlaceGet(info, segmentList.join('/'));
		if (!place) return Promise.resolve(false);
		if (place.assetKey) {
			const data = profile.assetDataGet(place.assetKey).data;
			return this.writeRun(() => profile.assetWrite(place.assetKey, cvDataSet(data, place.keyPath, value), segmentList.join('/')));
		}
		return this.writeRun(() => profile.assetCreate(cvInfoCreateInput(partition, place, place.keyPath.length > 0 ? cvDataSet({}, place.keyPath, value) : value, cvKindNameOf(profile, CV_KIND_ID_INFO, CV_KIND_INFO))));
	}

	// one value of the profile set from a card that changes several (the dates of a period): written
	// at its leaf, added at the place its path names, or taken out when it is emptied. a whole
	// number is kept as a number (a year, a month). the card stays open
	profileValueWrite(profile, info, query, valueInput, partition) {
		const text = String(valueInput ?? '').trim();
		const path = cvQueryParse(query).segmentList.join('/');
		const place = cvLeafPlaceGet(info, path);
		if (!place) return Promise.resolve(false);
		const value = /^\d+$/.test(text) ? Number(text) : text;
		if (!place.assetKey) {
			if (text === '') return Promise.resolve(true);
			const data = place.keyPath.length > 0 ? cvDataSet({}, place.keyPath, value) : value;
			return this.writeRun(() => profile.assetCreate(cvInfoCreateInput(partition, place, data, cvKindNameOf(profile, CV_KIND_ID_INFO, CV_KIND_INFO))), { isEditorKept: true });
		}
		const data = profile.assetDataGet(place.assetKey).data;
		const dataNext = text === '' ? cvDataRemove(data, place.keyPath) : cvDataSet(data, place.keyPath, value);
		return this.writeRun(() => profile.assetWrite(place.assetKey, dataNext, path), { isEditorKept: true });
	}

	// a row: in the profile when it comes from there, else this CV's own
	rowSave(service, profile, instanceAsset, instanceData) {
		const { group, row } = this.editor ?? {};
		if (!group) return Promise.resolve(true);
		const draft = this.draftRow;
		const isUnchanged = row && CV_JP_ROW_FIELD_LIST.every((field) => String(row[field] ?? '') === String(draft[field] ?? ''));
		if (isUnchanged || (!row && CV_JP_ROW_FIELD_LIST.every((field) => String(draft[field] ?? '').trim() === ''))) {
			this.editorClose();
			return Promise.resolve(true);
		}
		return this.rowWrite(service, profile, instanceAsset, instanceData, group, row, draft);
	}

	// one field of a row written at once, without its editor: a token of it changed from its card
	rowFieldWrite(service, profile, instanceAsset, instanceData, group, row, field, text) {
		if (!row || String(row[field] ?? '') === text) return Promise.resolve(true);
		return this.rowWrite(service, profile, instanceAsset, instanceData, group, row, { year: row.year, month: row.month, text: row.text, note: row.note, [field]: text }, { isEditorKept: true });
	}

	// the fields of a row written where the row lives
	rowWrite(service, profile, instanceAsset, instanceData, group, row, draft, option) {
		if (row && !row.isExtra) {
			let data = profile.assetDataGet(row.assetKey).data;
			data = cvDataSet(data, [...row.keyPath, 'year'], Number(draft.year) || draft.year);
			data = cvDataSet(data, [...row.keyPath, 'month'], Number(draft.month) || draft.month);
			data = cvDataSet(data, row.textKeyPath, cvLeafValueBuild(draft.text, row.isTextList));
			data = draft.note || row.note ? cvDataSet(data, row.noteKeyPath, draft.note) : data;
			return this.writeRun(() => profile.assetWrite(row.assetKey, data, `a row of ${groupNameGet(group)} (in the profile)`), option);
		}
		const listBefore = Array.isArray(instanceData?.rowExtraByGroup?.[group.id]) ? instanceData.rowExtraByGroup[group.id] : [];
		const rowNext = {
			id: row?.idOwn ?? cvJpRowIdNew(),
			year: Number(draft.year) || draft.year,
			month: Number(draft.month) || draft.month,
			text: draft.text,
			...(draft.note ? { note: draft.note } : {}),
		};
		const listNext = row ? listBefore.map((one, index) => (index === row.extraIndex ? rowNext : one)) : [...listBefore, rowNext];
		return this.writeRun(() => service.assetWrite(instanceAsset.key, cvDataSet(instanceData, ['rowExtraByGroup', group.id], listNext), row ? `a row of ${groupNameGet(group)}` : `a new row of ${groupNameGet(group)}`), option);
	}

	// the row open goes from this paper: a row only this paper has is deleted; a row of the profile
	// is hidden in this paper (the profile keeps it, every other paper still shows it, More fields
	// shows it here again), or shown again when it was hidden
	rowRemove(service, instanceAsset, instanceData) {
		const { group, row } = this.editor ?? {};
		if (!row) {
			this.editorClose();
			return Promise.resolve(true);
		}
		if (row.isExtra) {
			const listNext = instanceData.rowExtraByGroup[group.id].filter((one, index) => index !== row.extraIndex);
			return this.writeRun(() => service.assetWrite(instanceAsset.key, cvDataSet(instanceData, ['rowExtraByGroup', group.id], listNext), `a row of ${groupNameGet(group)} deleted`));
		}
		const listBefore = Array.isArray(instanceData?.rowHiddenByGroup?.[group.id]) ? instanceData.rowHiddenByGroup[group.id] : [];
		const isHidden = listBefore.includes(row.id);
		const listNext = isHidden ? listBefore.filter((id) => id !== row.id) : [...listBefore, row.id];
		return this.writeRun(() => service.assetWrite(instanceAsset.key, cvDataSet(instanceData, ['rowHiddenByGroup', group.id], listNext), isHidden ? `a row of ${groupNameGet(group)} shown again` : `a row of ${groupNameGet(group)} hidden in this paper`));
	}

	// ---------- the parts of the paper (doc/cv-sheet.md#parts) ----------

	// a part of this paper's own, made of a part template (part: { label, section }), after a section
	// (sectionIdAfter; '' first): a copy of its section with an id of its own, its cells as the
	// template says until they are typed
	sectionAdd(service, instanceAsset, instanceData, sectionList, sectionIdAfter, part) {
		const section = cvJpSectionNew(part.section);
		const listBefore = Array.isArray(instanceData?.sectionExtraList) ? instanceData.sectionExtraList : [];
		let dataNext = cvDataSet(instanceData, ['sectionExtraList'], [...listBefore, section]);
		dataNext = cvDataSet(dataNext, ['sectionOrderList'], cvJpSectionOrderInsert(sectionList, section.id, sectionIdAfter));
		return this.writeRun(() => service.assetWrite(instanceAsset.key, dataNext, `the part ${part.label || cvJpSectionLabelGet(section)} added`), { isEditorKept: true });
	}

	// an option of a part, for this paper (doc/cv-sheet.md#the-options-of-a-part): kept in
	// optionBySection only where it differs from what the part says (section.optionBase), so that a
	// paper names only what it changed. written at once, a step of the history
	sectionOptionSet(service, instanceAsset, instanceData, section, option, value) {
		const isBase = section.optionBase?.[option.key] === value;
		let dataNext = isBase
			? cvDataRemove(instanceData, ['optionBySection', section.id, option.key])
			: cvDataSet(instanceData, ['optionBySection', section.id, option.key], value);
		if (isBase && Object.keys(dataNext?.optionBySection?.[section.id] ?? {}).length === 0) dataNext = cvDataRemove(dataNext, ['optionBySection', section.id]);
		const valueText = option.kind === 'choice' ? option.choiceList.find((one) => one.value === value)?.label ?? value : option.kind === 'boolean' ? (value ? 'On' : 'Off') : String(value);
		return this.writeRun(() => service.assetWrite(instanceAsset.key, dataNext, `${option.label} of the part ${cvJpSectionLabelGet(section)}: ${valueText}`), { isEditorKept: true });
	}

	// the options of a part as the part says them: the paper's own taken away
	sectionOptionReset(service, instanceAsset, instanceData, section) {
		return this.writeRun(() => service.assetWrite(instanceAsset.key, cvDataRemove(instanceData, ['optionBySection', section.id]), `the options of the part ${cvJpSectionLabelGet(section)} as the part says them`), { isEditorKept: true });
	}

	// a part taken out of the paper: one of its own is deleted with what it says; one of its template
	// is left out (the template keeps it, More fields draws it again). Either is undone with Ctrl/⌘ + Z
	sectionDelete(service, instanceAsset, instanceData, section) {
		if (section.isOwn) return this.sectionRemove(service, instanceAsset, instanceData, section.id, `the part ${cvJpSectionLabelGet(section)} deleted`);
		return this.sectionHiddenSet(service, instanceAsset, instanceData, section.id, true, `the part ${cvJpSectionLabelGet(section)} deleted from this paper`);
	}

	// a section a place up or down among those drawn
	sectionMove(service, instanceAsset, instanceData, sectionList, sectionId, delta) {
		const idList = cvJpSectionOrderMove(sectionList, sectionId, delta);
		if (!idList) return Promise.resolve(false);
		return this.writeRun(() => service.assetWrite(instanceAsset.key, cvDataSet(instanceData, ['sectionOrderList'], idList), 'the order of the parts'), { isEditorKept: true });
	}

	// a section left out of this paper, or drawn again: nothing of it is lost
	sectionHiddenSet(service, instanceAsset, instanceData, sectionId, isHidden, note) {
		const listBefore = Array.isArray(instanceData?.sectionHiddenList) ? instanceData.sectionHiddenList : [];
		const listNext = isHidden ? [...new Set([...listBefore, sectionId])] : listBefore.filter((id) => id !== sectionId);
		const dataNext = listNext.length > 0 ? cvDataSet(instanceData, ['sectionHiddenList'], listNext) : cvDataRemove(instanceData, ['sectionHiddenList']);
		return this.writeRun(() => service.assetWrite(instanceAsset.key, dataNext, note || (isHidden ? 'a part left out' : 'a part drawn again')), { isEditorKept: true });
	}

	// a part of this paper's own deleted with what it says
	sectionRemove(service, instanceAsset, instanceData, sectionId, note = 'a part of this paper deleted') {
		const listOf = (key) => (Array.isArray(instanceData?.[key]) ? instanceData[key] : []);
		let dataNext = { ...instanceData, sectionExtraList: listOf('sectionExtraList').filter((one) => one?.id !== sectionId) };
		for (const key of ['sectionHiddenList', 'sectionOrderList']) dataNext[key] = listOf(key).filter((id) => id !== sectionId);
		for (const key of ['sectionExtraList', 'sectionHiddenList', 'sectionOrderList']) if (dataNext[key].length === 0) delete dataNext[key];
		for (const cellId of cvJpSectionCellIdList(sectionId)) dataNext = cvDataRemove(dataNext, ['valueByCell', cellId]);
		return this.writeRun(() => service.assetWrite(instanceAsset.key, dataNext, note), { isEditorKept: true });
	}

	// whether the years the form draws itself have their era above them, in this paper
	eraSet(service, instanceAsset, instanceData, isEra) {
		return this.writeRun(() => service.assetWrite(instanceAsset.key, cvDataSet(instanceData, ['isEra'], isEra), isEra ? 'the era above the years' : 'the years without their era'), { isEditorKept: true });
	}

	// ---------- the career of a work experience (doc/we-jp.md) ----------

	// an employer, a project or a fact of an employer left out of this paper, or drawn again; the
	// profile keeps it
	careerItemHiddenSet(service, instanceAsset, instanceData, section, key, isHidden) {
		const listBefore = Array.isArray(instanceData?.rowHiddenByGroup?.[section.id]) ? instanceData.rowHiddenByGroup[section.id] : [];
		const listNext = isHidden ? [...new Set([...listBefore, key])] : listBefore.filter((one) => one !== key);
		const dataNext = listNext.length > 0 ? cvDataSet(instanceData, ['rowHiddenByGroup', section.id], listNext) : cvDataRemove(instanceData, ['rowHiddenByGroup', section.id]);
		return this.writeRun(() => service.assetWrite(instanceAsset.key, dataNext, isHidden ? 'a part of the career left out' : 'a part of the career drawn again'), { isEditorKept: true });
	}

	// a new employer of the profile, or a new project of an employer (employerKey): a data item of
	// the profile in the partition of the paper, starting at the date of the paper, its name to type
	careerItemAdd(profile, partition, section, employerKey, date) {
		const { pathInInfo, data } = weJpCareerItemNew(section, { employerKey, date });
		const input = cvInfoCreateInput(partition, { pathNew: `/${CV_INFO_FOLDER}/${pathInInfo}` }, data, cvKindNameOf(profile, CV_KIND_ID_INFO, CV_KIND_INFO));
		return this.writeRun(() => profile.assetCreate(input), { isEditorKept: true });
	}

	// a new fact of an employer (事業内容, 資本金, …): an entry of the employer in the profile, its
	// label and what it says still to type. it goes where the facts of the employer are, as the
	// last of them
	//   employer   the employer of the career (weJpCareerBuild): factPathText, where its facts are
	careerFactAdd(profile, info, employer) {
		const fact = weJpFactNew();
		const place = cvLeafPlaceGet(info, `${employer.factPathText}/${fact.id}/${WE_JP_FACT_LABEL}`);
		if (!place?.assetKey) return Promise.resolve(false);
		const data = profile.assetDataGet(place.assetKey).data;
		return this.writeRun(() => profile.assetWrite(place.assetKey, cvDataSet(data, place.keyPath.slice(0, -1), fact.data), `${employer.factPathText}/${fact.id}`), { isEditorKept: true });
	}

	// a fact of an employer taken out of the profile, for every paper: its label and what it says
	careerFactRemove(profile, info, fact) {
		const place = cvLeafPlaceGet(info, `${fact.pathText}/${WE_JP_FACT_LABEL}`);
		if (!place?.assetKey) return Promise.resolve(false);
		const data = profile.assetDataGet(place.assetKey).data;
		return this.writeRun(() => profile.assetWrite(place.assetKey, cvDataRemove(data, place.keyPath.slice(0, -1)), `${fact.pathText} removed`), { isEditorKept: true });
	}

	// ---------- the badges of the profile ----------

	// a badge made at a path of the profile's partition, with a stand-in image (typed in a cell:
	// /badge aws/dva/v1), and a badge's own data changed: its name, its image
	badgeCreate(profile, partition, path) {
		return this.writeRun(() => profile.assetCreate(cvBadgeCreateInput(partition, path, {}, cvKindNameOf(profile, CV_KIND_ID_BADGE, CV_KIND_BADGE))), { isEditorKept: true });
	}

	badgeWrite(profile, badge, change) {
		const dataNext = { ...badge.data, ...change };
		return this.writeRun(async () => {
			const result = await profile.assetWrite(badge.key, dataNext, `the badge ${badge.path}`);
			// its name is how the profile lists it too
			if (result?.code === 0 && change.name !== undefined && change.name !== badge.name) await profile.assetMetaSet(badge.key, { name: change.name });
			return result;
		}, { isEditorKept: true });
	}

	// ---------- the order of the rows ----------

	dragStart(group, row) {
		this.dragRow = { groupId: group.id, rowId: row.id };
		this.dropTarget = null;
	}

	// the pointer over a row of the same group: before it or after it
	dragOver(group, row, isAfter) {
		if (!this.dragRow || this.dragRow.groupId !== group.id || this.dragRow.rowId === row.id) {
			if (this.dropTarget) this.dropTarget = null;
			return false;
		}
		if (this.dropTarget?.rowId !== row.id || this.dropTarget.isAfter !== isAfter) this.dropTarget = { rowId: row.id, isAfter };
		return true;
	}

	dragEnd() {
		this.dragRow = null;
		this.dropTarget = null;
	}

	// the row dropped: the order of the group written into this CV (rowOrderByGroup)
	drop(service, instanceAsset, instanceData, group) {
		const { dragRow, dropTarget } = this;
		this.dragEnd();
		if (!dragRow || !dropTarget || dragRow.groupId !== group.id) return Promise.resolve(false);
		const idList = cvJpRowOrderMove(group.rowList.map((row) => row.id), dragRow.rowId, dropTarget.rowId, dropTarget.isAfter);
		return this.writeRun(() => service.assetWrite(instanceAsset.key, cvDataSet(instanceData, ['rowOrderByGroup', group.id], idList), 'the order of the rows'));
	}

	// the rows of a group in order of time again
	rowOrderReset(service, instanceAsset, instanceData, group) {
		return this.writeRun(() => service.assetWrite(instanceAsset.key, cvDataRemove(instanceData, ['rowOrderByGroup', group.id]), 'the rows in order of time'));
	}
}

// a group of rows as a step of the history names it: its title without the spaces of the form (学歴)
function groupNameGet(group) {
	const title = String(group?.title ?? '').replace(/\s+/g, '');
	return title || 'a history';
}

// how an element's text stands as its form draws it ('' when it is no box of its own: a piece inside
// a line, which follows its line): read without the alignment the paper or its template gives it
function alignOfFormGet(element) {
	if (!element?.style) return '';
	const style = getComputedStyle(element);
	if (!['block', 'table-cell', 'list-item', 'flow-root'].includes(style.display)) return '';
	const alignGiven = element.style.textAlign;
	element.style.textAlign = '';
	const align = getComputedStyle(element).textAlign;
	element.style.textAlign = alignGiven;
	if (align === 'center' || align === '-webkit-center') return 'center';
	if (align === 'right' || align === 'end' || align === '-webkit-right') return 'right';
	return 'left';
}

// the width of an element's content: what a surface typed in it keeps
function contentWidthGet(element) {
	if (!element?.getBoundingClientRect) return undefined;
	const style = getComputedStyle(element);
	const width = element.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
		- parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
	return width > 0 ? width : undefined;
}

// where the content of an element starts inside it (its padding): a surface floating over it starts there
function contentOffsetGet(element) {
	if (!element?.getBoundingClientRect) return undefined;
	const style = getComputedStyle(element);
	if (style.display === 'inline') return { top: 0, left: 0 };
	return { top: parseFloat(style.paddingTop) || 0, left: parseFloat(style.paddingLeft) || 0 };
}
