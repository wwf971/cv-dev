import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { makeAutoObservable } from 'mobx';
import { observer } from 'mobx-react-lite';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CellEdit, CellValue, EditValueInline, cellStyleTextIsStyled, timeTextDisplay, timeTextGet, useCell, useObjectFrontendInner } from '@wwf971/react-doc';
import { FolderView } from '@wwf971/react-comp-misc';
import { cvLeafQueryGet, cvProfileInnerSplit, cvProfileRead } from '../query/CvProfile.js';
import { CV_VERSION_MARK, cvLeafVersionListGet, cvQueryResolve, cvQueryVersionSplit } from '../query/CvQuery.js';
import { cvProfileValueChoiceListGet, cvProfileValueVersionChange, cvProfileValueWrite } from './cv-profile-value.js';
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
//   query          the query path: name/jp/last, address/jp/postal; pr/jp@2 for one version of it
//   isEditable     whether a change may be made now; editUnavailableReason why not
//   dateNow        the date what is derived is read at (an age)
//   close          what closes the card holding it (react-doc's card of a token): one simple value
//                  of one line saved by Save or Enter closes it, the work done; a click on the token
//                  opens it again. a value made of others, or of several lines, keeps it open
//   widthSet       what asks the card holding it for its width: a value that is a text (of several
//                  lines, or longer than a line of the card) asks for a wide card, as wide as the
//                  place it is named in, so that it breaks into the lines it has there
//   isFocusedInitial   the value is typed at once: the card was opened on a value just named
//                  (/new, a new path), so its field takes the focus
//   versionPinSet(versionId | undefined)   where the query is written in a place that can be
//                  written again (a token of a cell): that place reads this version from now on
//                  (undefined: the head again). absent, the place cannot be pinned from here
//
// What the query reads decides what is shown:
//   one value kept           that value, typed in place: Enter, or leaving it, keeps it in the profile.
//                            a value that is a text (several lines, longer than a line of the card,
//                            or written in styles) is typed in a surface of its own, where its words
//                            take styles (bold, a color: react-doc's cell editing kit, a bar under the
//                            words selected), with its own Save (Ctrl/⌘ + Enter) and Cancel
//   a value made of others   (a whole name of its last and first part, katakana read off hiragana)
//                            each value it is made of, typed in place
//   nothing                  that nothing holds it yet, and a place to type one: it is added where
//                            the path names it
// A change is written when the field is left (Enter, a click elsewhere) or by Save, for every paper of
// the partition, and the card says so; Esc or Cancel puts it back (cv-value-edit.jsx).
//
// One value kept has versions (doc/cv-query.md#versions-of-a-value). The chip beside its path says
// which one is read here (v3 head: the head, followed; v2 pinned: that version, whatever the head
// is) and opens their list. What is typed is kept in that version (Save, Enter, leaving the field)
// or as a new one (New version): the new version is what this place reads, so a place following the
// head moves the head to it, and a place pinned to a version is pinned to the new one, the head
// staying. In the list a version is made the head (Set as head), read here whatever the head
// becomes (Pin here), or taken out (Delete, never the head), and has a note saying what it is for.
export const CvProfileValuePanel = observer(function CvProfileValuePanel({ profile, partition, query, isEditable = false, editUnavailableReason = '', dateNow, close, widthSet, isFocusedInitial = false, versionPinSet }) {
	const [store] = useState(() => new CvValueVersionStore());
	const edit = useCvValueEdit();
	// the cell a value that is a text is drawn and typed with: words in styles, no token
	const cellValue = useCell({ tokenIdList: [] });
	// the value takes more than a line of the card: a text, though it holds no line break
	const [isTextMeasured, isTextMeasuredSet] = useState(false);
	// whether the value is a text: decided once, when it is first drawn, by what it is (several lines)
	// or how it is drawn (more than one line of the card), never by its path; the card keeps its width
	// while the value is typed
	const leafRef = useRef(null);
	const isWidthDecidedRef = useRef(false);
	useLayoutEffect(() => {
		if (isWidthDecidedRef.current) return;
		const element = leafRef.current?.querySelector('.doc-cv-value-panel-value');
		if (!element) return;
		isWidthDecidedRef.current = true;
		const style = getComputedStyle(element);
		const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2 || 16;
		// the height of its text, without its padding: more than a line and a half is two lines or more
		const heightText = element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
		const isText = element.hasAttribute('data-lines') || heightText > lineHeight * 1.5;
		if (!isText) return;
		widthSet?.('wide');
		isTextMeasuredSet(true);
	});
	// a card opened on a value just named: its field is typed at once (once it is drawn: the profile
	// may still be read)
	const isFocusPendingRef = useRef(isFocusedInitial);
	useEffect(() => {
		if (!isFocusPendingRef.current) return;
		if (edit.focus('missing') || edit.focus('leaf')) isFocusPendingRef.current = false;
	});
	if (!profile) return <p className="doc-note doc-cv-value-panel-note">No profile is read here.</p>;
	const read = cvProfileRead(profile, {}, partition);
	if (read.countLoading > 0) return <p className="doc-note doc-cv-value-panel-note">Reading the profile…</p>;
	const { info } = read;
	const resolved = cvQueryResolve(info, query, { dateNow: dateNow ?? new Date() });
	const partitionOne = (profile.partitionList ?? []).find((one) => one.id === partition);
	const partitionLabel = partitionOne?.label || partition || '(none)';
	const isWriting = store.status === 'writing';
	const queryPath = cvQueryVersionSplit(query).path;
	const isFound = resolved.status === 'found';
	const leaf = isFound ? resolved.leaf : undefined;
	// the version this place reads: its head, or the one the query names
	const version = leaf ? resolved.version : undefined;
	const versionList = leaf ? cvLeafVersionListGet(leaf) : [];
	const versionShown = version ? versionList.find((one) => one.id === version.id) : undefined;
	// isClosedAfter: the card closes once the value is kept (one simple value, saved by Save or Enter)
	const valueWrite = (path, text, option, { isClosedAfter = false } = {}) => store.run(async () => {
		const result = await cvProfileValueWrite(profile, info, path, text, partition, option);
		if (result?.code === 0 && isClosedAfter) close?.();
		return result;
	});
	// the value the query reads, kept in the version read here, or (mode 'newVersion') as a new one,
	// which this place reads then: the head moves to it when the place follows the head, the place
	// is pinned to it when it was pinned to another
	const leafWrite = (text, mode, isClosedAfter) => store.run(async () => {
		const isNew = mode === 'newVersion';
		const isPinKept = isNew && version?.isPinned === true && Boolean(versionPinSet);
		const result = await cvProfileValueWrite(profile, info, queryPath, text, partition, {
			isList: versionShown?.isList ?? leaf.isList,
			mode: isNew ? 'newVersion' : 'inPlace',
			versionId: isNew ? undefined : version?.id,
			isHeadMoved: !isPinKept,
			time: isNew ? timeTextGet() : '',
		});
		if (result?.code !== 0) return result;
		if (isPinKept) versionPinSet(result.data?.versionId);
		else if (isClosedAfter && !isNew) close?.();
		return result;
	});
	const versionChange = (change) => store.run(() => cvProfileValueVersionChange(profile, leaf, change));
	// a value made of others: each of them changed where it is
	const partList = isFound && !leaf ? resolved.leafList.filter((one) => one?.assetKey) : [];
	const isImage = isFound && String(resolved.value).startsWith('data:');
	const valueShown = versionShown?.value ?? leaf?.value ?? '';
	// a value that is a text is typed in a surface of its own, with its own Save and Cancel
	const isLines = Boolean(leaf) && (isTextMeasured || cvValueIsText(valueShown));
	const isTyped = isEditable && !isImage && (Boolean(leaf) || partList.length > 0 || !isFound);
	// a value with common values (the status of an education): each a button, the one it holds pressed
	const choiceList = isEditable && !isImage && (leaf || !isFound) ? cvProfileValueChoiceListGet(query) : [];
	const isVersionShown = Boolean(leaf) && !isImage;
	return (
		<div className="doc-cv-value-panel">
			<div className="doc-cv-value-panel-head">
				<div className="doc-cv-value-panel-path" title={`the query ${queryPath} of the profile`}>{queryPath}</div>
				{isVersionShown && version ? <CvValueVersionChip store={store} version={version} /> : null}
			</div>
			{isImage ? <p className="doc-note doc-cv-value-panel-note">An image: it is changed where it is drawn (a click on the photo).</p> : null}
			{!isImage && leaf ? (
				<div ref={leafRef} className="doc-cv-value-panel-leaf">
					<CvValueField key={`${leaf.assetKey}:${leaf.keyPath.join('/')}:${version?.id}`} value={valueShown} label={`The value at ${query}`} isEditable={isEditable && !isWriting} isText={isLines} cell={cellValue} bindProps={edit.bind('leaf', valueShown)} isNewVersionOffered onCommit={(text, mode) => leafWrite(text, mode ?? edit.modeTake(), edit.intentTake())} />
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
								<CvValueField value={one.value} label={`The value at ${path}`} isEditable={isEditable && !isWriting} cell={cellValue} bindProps={edit.bind(path, one.value)} onCommit={(text) => { edit.intentTake(); edit.modeTake(); return valueWrite(path, text, { isList: one.isList }); }} />
							</div>
						);
					})}
				</>
			) : null}
			{!isFound ? (
				<>
					<p className="doc-cv-value-panel-missing">{resolved.message && cvQueryVersionSplit(query).version ? `${resolved.message}.` : `Nothing of the profile holds ${queryPath} yet.`}</p>
					{isEditable && !cvQueryVersionSplit(query).version ? <CvValueField value="" placeholder="Its value: typed here, it is added" label={`A value for ${query}`} isEditable={!isWriting} bindProps={edit.bind('missing', '')} onCommit={(text) => { edit.modeTake(); return valueWrite(queryPath, text, undefined, { isClosedAfter: edit.intentTake() }); }} /> : null}
				</>
			) : null}
			{choiceList.length > 0 ? (
				<div className="doc-cv-value-panel-choices" role="group" aria-label="Common values">
					{choiceList.map((choice) => (
						<button key={choice} type="button" className="doc-button" aria-pressed={String(valueShown) === choice} disabled={isWriting} title={`Keep ${choice} in the profile`} onMouseDown={(event) => event.preventDefault()} onClick={() => { if (String(valueShown) !== choice) void (leaf ? leafWrite(choice, 'inPlace', true) : valueWrite(queryPath, choice, undefined, { isClosedAfter: true })); }}>
							{choice}
						</button>
					))}
				</div>
			) : null}
			{isTyped && !isLines ? (
				<div className="doc-cv-value-panel-actions">
					<CvSaveCancel edit={edit} saveTitle={leaf && versionList.length > 1 ? `Keep it in version ${version?.id} (Enter)` : 'Keep it in the profile (Enter)'} isNewVersionOffered={Boolean(leaf)} newVersionTitle={newVersionTitleGet(version, versionPinSet)} />
				</div>
			) : null}
			{isVersionShown && store.isListOpen ? (
				<CvValueVersionList store={store} versionList={versionList} version={version} isEditable={isEditable && !isWriting} versionChange={versionChange} versionPinSet={versionPinSet} />
			) : null}
			{store.status === 'error' ? <p className="doc-error doc-cv-value-panel-note" role="alert">{store.message}</p> : null}
			<p className="doc-cv-profile-muted doc-cv-value-panel-where" title={partitionOne?.isGitIgnored ? 'kept out of git' : 'tracked by git'}>
				{isEditable
					? `In the profile, partition ${partitionLabel}: saved there, for every paper of it.`
					: `In the profile, partition ${partitionLabel}.${editUnavailableReason ? ` Not changed here: ${editUnavailableReason}.` : ''}`}
			</p>
		</div>
	);
});

// what the card shows of the versions of its value, and the write in progress: the card's own
// state, gone with it
class CvValueVersionStore {
	// the list of the versions is shown under the value
	isListOpen = false;
	// the version chosen in the list: what its buttons act on ('' none: the version read here)
	versionIdSelected = '';
	// idle | writing | error, and why a write was refused
	status = 'idle';
	message = '';

	constructor() {
		makeAutoObservable(this);
	}

	listToggle() {
		this.isListOpen = !this.isListOpen;
	}

	versionSelect(versionId) {
		this.versionIdSelected = versionId === undefined || versionId === null ? '' : String(versionId);
	}

	// a write of the profile, one at a time; what it answers is the card's state
	async run(write) {
		if (this.status === 'writing') return { code: -1, message: 'a change is being written' };
		this.statusSet('writing', '');
		let result;
		try {
			result = await write();
		} catch (error) {
			result = { code: -1, message: String(error?.message ?? error) };
		}
		const isDone = result?.code === 0 || result?.code === undefined;
		this.statusSet(isDone ? 'idle' : 'error', isDone ? '' : result?.message || 'it could not be written');
		return isDone ? { ...result, code: 0 } : result;
	}

	statusSet(status, message) {
		this.status = status;
		this.message = message;
	}
}

function newVersionTitleGet(version, versionPinSet) {
	if (version?.isPinned && versionPinSet) return `Keep it as a new version, read here instead of version ${version.id}: the head stays what it is`;
	return 'Keep it as a new version, the head from now on: the version shown stays as it was';
}

// the version read here, beside the path: v3 head (the head, followed), v2 pinned (that version,
// whatever the head is). a click shows the versions of the value under it
const CvValueVersionChip = observer(function CvValueVersionChip({ store, version }) {
	const state = version.isPinned ? 'pinned' : 'head';
	const title = version.isPinned
		? `This place reads version ${version.id} of ${version.count}, whatever the head is${version.isHead ? ' (it is the head now)' : ''}. Click: the versions`
		: `This place reads the head, now version ${version.id} of ${version.count}. Click: the versions`;
	return (
		<button type="button" className="doc-cv-value-version-chip" data-state={state} aria-expanded={store.isListOpen} title={title} onMouseDown={(event) => event.preventDefault()} onClick={() => store.listToggle()}>
			<span className="doc-cv-value-version-chip-id">v{version.id}</span>
			<span>{state}</span>
			{store.isListOpen ? <ChevronUp size={11} aria-hidden="true" /> : <ChevronDown size={11} aria-hidden="true" />}
		</button>
	);
});

const VERSION_COLUMN_LIST = [
	{ id: 'version', label: 'Version', width: 104 },
	{ id: 'time', label: 'Saved', width: 104 },
	{ id: 'text', label: 'What it says', width: 120 },
];
const VERSION_ROW_HEIGHT = 25;
const VERSION_ROW_COUNT_MAX = 5;

// the versions of the value, newest first, in the table of react-comp-misc (FolderView): one
// chosen by a click, and under the table what is done with the one chosen
const CvValueVersionList = observer(function CvValueVersionList({ store, versionList, version, isEditable, versionChange, versionPinSet }) {
	const rowList = [...versionList].reverse();
	const versionIdRead = version?.id;
	const selected = rowList.find((one) => String(one.id) === store.versionIdSelected) ?? rowList.find((one) => one.id === versionIdRead) ?? rowList[0];
	const rowById = new Map(rowList.map((one) => [String(one.id), one]));
	const context = { versionIdRead, isPinned: version?.isPinned === true };
	const folderData = {
		columns: Object.fromEntries(VERSION_COLUMN_LIST.map((column) => [column.id, { data: column.label }])),
		colsOrder: VERSION_COLUMN_LIST.map((column) => column.id),
		rows: rowList.map((one) => ({ id: String(one.id), data: {} })),
		rowIdsSelected: selected ? [String(selected.id)] : [],
		getRowData: (rowId) => ({ row: rowById.get(rowId), context }),
	};
	const folderConfig = {
		colSizeById: Object.fromEntries(VERSION_COLUMN_LIST.map((column) => [column.id, { width: column.width, minWidth: 48, resizable: true }])),
		isLastColFilled: true,
		isListOnly: true,
		isStatusBarVisible: false,
		selectionMode: 'single',
		// one height whatever is chosen: the rows scroll inside past a few
		bodyHeight: (Math.min(rowList.length, VERSION_ROW_COUNT_MAX) + 1) * VERSION_ROW_HEIGHT + 2,
		compBodyByColId: cvVersionCellCompGet,
		isContextMenuBuiltInDisabled: true,
	};
	const onEvent = async (eventType, eventData) => {
		if (eventType === 'rowIdsSelectedChange') store.versionSelect(eventData?.rowIdsSelected?.[0] ?? '');
		return { code: 0 };
	};
	const isSelectedRead = selected?.id === versionIdRead;
	const focusKeep = (event) => event.preventDefault();
	return (
		<div className="doc-cv-value-version">
			<div className="doc-cv-value-version-table">
				<FolderView data={folderData} config={folderConfig} onEvent={onEvent} />
			</div>
			{selected ? (
				<>
					<div className="doc-cv-value-version-note">
						<span className="doc-cv-profile-muted">Note of v{selected.id}</span>
						{isEditable
							? <EditValueInline key={`note:${selected.id}`} className="doc-cv-value-version-note-text" value={selected.note} placeholder="what this version is for" aria-label={`The note of version ${selected.id}`} onCommit={(note) => versionChange({ type: 'noteSet', versionId: selected.id, note })} />
							: <span className="doc-cv-value-version-note-text" data-readonly="">{selected.note || <span className="doc-cv-profile-muted">none</span>}</span>}
					</div>
					<div className="doc-cv-value-version-actions" role="group" aria-label={`Version ${selected.id}`}>
						<button type="button" className="doc-button" disabled={!isEditable || selected.isHead} title={selected.isHead ? `Version ${selected.id} is the head` : `Make version ${selected.id} the head: what every query naming no version reads`} onMouseDown={focusKeep} onClick={() => versionChange({ type: 'headSet', versionId: selected.id })}>
							Set as head
						</button>
						{versionPinSet ? (
							version?.isPinned && isSelectedRead
								? <button type="button" className="doc-button" disabled={!isEditable} title="This place reads the head again, whichever version that becomes" onMouseDown={focusKeep} onClick={() => versionPinSet(undefined)}>Follow head</button>
								: <button type="button" className="doc-button" disabled={!isEditable} title={`This place reads version ${selected.id} from now on, whatever the head becomes (${CV_VERSION_MARK}${selected.id})`} onMouseDown={focusKeep} onClick={() => versionPinSet(selected.id)}>Pin here</button>
						) : null}
						<button type="button" className="doc-button" disabled={!isEditable || selected.isHead} title={selected.isHead ? 'The head is never taken out: make another version the head first' : `Take version ${selected.id} out of the profile; a place pinned to it reads nothing then`} onMouseDown={focusKeep} onClick={() => { store.versionSelect(''); void versionChange({ type: 'remove', versionId: selected.id }); }}>
							Delete
						</button>
					</div>
				</>
			) : null}
		</div>
	);
});

// a cell of the table of versions: one component, reading the version of its row
const CvVersionCell = observer(function CvVersionCell({ data, colId }) {
	const { row, context } = data ?? {};
	if (!row) return null;
	if (colId === 'version') {
		return (
			<span className="doc-cv-value-version-id">
				<span>{row.id}</span>
				{row.isHead ? <span className="doc-cv-value-version-badge" data-kind="head" title="The head: what a query naming no version reads">head</span> : null}
				{row.id === context.versionIdRead ? <span className="doc-cv-value-version-badge" data-kind="here" title={context.isPinned ? 'Read here: this place is pinned to it' : 'Read here: this place follows the head'}>here</span> : null}
			</span>
		);
	}
	// when it was saved, with its zone; a version written before versions were kept says none
	if (colId === 'time') return <span className="doc-cv-profile-muted" title={row.time ? timeTextDisplay(row.time, { part: 'second' }) : 'not recorded'}>{row.time ? timeTextDisplay(row.time, { isYearShown: false }) : '—'}</span>;
	const preview = String(row.value).startsWith('data:') ? '(image)' : String(row.value).replace(/\n/g, ' / ');
	return <span title={row.value}>{row.note ? <span className="doc-cv-value-version-note-mark">{row.note} · </span> : null}{preview || <span className="doc-cv-profile-muted">(empty)</span>}</span>;
});
const cvVersionCellCompGet = () => CvVersionCell;

// a value that is a text by what it holds: a line break, or words written in a style
function cvValueIsText(value) {
	const text = String(value ?? '');
	return text.includes('\n') || cellStyleTextIsStyled(text);
}

// one value typed in place: a line by EditValueInline (Enter or leaving it keeps it, Esc puts it back;
// the panel's Save and Cancel act on it: bindProps); a value that is a text (isText; by default: what
// it holds says so) by a surface with its own Save (Ctrl/⌘ + Enter) and Cancel (Esc), where its
// words take styles (cell: the cell of the panel). read only, the text, drawn in its styles.
// onCommit(text, mode): mode is said by the surface of a text ('newVersion' from its own button);
// a line says none, and the panel asks its Save and Cancel (edit.modeTake)
function CvValueField({ value, placeholder = '(empty)', label, isEditable, isText, cell, bindProps, isNewVersionOffered = false, onCommit }) {
	if (!isEditable) return <div className="doc-cv-value-panel-value" data-readonly="">{value === '' ? <span className="doc-cv-profile-muted">{placeholder}</span> : (cell ? <CellValue cell={cell} text={String(value)} /> : value)}</div>;
	if (!(isText ?? cvValueIsText(value))) {
		return <EditValueInline className="doc-cv-value-panel-value" value={value} placeholder={placeholder} aria-label={label} onCommit={(text) => onCommit(text)} {...bindProps} />;
	}
	return <CvValueLines value={value} label={label} cell={cell} isNewVersionOffered={isNewVersionOffered} onCommit={onCommit} />;
}

function CvValueLines({ value, label, cell, isNewVersionOffered, onCommit }) {
	const [draft, draftSet] = useState(undefined);
	// the surface written again from the value: Cancel puts it back
	const [version, versionSet] = useState(0);
	const isChanged = draft !== undefined && draft !== value;
	const save = (mode) => {
		if (!isChanged) return;
		onCommit(draft, mode);
		draftSet(undefined);
	};
	const cancel = () => {
		draftSet(undefined);
		versionSet((one) => one + 1);
	};
	return (
		<div className="doc-cv-value-panel-lines">
			<div className="doc-cv-value-panel-value" data-lines="">
				<CellEdit key={version} cell={cell} text={value} isFocusedInitial={false} isTabInserted={false} ariaLabel={label} onTextChange={draftSet} onSubmitRequest={() => save('inPlace')} onCancelRequest={cancel} />
			</div>
			<div className="doc-cv-value-panel-actions">
				<CvSaveCancel edit={{ isChanged, save: () => save('inPlace'), saveNew: () => save('newVersion'), cancel }} saveTitle="Keep it in the profile (Ctrl/⌘ + Enter)" isNewVersionOffered={isNewVersionOffered} />
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
