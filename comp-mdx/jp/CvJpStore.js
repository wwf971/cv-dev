import { makeAutoObservable, observable } from 'mobx';
import { cvDataRemove, cvDataSet, cvLeafPlaceGet, cvLeafValueBuild, cvQueryParse } from '../query/CvQuery.js';
import { cvInfoCreateInput } from '../query/CvProfile.js';
import { CV_JP_ROW_FIELD_LIST, cvJpRowIdNew, cvJpRowOrderMove } from './CvJpData.js';

// The state of one drawn Japanese-style CV: which instance, in-place editing, the cell or row being
// edited, a row being dragged. Every write goes through the api of the objects
// (config.objectFrontend): an instance's own text into its item, a value of the profile into the
// profile's item.
//
// In-place editing (doc/cv-jp.md#editing-in-place): the cell itself becomes the surface its text
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
export class CvJpStore {
	instanceRef = '';
	isEditing = false;
	isFieldListOpen = false;
	editor = null;
	anchorElement = null;
	draft = '';
	draftProfile = '';
	draftRow = { year: '', month: '', text: '', note: '' };
	status = 'idle';
	message = '';
	rootElement = null;
	// a row dragged to another place in its group: { groupId, rowId }, and where it would go
	dragRow = null;
	dropTarget = null;

	constructor(instanceRef) {
		this.instanceRef = instanceRef ?? '';
		makeAutoObservable(this, { rootElement: observable.ref, editor: observable.ref, anchorElement: observable.ref }, { autoBind: true });
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

	fieldListToggle() {
		this.isFieldListOpen = !this.isFieldListOpen;
	}

	anchorSet(element) {
		if (element && element !== this.anchorElement) this.anchorElement = element;
	}

	// a cell opened in place: element is the cell, point where it was clicked
	cellOpen(cell, element, valueProfile, { point, isOffSheet = false, isMultiline = false } = {}) {
		if (!this.isEditing) return;
		this.isFieldListOpen = false;
		this.editor = { kind: 'cell', id: cell.id, cell, point, width: isOffSheet ? undefined : contentWidthGet(element), offset: isOffSheet ? undefined : contentOffsetGet(element), isOffSheet, isMultiline };
		this.anchorElement = element;
		this.draft = cell.raw;
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
		this.status = 'idle';
		this.message = '';
	}

	draftSet(text) {
		this.draft = text;
	}

	draftProfileSet(text) {
		this.draftProfile = text;
	}

	draftRowSet(change) {
		this.draftRow = { ...this.draftRow, ...change };
	}

	async writeRun(write) {
		// the editor may be another one when the answer comes (a click on the next cell saves this one)
		const editorAtStart = this.editor;
		this.status = 'submitting';
		this.message = '';
		let result;
		try {
			result = await write();
		} catch (error) {
			result = { code: -1, message: String(error?.message ?? error) };
		}
		if (result?.code === 0 || result === undefined) {
			if (this.editor === editorAtStart) this.editorClose();
			else this.status = 'idle';
			return true;
		}
		this.status = 'error';
		this.message = result?.message ?? 'the write failed';
		return false;
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
		return this.writeRun(() => profile.assetCreate(cvInfoCreateInput(partition, place, place.keyPath.length > 0 ? cvDataSet({}, place.keyPath, value) : value)));
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
		if (row && !row.isExtra) {
			let data = profile.assetDataGet(row.assetKey).data;
			data = cvDataSet(data, [...row.keyPath, 'year'], Number(draft.year) || draft.year);
			data = cvDataSet(data, [...row.keyPath, 'month'], Number(draft.month) || draft.month);
			data = cvDataSet(data, row.textKeyPath, cvLeafValueBuild(draft.text, row.isTextList));
			data = draft.note || row.note ? cvDataSet(data, row.noteKeyPath, draft.note) : data;
			return this.writeRun(() => profile.assetWrite(row.assetKey, data, 'a row of a history'));
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
		return this.writeRun(() => service.assetWrite(instanceAsset.key, cvDataSet(instanceData, ['rowExtraByGroup', group.id], listNext), 'a row of this CV'));
	}

	// a row of this CV goes; an entry of the profile only leaves this CV
	rowRemove(service, instanceAsset, instanceData) {
		const { group, row } = this.editor ?? {};
		if (!row) {
			this.editorClose();
			return Promise.resolve(true);
		}
		if (row.isExtra) {
			const listNext = instanceData.rowExtraByGroup[group.id].filter((one, index) => index !== row.extraIndex);
			return this.writeRun(() => service.assetWrite(instanceAsset.key, cvDataSet(instanceData, ['rowExtraByGroup', group.id], listNext), 'a row of this CV removed'));
		}
		const listBefore = Array.isArray(instanceData?.rowHiddenByGroup?.[group.id]) ? instanceData.rowHiddenByGroup[group.id] : [];
		const listNext = listBefore.includes(row.id) ? listBefore.filter((id) => id !== row.id) : [...listBefore, row.id];
		return this.writeRun(() => service.assetWrite(instanceAsset.key, cvDataSet(instanceData, ['rowHiddenByGroup', group.id], listNext), 'a row of the profile shown or left out'));
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
