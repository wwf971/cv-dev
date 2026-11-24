import { useContext, useEffect, useMemo, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import {
	BetweenHorizontalEnd, BetweenHorizontalStart, Briefcase, ChevronDown, ChevronUp, CornerDownRight, Ellipsis, Heading, IdCard, LetterText, Plus, SlidersHorizontal,
	TableProperties, Trash2,
} from 'lucide-react';
import { DocMenu, docMenuEntryBuild, docMenuSeparatorBuild } from '@wwf971/react-doc';
import { DiagramEditCard } from '@react-doc-package/cloud-dev-vis/comp-mdx/card-diagram/DiagramEditCard.jsx';
import '@react-doc-package/cloud-dev-vis/comp-mdx/card-diagram/DiagramVisualEdit.css';
import { CV_JP_PART_OPTION_GROUP_LABEL, cvJpPartOptionListGet, cvJpSectionLabelGet } from './CvJpData.js';
import { CvJpEditContext } from './CvJpSection.jsx';

// The parts of a paper while it is edited (doc/cv-sheet.md#parts). A paper is its parts stacked from
// top to bottom (the top with the name, the histories, the blocks, the closing line), and any of them
// may stand anywhere, be deleted, or be added from a part template:
//
//   a right click on a part, or ⋯ in its right margin
//                                  Move up, Move down, Add a part above ▸, Add a part below ▸, Options…,
//                                  Delete part
//   Options…                       the card of the options of the part, beside it (CvJpPartOptionCard)
//   + in the right margin of a part   the part templates: one added under it
//   a paper with no part           Add a part
//
// A part template is one of the form (its partList: the top with a photo or without, the parts of
// its standard template, a block to fill, the closing line) or a part template of the object (a data
// item of the kind part). Deleting a part of the paper's own deletes it with what it says; a part of
// its template is left out, the template keeping it (More fields draws it again). Ctrl/⌘ + Z takes
// any of it back.

// the icon of a part, by its type
const CV_JP_PART_ICON_BY_TYPE = { basic: IdCard, head: Heading, history: TableProperties, career: Briefcase, text: LetterText, closing: CornerDownRight };

// where a menu opened by a button stands: under it, its left edge at the button's
export function cvJpMenuPointUnder(element) {
	const rect = element.getBoundingClientRect();
	return { x: Math.round(rect.left), y: Math.round(rect.bottom + 2) };
}

// the entries of the part templates, the form's then the object's: ids `${prefix}${key}`
function partEntryListBuild(partTemplate, prefix) {
	const entryOf = (part, title) => docMenuEntryBuild(`${prefix}${part.key}`, CV_JP_PART_ICON_BY_TYPE[part.section.type], part.label, { title });
	const formList = partTemplate.formList.map((part) => entryOf(part, 'A part of the form'));
	const objectList = partTemplate.objectList.map((part) => entryOf(part, `A part template of this object${part.path ? `: ${part.path}` : ''}`));
	return objectList.length > 0 ? [...formList, docMenuSeparatorBuild(`${prefix}rule-object`), ...objectList] : formList;
}

function partFind(partTemplate, key) {
	return [...partTemplate.formList, ...partTemplate.objectList].find((part) => part.key === key);
}

// what a part offers in the right margin of the paper, so that nothing of the sheet moves for it:
// its menu (⋯, as a right click on it) and + (a part under it). Two buttons stand beside a part of
// one line (the closing line) without reaching the part above
export const CvJpSectionTool = observer(function CvJpSectionTool({ section }) {
	const edit = useContext(CvJpEditContext);
	const label = cvJpSectionLabelGet(section);
	return (
		<div className="doc-cv-jp-section-tool" data-cv-jp-editor="">
			<button type="button" className="doc-cv-jp-section-button" title={`The part ${label}: move it, add a part above or below, delete it (a right click on the part opens it too)`} aria-label={`The menu of the part ${label}`} aria-haspopup="menu" onClick={(event) => edit?.partMenuOpen({ mode: 'part', sectionId: section.id, point: cvJpMenuPointUnder(event.currentTarget) })}><Ellipsis size={13} aria-hidden="true" /></button>
			<button type="button" className="doc-cv-jp-section-button" title="Add a part under this one: a part of the form, or a part template of this object" aria-label="Add a part under this one" aria-haspopup="menu" onClick={(event) => edit?.partMenuOpen({ mode: 'add', sectionIdAfter: section.id, point: cvJpMenuPointUnder(event.currentTarget) })}><Plus size={13} aria-hidden="true" /></button>
		</div>
	);
});

// a paper with no part drawn, while it is edited: a place to add the first
export const CvJpPartEmpty = observer(function CvJpPartEmpty() {
	const edit = useContext(CvJpEditContext);
	return (
		<div className="doc-cv-jp-part-empty" data-cv-jp-editor="">
			<span className="doc-cv-list-muted">This paper has no part.</span>
			<button type="button" className="doc-button" onClick={(event) => edit?.partMenuOpen({ mode: 'add', sectionIdAfter: '', point: cvJpMenuPointUnder(event.currentTarget) })}>
				<Plus size={12} aria-hidden="true" /><span>Add a part</span>
			</button>
		</div>
	);
});

// the menu of parts: the part templates to add one from (mode add), or what is done with one part
// (mode part, a right click on it)
//   menu           { mode, point, sectionIdAfter (add), sectionId (part) }
//   sectionList    the parts drawn, in their order
//   partTemplate   { formList, objectList } (CvJpData.js cvJpPartTemplateListGet)
export const CvJpPartMenu = observer(function CvJpPartMenu({ menu, sectionList, partTemplate, onClose }) {
	const edit = useContext(CvJpEditContext);
	const index = menu.mode === 'part' ? sectionList.findIndex((section) => section.id === menu.sectionId) : -1;
	const section = index >= 0 ? sectionList[index] : undefined;
	const label = section ? cvJpSectionLabelGet(section) : '';
	const itemList = menu.mode === 'part' && section ? [
		docMenuEntryBuild('up', ChevronUp, 'Move up', { reason: index === 0 ? 'It is the first part' : '' }),
		docMenuEntryBuild('down', ChevronDown, 'Move down', { reason: index === sectionList.length - 1 ? 'It is the last part' : '' }),
		docMenuSeparatorBuild('rule-add'),
		{ ...docMenuEntryBuild('above', BetweenHorizontalStart, 'Add a part above'), children: partEntryListBuild(partTemplate, 'above:') },
		{ ...docMenuEntryBuild('below', BetweenHorizontalEnd, 'Add a part below'), children: partEntryListBuild(partTemplate, 'below:') },
		docMenuSeparatorBuild('rule-option'),
		docMenuEntryBuild('options', SlidersHorizontal, 'Options…', {
			reason: cvJpPartOptionListGet(section.type).length > 0 ? '' : 'This kind of part has no options',
			title: `What the part ${label} draws, for this paper`,
		}),
		docMenuSeparatorBuild('rule-delete'),
		docMenuEntryBuild('delete', Trash2, section.isOwn ? `Delete ${label}` : `Delete ${label} from this paper`, {
			isDanger: true,
			title: section.isOwn ? 'Deleted with what it says; Ctrl/⌘ + Z brings it back' : 'Its template keeps it; More fields draws it again',
		}),
	] : partEntryListBuild(partTemplate, 'add:');
	const choose = (id) => {
		onClose();
		const text = String(id ?? '');
		if (text === 'up' || text === 'down') return edit?.sectionMove(section.id, text === 'up' ? -1 : 1);
		if (text === 'delete') return edit?.sectionDelete(section);
		if (text === 'options') return edit?.partOptionOpen(section.id);
		const at = text.indexOf(':');
		const where = text.slice(0, at);
		const part = partFind(partTemplate, text.slice(at + 1));
		if (!part) return undefined;
		if (where === 'add') return edit?.sectionAdd(menu.sectionIdAfter, part);
		if (where === 'below') return edit?.sectionAdd(section.id, part);
		// above: after the part drawn before it, or first
		if (where === 'above') return edit?.sectionAdd(index > 0 ? sectionList[index - 1].id : '', part);
		return undefined;
	};
	return <DocMenu itemList={itemList} point={menu.point} onChoose={choose} onClose={onClose} />;
});

// a right click on a part while the paper is edited opens its menu; on a text being typed, a field or
// what floats over the paper (the tools of a cell) the browser's menu stays
export function cvJpPartContextMenuHandle(event, section, edit) {
	const target = event.target instanceof Element ? event.target : null;
	if (target?.closest('[contenteditable]:not([contenteditable="false"]), input, textarea, select, [data-cv-jp-editor]')) return;
	event.preventDefault();
	event.stopPropagation();
	edit?.partMenuOpen({ mode: 'part', sectionId: section.id, point: { x: event.clientX, y: event.clientY } });
}

// The card of the options of a part (doc/cv-sheet.md#the-options-of-a-part): what a part of its type
// lets a paper change of it (CvJpData.js CV_JP_PART_OPTION_LIST_BY_TYPE), under the headings of its
// groups. It is the edit card of the card-diagram framework (cloud-dev-vis DiagramEditCard), given a
// card of its own: it stands beside the part, at the right of the paper when the window has room,
// else at its left, so the paper stays in sight (its anchor: the paper's width, the part's height), and draws the options with the host's PropEditor
// (Off / On, a few choices side by side, a number). A change is written at once for this paper and
// drawn on the sheet; Ctrl/⌘ + Z takes it back. An option the paper sets itself is marked *, and As
// the part says takes them away. Escape, its close button or a pointer going down elsewhere closes it
//   section   the part, its options on it (section[key], optionBase, optionOwnList)
//   rootGet   the element of the sheet, where the part is found by its id (data-section-id)
export const CvJpPartOptionCard = observer(function CvJpPartOptionCard({ section, store, rootGet, isWritable, onClose }) {
	const edit = useContext(CvJpEditContext);
	const isWritableRef = useRef(isWritable);
	isWritableRef.current = isWritable;
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;
	const partElementGet = () => rootGet()?.querySelector(`[data-section-id="${CSS.escape(section.id)}"]`) ?? null;
	// what the card stands beside: the part, as wide as the paper (its margin holds the buttons of the part)
	const anchorRectGet = () => {
		const part = partElementGet()?.getBoundingClientRect();
		const paper = partElementGet()?.closest('.doc-cv-jp-paper')?.getBoundingClientRect();
		if (!part) return null;
		return paper ? { left: paper.left, right: paper.right, top: part.top, bottom: part.bottom, width: paper.width, height: part.height } : part;
	};
	// what the edit card asks of the editor of a diagram: its message, whether it is locked; it has no path
	const editor = useMemo(() => ({
		store,
		get isLocked() { return !isWritableRef.current; },
		navigate: () => {},
		anchorRectGet: () => null,
		clearSelection: () => onCloseRef.current(),
	}), [store]);
	useEffect(() => {
		const onPointerDown = (event) => {
			const target = event.target instanceof Element ? event.target : null;
			if (target?.closest('.doc-vis-card-panel, .doc-vis-menu, .prop-editor-color-popover') || partElementGet()?.contains(target)) return;
			onCloseRef.current();
		};
		const onKeyDown = (event) => {
			if (event.key === 'Escape' && !event.defaultPrevented) onCloseRef.current();
		};
		document.addEventListener('pointerdown', onPointerDown, true);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown, true);
			document.removeEventListener('keydown', onKeyDown);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [section.id]);
	const optionList = cvJpPartOptionListGet(section.type);
	const ownList = section.optionOwnList ?? [];
	const groupIdList = [...new Set(optionList.map((option) => option.group))];
	const sectionList = groupIdList.map((groupId) => {
		const groupOptionList = optionList.filter((option) => option.group === groupId);
		return {
			id: groupId,
			label: CV_JP_PART_OPTION_GROUP_LABEL[groupId] ?? groupId,
			propertyList: groupOptionList.map((option) => propertyOfOption(option, section, ownList.includes(option.key), (value) => edit?.sectionOptionSet(section, option, value))),
			note: groupNoteGet(groupOptionList),
			actionList: [],
		};
	});
	sectionList.push({
		id: 'paper',
		label: 'This paper',
		propertyList: [],
		note: `Kept for this paper and drawn at once; Ctrl/⌘ + Z takes a change back.${ownList.length > 0 ? ' * set by this paper, over what the part says.' : ''}`,
		actionList: [{ id: 'reset', label: 'As the part says', act: () => edit?.sectionOptionReset(section), isDisabled: ownList.length === 0, reason: 'This paper sets none of its own' }],
	});
	const card = {
		model: { title: cvJpSectionLabelGet(section), kindLabel: 'Options', tabList: [], segmentList: [], view: { type: 'detail', sectionList } },
		anchorRectGet,
		close: () => onCloseRef.current(),
	};
	return <DiagramEditCard editor={editor} card={card} />;
});

// an option as a property of the edit card (cloud-dev-vis DiagramEditCardModel.js): a check box, a
// few choices side by side, a number. set() writes it and says it is taken; the sheet draws it
function propertyOfOption(option, section, isOwn, write) {
	const label = `${option.label}${isOwn ? ' *' : ''}`;
	const value = section[option.key];
	if (option.kind === 'boolean') return { id: option.key, label, kind: 'bool', value: value === true, set: (next) => { write(next === true || next === 'true'); return true; } };
	if (option.kind === 'number') {
		return {
			id: option.key, label, kind: 'number', value, min: option.min, max: option.max, step: 1,
			set: (next) => {
				const number = Math.round(Number(next));
				if (!Number.isFinite(number) || number < (option.min ?? 0) || number > (option.max ?? Infinity)) return false;
				write(number);
				return true;
			},
		};
	}
	return {
		id: option.key, label, kind: 'enum', value,
		values: option.choiceList.map((one) => one.value),
		valueLabels: Object.fromEntries(option.choiceList.map((one) => [one.value, one.label])),
		set: (next) => { write(next); return true; },
	};
}

// what the options of a group mean, said once under them: the choices of a row; the room a width takes
function groupNoteGet(optionList) {
	const choice = optionList.find((option) => option.kind === 'choice');
	if (choice) return choice.choiceList.map((one) => `${one.label}: ${one.description}`).join('; ') + '.';
	const number = optionList.filter((option) => option.kind === 'number');
	if (number.length > 0) return number.map((option) => option.description).join(' ');
	return '';
}
