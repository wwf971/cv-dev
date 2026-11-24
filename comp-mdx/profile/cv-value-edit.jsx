import { useRef, useState } from 'react';
import { Check, X } from 'lucide-react';

// Explicit Save and Cancel for values typed in place in a card (the card of a value of the profile,
// the card of a period): the field being typed is known, and two buttons act on it as its keys do.
//
//   const edit = useCvValueEdit();
//   <EditValueInline value={v} onCommit={…} {...edit.bind('year', v)} />
//   <CvSaveCancel edit={edit} />
//
// A field of react-doc's EditValueInline keeps its value when it is left (Enter, a click elsewhere)
// and puts it back on Esc. Save leaves it, so its value is kept; Cancel puts its value back and
// leaves it, so nothing is written. The buttons take no focus and are inside what the field counts
// as itself (commitRootRef), so pressing Cancel never leaves the field first, which would keep it.
// They are greyed out while nothing typed differs from the value.
//
// intentTake(), asked in the onCommit of a field: whether the value is kept by Save or Enter (the
// author said so) rather than by leaving the field. A card closes itself after such a save when it
// holds one simple value (CvProfileValuePanel).
export function useCvValueEdit() {
	// the field being typed: { key, value: as it was, draft: as typed }
	const [active, activeSet] = useState(null);
	const elementByKey = useRef(new Map());
	const buttonsRef = useRef(null);
	// 'save' once Save is pressed or Enter typed, until the value is kept or another field is entered
	const intentRef = useRef('');
	const bind = (key, value) => {
		const valueText = String(value ?? '');
		return {
			ref: (node) => {
				if (node) elementByKey.current.set(key, node);
				else elementByKey.current.delete(key);
			},
			commitRootRef: buttonsRef,
			onFocus: () => {
				intentRef.current = '';
				activeSet({ key, value: valueText, draft: valueText });
			},
			// Enter keeps the value as Save does (EditValueInline leaves the field on it)
			onKeyDown: (event) => {
				if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) intentRef.current = 'save';
			},
			onInput: (text) => activeSet((one) => ({ key, value: one?.key === key ? one.value : valueText, draft: text })),
			onBlur: () => activeSet((one) => (one?.key === key ? null : one)),
		};
	};
	const element = active ? elementByKey.current.get(active.key) : undefined;
	return {
		buttonsRef,
		bind,
		isChanged: Boolean(active) && active.draft !== active.value,
		// as Enter: the field left, its value kept
		save: () => {
			intentRef.current = 'save';
			element?.blur();
		},
		// as Esc: the value put back, the field left, nothing written
		cancel: () => {
			intentRef.current = '';
			if (!element || !active) return;
			element.textContent = active.value;
			element.blur();
		},
		intentTake: () => {
			const isSave = intentRef.current === 'save';
			intentRef.current = '';
			return isSave;
		},
	};
}

// the two buttons, in the look of the page's Save and Cancel (react-doc's EditActions)
export function CvSaveCancel({ edit, saveTitle = 'Keep it (Enter)', cancelTitle = 'Put it back (Esc)' }) {
	// the field keeps the focus until a button acts: a press does not move it
	const focusKeep = (event) => event.preventDefault();
	return (
		<span ref={edit.buttonsRef} className="doc-cv-save-cancel" role="group" aria-label="Save or cancel">
			<button type="button" className="doc-button" data-primary="" disabled={!edit.isChanged} title={saveTitle} onMouseDown={focusKeep} onClick={edit.save}>
				<Check size={12} strokeWidth={2.2} aria-hidden="true" /><span>Save</span>
			</button>
			<button type="button" className="doc-button" disabled={!edit.isChanged} title={cancelTitle} onMouseDown={focusKeep} onClick={edit.cancel}>
				<X size={12} strokeWidth={2.2} aria-hidden="true" /><span>Cancel</span>
			</button>
		</span>
	);
}
