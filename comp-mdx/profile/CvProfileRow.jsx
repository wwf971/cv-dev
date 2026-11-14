import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { Check, Copy, Trash2, X } from 'lucide-react';
import { EditValueInline } from '@wwf971/react-doc';
import { cvLeafPatternGet } from '../query/CvProfile.js';
import { cvInfoDraftPathGet, cvValueIsImage } from '../query/CvInfoTree.js';
import { CvJpImagePick } from '../jp/CvJpImagePick.jsx';

// The rows both views of the mode Information share (CvProfileTree.jsx, CvProfileExplore.jsx):
// a value, and a value being added. A row is name | value | what can be done with it; what
// stands in the name cell is the view's (a name at its depth, a group, a whole path).

// a value being edited in place has this class: what the arrows go between
export const CV_PROFILE_EDIT_CLASS = 'doc-cv-profile-edit';

// Up and Down in a value being edited go to the value above or below, as in a sheet of cells.
// Leaving a value saves it when it was changed: the editor commits as it loses the focus. In a
// value of several lines the arrows first move inside it, and leave from its first or last line
export function cvProfileEditKeyDown(event) {
	if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
	if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey || event.nativeEvent?.isComposing) return;
	const element = event.currentTarget;
	const isUp = event.key === 'ArrowUp';
	if (!caretIsAtEdge(element, isUp)) return;
	const editList = [...(element.closest('.doc-cv-profile-body')?.querySelectorAll(`.${CV_PROFILE_EDIT_CLASS}`) ?? [])];
	const target = editList[editList.indexOf(element) + (isUp ? -1 : 1)];
	if (!target) return;
	event.preventDefault();
	target.focus();
	// the caret at the end of the value arrived at, where typing goes on
	const range = document.createRange();
	range.selectNodeContents(target);
	range.collapse(false);
	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
	target.scrollIntoView({ block: 'nearest' });
}

// whether the caret is on the first line of an element (isUp) or on its last: by where it is
// drawn, since a long value wraps into lines no character says
function caretIsAtEdge(element, isUp) {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0 || !element.contains(selection.anchorNode)) return true;
	const range = selection.getRangeAt(0).cloneRange();
	range.collapse(isUp);
	const rectCaret = range.getClientRects()[0] ?? range.getBoundingClientRect();
	const rectElement = element.getBoundingClientRect();
	// an empty value, or a caret the browser gives no place for: one line
	if (!rectCaret || rectCaret.height === 0) return true;
	const lineHeight = rectCaret.height;
	return isUp ? rectCaret.top - rectElement.top < lineHeight * 0.75 : rectElement.bottom - rectCaret.bottom < lineHeight * 0.75;
}

const DEPTH_INDENT = 14;
export const cvProfileIndentStyle = (depth) => ({ paddingLeft: `${depth * DEPTH_INDENT}px` });

// a value: read, changed in place while the document is edited, copied as a query, removed
//   id           the row among the rows (what "copied" is said at)
//   depth        how far the name is indented
//   children     the name cell
export const CvProfileRowLeaf = observer(function CvProfileRowLeaf({ id, leaf, depth = 0, store, service, isEditShown, isLocked, lockedReason, children }) {
	const isImage = cvValueIsImage(leaf.value);
	const query = `{{${leaf.path}}}`;
	const isCopied = store.copiedId === id;
	return (
		<div className="doc-cv-profile-row" data-kind="leaf">
			<span className="doc-cv-profile-name" style={cvProfileIndentStyle(depth)} title={`${cvLeafPatternGet(leaf)}: a CV reads it as ${query}`}>
				{children}
			</span>
			<span className="doc-cv-profile-value">
				{isImage ? <img className="doc-cv-profile-thumb" src={leaf.value} alt="" />
					: !isEditShown ? <span className="doc-cv-profile-text">{leaf.value}</span>
					: <EditValueInline className={CV_PROFILE_EDIT_CLASS} value={leaf.value} placeholder="(empty)" isLocked={isLocked} title={lockedReason || undefined} newlineAs={leaf.isList || leaf.value.includes('\n') ? '\n' : ' '} onKeyDown={cvProfileEditKeyDown} onCommit={(value) => store.leafSet(service, leaf, value)} />}
			</span>
			<span className="doc-cv-profile-action-list">
				{isImage && isEditShown ? <CvJpImagePick label="Replace…" isPasteTaken={false} isDisabled={isLocked} onImage={(image) => store.leafSet(service, leaf, image)} onProblem={store.messageSet} /> : null}
				<button type="button" className="doc-cv-profile-icon-button" aria-label={`Copy ${query}`} title={isCopied ? 'Copied' : `Copy ${query}, what a CV writes to read this value`} onClick={() => store.copy(id, query)}>
					{isCopied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
				</button>
				{isEditShown ? (
					<button type="button" className="doc-cv-profile-icon-button" disabled={isLocked} aria-label={`Remove ${leaf.path}`} title={lockedReason || `Remove ${leaf.path}`} onClick={() => store.leafRemove(service, leaf)}>
						<Trash2 size={13} aria-hidden="true" />
					</button>
				) : null}
			</span>
		</div>
	);
});

// a value being added (store.draft): its name, then its value; Enter goes on, then adds; Esc
// gives up. It is typed at the place it will be: the first row of its folder
export const CvProfileRowDraft = observer(function CvProfileRowDraft({ depth = 0, store, service, info, partitionId }) {
	const nameRef = useRef(null);
	const valueRef = useRef(null);
	const { draft } = store;
	const pathParent = draft?.pathParent ?? '';
	// the row of another folder is another row: its name is focused as it comes
	useEffect(() => {
		nameRef.current?.focus();
		nameRef.current?.scrollIntoView({ block: 'nearest' });
	}, [pathParent]);
	if (!draft) return null;
	const add = () => store.leafAdd(service, info, partitionId);
	const onKeyDown = (event) => {
		if (event.nativeEvent?.isComposing) return;
		if (event.key === 'Escape') { event.stopPropagation(); store.draftClose(); }
		else if (event.key === 'Enter') {
			event.preventDefault();
			if (event.currentTarget === nameRef.current && draft.value === '') valueRef.current?.focus();
			else void add();
		}
	};
	const pathFull = cvInfoDraftPathGet(pathParent, draft.name);
	return (
		<div className="doc-cv-profile-row" data-kind="draft">
			<span className="doc-cv-profile-name" style={cvProfileIndentStyle(depth)}>
				<span className="doc-cv-profile-chevron-space" />
				<input ref={nameRef} className="doc-cv-profile-input" aria-label={pathParent ? `The name of a new value in ${pathParent}` : 'The path of a new value'} placeholder={pathParent ? 'its name: floor' : 'its path: address/jp/postal'} value={draft.name} onChange={(event) => store.draftSet({ name: event.target.value })} onKeyDown={onKeyDown} />
			</span>
			<span className="doc-cv-profile-value">
				<input ref={valueRef} className="doc-cv-profile-input" aria-label="The new value" placeholder="its value" value={draft.value} onChange={(event) => store.draftSet({ value: event.target.value })} onKeyDown={onKeyDown} />
			</span>
			<span className="doc-cv-profile-action-list" data-shown="">
				<button type="button" className="doc-cv-profile-icon-button" data-primary="" disabled={store.isSubmitting} aria-label="Add the value" title={draft.name.trim() ? `Add ${pathFull}` : 'Add the value'} onClick={add}><Check size={13} aria-hidden="true" /></button>
				<button type="button" className="doc-cv-profile-icon-button" aria-label="Cancel" title="Cancel" onClick={store.draftClose}><X size={13} aria-hidden="true" /></button>
			</span>
		</div>
	);
});
