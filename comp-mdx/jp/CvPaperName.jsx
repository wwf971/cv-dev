import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Redo2, Undo2 } from 'lucide-react';
import { EditValueInline, useDocEventSubscribe } from '@wwf971/react-doc';
import { cvEditHistoryGet } from './cv-edit-history.js';

// The name of a paper or a template, typed where it is shown (doc/cv-sheet.md#renaming-a-paper): in
// the table of papers (its row's menu: Rename) and in the bar of a sheet being edited. It is the
// name of its item, and the name written in it when it has one; both are written as one step of
// the history. Its path stays, so nothing naming the paper by its path breaks.
export function cvPaperRename(history, service, asset, text, nameBefore) {
	const name = String(text ?? '').trim();
	if (!name) return Promise.resolve({ code: -1, message: 'A paper needs a name: it is put back.' });
	if (name === nameBefore) return Promise.resolve({ code: 0 });
	const recorded = history ? history.wrap(service) : service;
	const write = async () => {
		const result = await recorded.assetMetaSet(asset.key, { name });
		if (result && result.code !== 0) return result;
		const read = service.assetDataGet(asset.key);
		const data = read?.status === 'done' ? read.data : undefined;
		if (data && typeof data === 'object' && !Array.isArray(data) && typeof data.name === 'string' && data.name !== name) {
			return recorded.assetWrite(asset.key, { ...data, name }, `the name written in ${name}`);
		}
		return result ?? { code: 0 };
	};
	return history ? history.stepRun(write, `${nameBefore || asset.key} renamed ${name}`) : write();
}

// the name typed in place: Enter (or a click elsewhere) keeps it, Esc puts it back
//   isFocusedInitial   it has the focus when drawn, its words selected (Rename from a menu)
//   onDone()           it was left, the name kept or not
//   onMessage(text)    what went wrong ('' once it is written): the host says it, the field may be gone
export function CvPaperNameField({ history, service, asset, name, isFocusedInitial = false, isLocked = false, onDone, onMessage, className = '' }) {
	const ref = useRef(null);
	useEffect(() => {
		const element = ref.current;
		if (!isFocusedInitial || !element) return;
		element.focus({ preventScroll: true });
		const range = document.createRange();
		range.selectNodeContents(element);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
	}, [isFocusedInitial]);
	const commit = async (text) => {
		const result = await cvPaperRename(history, service, asset, text, name);
		onMessage?.(result?.code === 0 || result === undefined ? '' : result.message || 'The name was not written.');
		// an empty name is not written: the field shows the name again
		if (ref.current && ref.current.isConnected && document.activeElement !== ref.current && result?.code !== 0) ref.current.textContent = name;
	};
	return (
		<EditValueInline
			ref={ref}
			value={name}
			isLocked={isLocked}
			className={`doc-cv-paper-name-field ${className}`}
			aria-label="The name of the paper"
			title="Its name: Enter keeps it, Esc puts it back. Its path stays as it is"
			onCommit={commit}
			onBlur={() => {
				// what was scrolled to while typing a long name: its start is read again
				if (ref.current) ref.current.scrollLeft = 0;
				onDone?.();
			}}
			// a double click selects a word of it; it does not open the paper under it
			onDoubleClick={(event) => event.stopPropagation()}
			onClick={(event) => event.stopPropagation()}
		/>
	);
}

// The history of the block (cv-edit-history.js), and the page's undo and redo (Ctrl/⌘ + Z, Ctrl/⌘ +
// Shift + Z) answered with it while the author is at what rootGet() gives: the panel of papers, a
// sheet. A sheet drawn in the panel shares the history of its block, so whichever is asked first
// answers the same. Nothing written: the page's undo goes on to the document
//   isWritable   the object can be written now (the document is edited)
export function useCvEditHistory(config, { rootGet, isWritable }) {
	const history = cvEditHistoryGet(cvEditHistoryKeyGet(config));
	const answer = (direction, data) => {
		const root = rootGet?.();
		if (!isWritable || !root) return undefined;
		const target = data?.target;
		if (target instanceof Element && !root.contains(target) && !target.contains(root)) return undefined;
		return direction === 'undo' ? history.undo() : history.redo();
	};
	useDocEventSubscribe(config, 'historyUndo', (data) => answer('undo', data));
	useDocEventSubscribe(config, 'historyRedo', (data) => answer('redo', data));
	return history;
}

// Undo and redo of the history as two buttons, what they take back said in their tooltips; the
// same as Ctrl/⌘ + Z and Ctrl/⌘ + Shift + Z while the author is here. A step that cannot be taken
// back (its item changed since, elsewhere) is said beside them
export const CvUndoRedo = observer(function CvUndoRedo({ history, isWritable }) {
	const [message, messageSet] = useState('');
	const step = async (direction) => {
		const result = await (direction === 'undo' ? history.undo() : history.redo());
		messageSet(/^Not /.test(result?.message ?? '') ? result.message : '');
	};
	const reason = isWritable ? '' : ' (the object cannot be written now)';
	return (
		<span className="doc-cv-undo-redo" role="group" aria-label="Undo and redo">
			{message ? <span className="doc-error doc-cv-undo-redo-message" role="alert" title={message}>{message}</span> : null}
			<button type="button" className="doc-button" disabled={!isWritable || !history.undoLabel} title={history.undoLabel ? `Undo: ${history.undoLabel} (Ctrl/⌘ + Z)${reason}` : 'Nothing changed here to undo'} aria-label="Undo" onClick={() => step('undo')}>
				<Undo2 size={12} strokeWidth={2.2} aria-hidden="true" />
			</button>
			<button type="button" className="doc-button" disabled={!isWritable || !history.redoLabel} title={history.redoLabel ? `Redo: ${history.redoLabel} (Ctrl/⌘ + Shift + Z)${reason}` : 'Nothing undone here to redo'} aria-label="Redo" onClick={() => step('redo')}>
				<Redo2 size={12} strokeWidth={2.2} aria-hidden="true" />
			</button>
		</span>
	);
});

// one history per block: the mode of the object at its place
function cvEditHistoryKeyGet(config) {
	return String(config?.instanceId || config?.stateKey || 'cv');
}
