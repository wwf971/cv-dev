import { useLayoutEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { CellEdit, EditValueInline, useObjectFrontendInner } from '@wwf971/react-doc';
import { cvLeafQueryGet, cvProfileInnerSplit, cvProfileRead } from '../query/CvProfile.js';
import { cvQueryResolve } from '../query/CvQuery.js';
import { cvProfileValueChoiceListGet, cvProfileValueWrite } from './cv-profile-value.js';
import { CvSaveCancel, useCvValueEdit } from './cv-value-edit.jsx';
import './CvProfile.css';

// A value of a profile where something names it (doc/cv-query.md#a-value-where-it-is-named): what
// the query reads, typed in place when it may be changed, and where it is kept. It is the card of a
// query in a cell of a paper ({{address/jp/postal}}, cv-query-cell.js) and the view of a value of a
// profile in the context panel of react-doc's object registry, the card of a token naming it from
// any cell of any page ({{@frontend:{profile}#example/address/jp/postal}}, CvProfileValueView).
//
//   profile        the api of the profile object
//   partition      the partition read (a paper reads its own)
//   query          the query path: name/jp/last, address/jp/postal
//   isEditable     whether a change may be made now; editUnavailableReason why not
//   dateNow        the date what is derived is read at (an age)
//   close          what closes the card holding it (react-doc's card of a token): one simple value
//                  of one line saved by Save or Enter closes it, the work done; a click on the token
//                  opens it again. a value made of others, or of several lines, keeps it open
//   widthSet       what asks the card holding it for its width: a value that is a text (of several
//                  lines, or longer than a line of the card) asks for a wide card, as wide as the
//                  place it is named in, so that it breaks into the lines it has there
//
// What the query reads decides what is shown:
//   one value kept           that value, typed in place: Enter, or leaving it, keeps it in the profile
//   a value made of others   (a whole name of its last and first part, katakana read off hiragana)
//                            each value it is made of, typed in place
//   nothing                  that nothing holds it yet, and a place to type one: it is added where
//                            the path names it
// A change is written when the field is left (Enter, a click elsewhere) or by Save, for every paper of
// the partition, and the card says so; Esc or Cancel puts it back (cv-value-edit.jsx).
export const CvProfileValuePanel = observer(function CvProfileValuePanel({ profile, partition, query, isEditable = false, editUnavailableReason = '', dateNow, close, widthSet }) {
	const [write, writeSet] = useState({ status: 'idle', message: '' });
	const edit = useCvValueEdit();
	// whether the value is a text: decided once, when it is first drawn, by what it is (several lines)
	// or how it is drawn (more than one line of the card), never by its path; the card keeps its width
	// while the value is typed
	const leafRef = useRef(null);
	const isWidthDecidedRef = useRef(false);
	useLayoutEffect(() => {
		if (isWidthDecidedRef.current || !widthSet) return;
		const element = leafRef.current?.querySelector('.doc-cv-value-panel-value');
		if (!element) return;
		isWidthDecidedRef.current = true;
		const style = getComputedStyle(element);
		const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2 || 16;
		// the height of its text, without its padding: more than a line and a half is two lines or more
		const heightText = element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
		const isText = element.hasAttribute('data-lines') || heightText > lineHeight * 1.5;
		if (isText) widthSet('wide');
	});
	if (!profile) return <p className="doc-note doc-cv-value-panel-note">No profile is read here.</p>;
	const read = cvProfileRead(profile, {}, partition);
	if (read.countLoading > 0) return <p className="doc-note doc-cv-value-panel-note">Reading the profile…</p>;
	const { info } = read;
	const resolved = cvQueryResolve(info, query, { dateNow: dateNow ?? new Date() });
	const partitionOne = (profile.partitionList ?? []).find((one) => one.id === partition);
	const partitionLabel = partitionOne?.label || partition || '(none)';
	const isWriting = write.status === 'writing';
	// isClosedAfter: the card closes once the value is kept (one simple value, saved by Save or Enter)
	const valueWrite = async (path, text, option, { isClosedAfter = false } = {}) => {
		writeSet({ status: 'writing', message: '' });
		const result = await cvProfileValueWrite(profile, info, path, text, partition, option);
		const isDone = result?.code === 0 || result?.code === undefined;
		writeSet(isDone ? { status: 'idle', message: '' } : { status: 'error', message: result?.message || 'it could not be written' });
		if (isDone && isClosedAfter) close?.();
	};
	const isFound = resolved.status === 'found';
	const leaf = isFound ? resolved.leaf : undefined;
	// a value made of others: each of them changed where it is
	const partList = isFound && !leaf ? resolved.leafList.filter((one) => one?.assetKey) : [];
	const isImage = isFound && String(resolved.value).startsWith('data:');
	// a value of several lines is typed in a surface of its own, with its own Save and Cancel
	const isLines = Boolean(leaf) && String(leaf.value).includes('\n');
	const isTyped = isEditable && !isImage && (Boolean(leaf) || partList.length > 0 || !isFound);
	// a value with common values (the status of an education): each a button, the one it holds pressed
	const choiceList = isEditable && !isImage && (leaf || !isFound) ? cvProfileValueChoiceListGet(query) : [];
	return (
		<div className="doc-cv-value-panel">
			<div className="doc-cv-value-panel-path" title={`the query ${query} of the profile`}>{query}</div>
			{isImage ? <p className="doc-note doc-cv-value-panel-note">An image: it is changed where it is drawn (a click on the photo).</p> : null}
			{!isImage && leaf ? (
				<div ref={leafRef} className="doc-cv-value-panel-leaf">
					<CvValueField key={`${leaf.assetKey}:${leaf.keyPath.join('/')}`} value={leaf.value} label={`The value at ${query}`} isEditable={isEditable && !isWriting} bindProps={edit.bind('leaf', leaf.value)} onCommit={(text) => valueWrite(query, text, { isList: leaf.isList }, { isClosedAfter: edit.intentTake() })} />
				</div>
			) : null}
			{!isImage && partList.length > 0 ? (
				<>
					<div className="doc-cv-value-panel-read">
						<span className="doc-cv-profile-muted">Reads</span> {String(resolved.value)}
					</div>
					<div className="doc-cv-profile-muted">Made of {partList.length === 1 ? 'another value' : `${partList.length} values`} of the profile{isEditable ? ', each changed here' : ''}:</div>
					{partList.map((one) => {
						const path = cvLeafQueryGet(one);
						return (
							<div key={path} className="doc-cv-value-panel-part">
								<span className="doc-cv-value-panel-part-path" title={one.pathText}>{path}</span>
								<CvValueField value={one.value} label={`The value at ${path}`} isEditable={isEditable && !isWriting} bindProps={edit.bind(path, one.value)} onCommit={(text) => { edit.intentTake(); return valueWrite(path, text, { isList: one.isList }); }} />
							</div>
						);
					})}
				</>
			) : null}
			{!isFound ? (
				<>
					<p className="doc-cv-value-panel-missing">Nothing of the profile holds {query} yet.</p>
					{isEditable ? <CvValueField value="" placeholder="Its value: typed here, it is added" label={`A value for ${query}`} isEditable={!isWriting} bindProps={edit.bind('missing', '')} onCommit={(text) => valueWrite(query, text, undefined, { isClosedAfter: edit.intentTake() })} /> : null}
				</>
			) : null}
			{choiceList.length > 0 ? (
				<div className="doc-cv-value-panel-choices" role="group" aria-label="Common values">
					{choiceList.map((choice) => (
						<button key={choice} type="button" className="doc-button" aria-pressed={String(leaf?.value ?? '') === choice} disabled={isWriting} title={`Keep ${choice} in the profile`} onMouseDown={(event) => event.preventDefault()} onClick={() => { if (String(leaf?.value ?? '') !== choice) void valueWrite(query, choice, leaf ? { isList: leaf.isList } : undefined, { isClosedAfter: true }); }}>
							{choice}
						</button>
					))}
				</div>
			) : null}
			{isTyped && !isLines ? <div className="doc-cv-value-panel-actions"><CvSaveCancel edit={edit} saveTitle="Keep it in the profile (Enter)" /></div> : null}
			{write.status === 'error' ? <p className="doc-error doc-cv-value-panel-note" role="alert">{write.message}</p> : null}
			<p className="doc-cv-profile-muted doc-cv-value-panel-where" title={partitionOne?.isGitIgnored ? 'kept out of git' : 'tracked by git'}>
				{isEditable
					? `In the profile, partition ${partitionLabel}: saved there, for every paper of it.`
					: `In the profile, partition ${partitionLabel}.${editUnavailableReason ? ` Not changed here: ${editUnavailableReason}.` : ''}`}
			</p>
		</div>
	);
});

// one value typed in place: a line by EditValueInline (Enter or leaving it keeps it, Esc puts it back;
// the panel's Save and Cancel act on it: bindProps); a value of several lines by a surface with its
// own Save (Ctrl/⌘ + Enter) and Cancel (Esc). read only, the text
function CvValueField({ value, placeholder = '(empty)', label, isEditable, bindProps, onCommit }) {
	if (!isEditable) return <div className="doc-cv-value-panel-value" data-readonly="">{value === '' ? <span className="doc-cv-profile-muted">{placeholder}</span> : value}</div>;
	if (!String(value ?? '').includes('\n')) {
		return <EditValueInline className="doc-cv-value-panel-value" value={value} placeholder={placeholder} aria-label={label} onCommit={onCommit} {...bindProps} />;
	}
	return <CvValueLines value={value} label={label} onCommit={onCommit} />;
}

function CvValueLines({ value, label, onCommit }) {
	const [draft, draftSet] = useState(undefined);
	// the surface written again from the value: Cancel puts it back
	const [version, versionSet] = useState(0);
	const isChanged = draft !== undefined && draft !== value;
	const save = () => {
		if (!isChanged) return;
		onCommit(draft);
		draftSet(undefined);
	};
	const cancel = () => {
		draftSet(undefined);
		versionSet((one) => one + 1);
	};
	return (
		<div className="doc-cv-value-panel-lines">
			<div className="doc-cv-value-panel-value" data-lines="">
				<CellEdit key={version} text={value} isFocusedInitial={false} isTabInserted={false} ariaLabel={label} onTextChange={draftSet} onSubmitRequest={save} onCancelRequest={cancel} />
			</div>
			<div className="doc-cv-value-panel-actions">
				<CvSaveCancel edit={{ isChanged, save, cancel }} saveTitle="Keep it in the profile (Ctrl/⌘ + Enter)" />
			</div>
		</div>
	);
}

// the view of a value of a profile in the context panel of react-doc's object registry (type
// cv.profile.value, which the profile answers for its values: cvProfileInnerResolve): the card of
// a token naming it, wherever it is typed
export const CvProfileValueView = observer(function CvProfileValueView({ data = {}, config = {} }) {
	const { service, innerPath, isEditable, editUnavailableReason } = useObjectFrontendInner(data.ref, config);
	if (!service) return <p className="doc-note doc-cv-value-panel-note">{data.ref} names no profile.</p>;
	const { partition, query } = cvProfileInnerSplit(service, innerPath);
	return <CvProfileValuePanel profile={service} partition={partition} query={query} isEditable={isEditable} editUnavailableReason={editUnavailableReason} close={config.objectView?.close} widthSet={config.objectView?.widthSet} />;
});
