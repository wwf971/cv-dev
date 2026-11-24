import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { makeAutoObservable } from 'mobx';
import { observer } from 'mobx-react-lite';
import { ArrowDown, ArrowRight, ArrowUp, Columns3, Copy, House, LayoutGrid, Pencil, Plus, RotateCcw, Search, X } from 'lucide-react';
import { AnchoredPopover, DocMenu, docMenuEntryBuild, timeTextDisplay, useCompStateStore } from '@wwf971/react-doc';
import { FolderView } from '@wwf971/react-comp-misc';
import { PathNavStore, pathNavBuild } from '@react-doc-package/cloud-dev-vis/comp-mdx/card-diagram-switch/PathNav.js';
import { PathNavBar } from '@react-doc-package/cloud-dev-vis/comp-mdx/card-diagram-switch/PathNavBar.jsx';
import { CV_JP_FORM_LIST, CV_KIND_CV, CV_KIND_PART, CV_KIND_TEMPLATE, cvJpDateGet, cvJpFormGet, cvJpInstanceRead, cvJpPaperCopyGet, cvJpPaperListGet } from './CvJpData.js';
import { CvJpPartGallery, CvJpPartPage } from './CvJpPartGallery.jsx';
import { CV_PAPER_ROOT, cvPaperTreeBuild } from './CvJpPaperTree.js';
import {
	CV_KIND_VIEW, CV_PAPER_LINE_ONE, CV_PAPER_LINE_WRAP, CV_PAPER_VIEW_PATH, cvPaperColumnGet, cvPaperColumnShownList, cvPaperRowListBuild,
	cvPaperViewColumnMove, cvPaperViewColumnShownSet, cvPaperViewDataBuild, cvPaperViewDefaultGet, cvPaperViewLineSet, cvPaperViewRead,
	cvPaperViewShownOrderSet, cvPaperViewWidthSet,
} from './CvJpPaperTable.js';
import { CvJpSheet } from './CvJpSheet.jsx';
import { CvPaperNameField, CvUndoRedo, useCvEditHistory } from './CvPaperName.jsx';
import { CV_PARTITION_EXAMPLE, cvPartitionListGet, cvPartitionTitleGet, cvPathInPartition, cvPathSplit } from '../query/CvProfile.js';
import './CvJp.css';

// The papers and templates of an object (doc/cv-sheet.md#the-papers), walked by their paths: a path
// bar over a panel of one height (the path-based view of react-doc's package cloud-dev-vis,
// PathNav.js and PathNavBar.jsx). Back, forward and up as in a browser, a segment of the path a
// click away, the chevron before it listing what lies beside it; the top is a house:
//
//   [← → ↑]  ⌂ › Example › CVs › 履歴書（汎用） ›                      tracked by git
//   [⌕ find by name      ] [Wrap|One line] [▥ Columns]            (a view not kept: Save / Put back)
//   ┌──────────────────────────────────────────────────────────────┐
//   │ a folder: the table of react-comp-misc (FolderView), a part   │  the panel keeps its height,
//   │ per form and one of templates; a paper: its sheet             │  what it shows scrolls inside
//   └──────────────────────────────────────────────────────────────┘
//
// The places are the object's own asset paths (CvJpPaperTree.js). The table (doc/cv-sheet.md#the-table-of-papers)
// is shown as its view says, a data item of the object (CvJpPaperTable.js): one line a row or
// wrapped, which columns in which order, how wide; changed by its tools and by dragging its head,
// kept while the document is edited. While the document is edited, a folder also offers a new paper
// of a form, reading a profile, in a partition (doc/README.md#partitions), as far as the place does
// not already say which; the new paper is opened.
//
//   param.path     the place shown first: / (every paper), /example, /example/cv, a paper's path
//   param.height   the height of the panel under its path bar, in px (640)
//   param.profile  the profile a paper reads when it names none (else metadata.profile of the object)
//   param.partition  where a new paper goes at the top, where no place says it (example)
//   param.view     the path of the item holding the view of the table (/example/view/papers)
const CV_PAPERS_HEIGHT = 640;
const CV_PAPERS_HEIGHT_MIN = 240;
// how long after the last change of the view it is written: a column dragged wider is one write
const CV_PAPER_VIEW_SAVE_DELAY = 600;

// the panel's own state, kept with the block (the document entering or leaving edit mode mounts it
// again, and it is where it was): the place shown, the way there, the words finding a paper, the
// view as changed here, and the new paper being named
class CvJpListStore {
	name = '';
	kind = '';
	partition = '';
	status = 'idle';
	message = '';
	find = '';
	// the view as changed in this panel; null: the view kept is shown
	viewLocal = null;
	// what was last written, so that a view just saved is not called unsaved before it is read back
	viewSavedText = '';
	viewStatus = 'idle';
	viewMessage = '';
	isViewSavePending = false;
	// the menu of a row (a right click on a paper or a template): { x, y, rowId }, or null
	menu = null;
	// the item whose name is typed in its row (Rename, a copy just made), and what went wrong doing
	// something to a row (its name written, a copy made)
	renamingKey = '';
	rowMessage = '';

	constructor(path) {
		this.nav = new PathNavStore({ path });
		this.viewSaveTimer = null;
		makeAutoObservable(this, { nav: false, viewSaveTimer: false }, { autoBind: true });
	}

	nameSet(text) {
		this.name = text;
		this.message = '';
	}

	kindSet(kind) {
		this.kind = kind;
		this.message = '';
	}

	partitionSet(partition) {
		this.partition = partition;
	}

	findSet(text) {
		this.find = text;
	}

	menuOpen(menu) {
		this.menu = menu;
	}

	menuClose() {
		this.menu = null;
	}

	renameStart(key) {
		this.menu = null;
		this.renamingKey = key;
		this.rowMessage = '';
	}

	renameEnd() {
		this.renamingKey = '';
	}

	rowMessageSet(text) {
		this.rowMessage = String(text ?? '');
	}

	// a copy of a paper or a template, beside it and named after it (CvJpData.js cvJpPaperCopyGet),
	// made at once: its row shows its name typed in place, selected, to be named. One step of the
	// history of the block, so Ctrl/⌘ + Z takes it away
	async duplicate(history, service, asset) {
		this.menu = null;
		const read = service.assetDataGet(asset.key);
		if (read?.status !== 'done') {
			this.rowMessageSet(`${asset.name || asset.key} is still being read: try again in a moment.`);
			return;
		}
		const copy = cvJpPaperCopyGet(asset, read.data, service.assetList());
		const { partition } = cvPathSplit(copy.path);
		const recorded = history ? history.wrap(service) : service;
		const create = () => recorded.assetCreate({
			kind: asset.kind,
			name: copy.name,
			pathList: [copy.path],
			...(partition ? { partition } : {}),
			data: copy.data,
			note: `a copy of ${asset.name || asset.key}`,
		});
		let result;
		try {
			result = await (history ? history.stepRun(create, `${asset.name || asset.key} duplicated as ${copy.name}`) : create());
		} catch (error) {
			result = { code: -1, message: String(error?.message ?? error) };
		}
		if (result?.code !== 0) {
			this.rowMessageSet(result?.message || 'The copy was not made.');
			return;
		}
		if (result.data?.key) this.renameStart(result.data.key);
	}

	// ---------- the view of the table ----------

	// a change of the view: shown at once. While the document is edited it is written a short while
	// after the last change; in reading mode it is held here, said not kept, until saved or put back
	viewChange(service, viewAsset, viewPath, view) {
		this.viewLocal = view;
		this.viewMessage = '';
		this.viewStatus = 'idle';
		if (!service.isEditable) return;
		clearTimeout(this.viewSaveTimer);
		this.isViewSavePending = true;
		this.viewSaveTimer = setTimeout(() => void this.viewSave(service, viewAsset, viewPath), CV_PAPER_VIEW_SAVE_DELAY);
	}

	// the view as changed here, written to its item (made at its path when there is none yet)
	async viewSave(service, viewAsset, viewPath) {
		clearTimeout(this.viewSaveTimer);
		this.isViewSavePending = false;
		const view = this.viewLocal;
		if (!view) return;
		if (!service.isEditable) {
			this.viewMessageSet('error', service.editUnavailableReason);
			return;
		}
		const data = cvPaperViewDataBuild(view);
		this.viewStatus = 'saving';
		const result = viewAsset
			? await service.assetWrite(viewAsset.key, data, 'the view of the table of papers')
			: await service.assetCreate({ kind: CV_KIND_VIEW, name: data.name, pathList: [viewPath], partition: cvPathSplit(viewPath).partition || undefined, data });
		if (result?.code !== 0) {
			this.viewMessageSet('error', result?.message || 'the view could not be written');
			return;
		}
		this.viewSaved(JSON.stringify(data));
	}

	viewSaved(text) {
		this.viewSavedText = text;
		this.viewStatus = 'idle';
		this.viewMessage = '';
	}

	viewMessageSet(status, message) {
		this.viewStatus = status;
		this.viewMessage = message;
	}

	// the view kept is shown again, what was changed here forgotten
	viewDiscard() {
		clearTimeout(this.viewSaveTimer);
		this.isViewSavePending = false;
		this.viewLocal = null;
		this.viewStatus = 'idle';
		this.viewMessage = '';
	}

	// ---------- a new paper ----------

	// a new paper of a form in a partition. it names the template of its form in that partition,
	// which is written there by the first paper (templateAsset: the one found, if any).
	// a path of a name: letters, digits and "-" of what it says; what remains is in the item's name.
	// pathFrom: the place it was made at, left for the paper (back returns there)
	async create(service, form, templateAsset, profileRef, partition, pathFrom) {
		const name = this.name.trim();
		if (!name) {
			this.status = 'error';
			this.message = `Name the ${form.label}.`;
			return;
		}
		this.status = 'submitting';
		let templatePath = templateAsset?.pathList?.[0];
		if (!templatePath) {
			templatePath = cvPathInPartition(partition, form.templatePath);
			const result = await service.assetCreate({ kind: CV_KIND_TEMPLATE, name: form.templateDefault.name, pathList: [templatePath], ...(partition ? { partition } : {}), data: form.templateDefault });
			if (result.code !== 0) {
				this.createFailed(result.message);
				return;
			}
		}
		const segment = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || String(cvJpPaperListGet(service, form.kind).length + 1);
		const path = cvPathInPartition(partition, `/${form.kind}/${segment}`);
		const result = await service.assetCreate({
			kind: form.kind,
			name,
			pathList: [path],
			...(partition ? { partition } : {}),
			data: { name, template: templatePath, ...(profileRef ? { profile: profileRef } : {}) },
		});
		if (result.code !== 0) {
			this.createFailed(result.message);
			return;
		}
		this.createDone();
		// the paper opens: its path is the place shown as soon as the object lists it
		this.nav.go(pathFrom, path);
	}

	createFailed(message) {
		this.status = 'error';
		this.message = message;
	}

	createDone() {
		this.name = '';
		this.status = 'idle';
		this.message = '';
	}
}

export const CvJpList = observer(function CvJpList({ data = {}, config = {} }) {
	const service = config.objectFrontend;
	if (!service) return <p className="doc-error">CvJpList is a mode of a frontend object (ObjectFrontend).</p>;
	return <CvJpPapers service={service} data={data} config={config} />;
});

const CvJpPapers = observer(function CvJpPapers({ service, data, config }) {
	const param = data.param ?? {};
	const store = useCompStateStore(config, 'papers', () => new CvJpListStore(typeof param.path === 'string' && param.path ? param.path : CV_PAPER_ROOT));
	const bodyRef = useRef(null);
	const rootRef = useRef(null);
	// what is changed here (a name) and in a paper opened here is undone with Ctrl/⌘ + Z while the
	// author is in the panel (doc/cv-sheet.md#undo-and-redo); the sheet shares the history of the block
	const history = useCvEditHistory(config, { rootGet: () => rootRef.current, isWritable: service.isEditable === true });
	const templateList = service.assetList(CV_KIND_TEMPLATE);
	const paperList = cvJpPaperListGet(service);
	const partitionList = cvPartitionListGet(service, [...paperList, ...templateList]);
	// a paper is listed by the name of its item, else by the name written in it
	const nameOf = (asset) => asset.name || cvJpInstanceRead(service.assetDataGet(asset.key).data).name;
	// the part templates of the object: places of their own in the parts of their partition
	const partList = service.assetList(CV_KIND_PART);
	const partDataGet = (asset) => {
		const read = service.assetDataGet(asset.key);
		return read?.status === 'done' ? read.data : undefined;
	};
	const tree = cvPaperTreeBuild({ paperList, templateList, partList, partDataGet, partitionList, nameOf });
	const nav = pathNavBuild(store.nav, tree);
	const place = tree.placeGet(nav.pathCurrent) ?? tree.placeGet(CV_PAPER_ROOT);
	const isPaper = place.kind === 'paper';
	// what scrolls in the panel itself, its scroll kept per place: a paper, the gallery of parts, a part
	const isBodyScrolled = isPaper || place.kind === 'parts' || place.kind === 'part';
	// a paper is where it was left: back and forward arrive at the scroll they left (the table keeps
	// its own, CvJpPaperOverview)
	useLayoutEffect(() => {
		const body = bodyRef.current;
		if (body && isBodyScrolled) body.scrollTop = store.nav.scrollTopGet(place.path);
	}, [place.path, isBodyScrolled, store]);
	const profileRef = param.profile || service.object.metadata?.profile || '';
	const partition = partitionList.find((one) => one.id === cvPathSplit(place.path).partition && place.kind !== 'root');
	return (
		<div ref={rootRef} className="doc-cv-papers not-prose">
			<PathNavBar
				nav={nav}
				label="Path of the papers"
				className="doc-cv-papers-bar"
				rootIcon={House}
				trailing={partition ? <span className="doc-cv-list-muted doc-cv-papers-git" title={cvPartitionTitleGet(partition, 'Its papers lie')}>{partition.isGitIgnored ? 'kept out of git' : 'tracked by git'}</span> : null}
			/>
			<div ref={bodyRef} className="doc-cv-papers-body" data-place={place.kind} style={{ height: `${heightGet(param.height)}px` }} onScroll={isBodyScrolled ? (event) => store.nav.scrollTopSet(place.path, event.currentTarget.scrollTop) : undefined}>
				{isPaper ? (
					<CvJpSheet key={place.path} data={{ param: { instance: place.path, ...(param.profile ? { profile: param.profile } : {}) } }} config={config} isPaperChoiceHidden />
				) : null}
				{/* the parts a paper may be made of: their gallery, one part at the top of a page (CvJpPartGallery.jsx) */}
				{place.kind === 'parts' ? <CvJpPartGallery key={place.path} service={service} config={config} tree={tree} place={place} nav={nav} profileRef={profileRef} partitionLabel={partition?.label} /> : null}
				{place.kind === 'part' ? <CvJpPartPage key={place.path} service={service} config={config} place={place} profileRef={profileRef} partitionLabel={partition?.label} /> : null}
				{!isBodyScrolled ? (
					<CvJpPaperOverview service={service} history={history} store={store} nav={nav} place={place} tree={tree} paperList={paperList} templateList={templateList} partitionList={partitionList} param={param} nameOf={nameOf} />
				) : null}
			</div>
		</div>
	);
});

// a folder: its tools, the form of a new paper while the document is edited, and the table, which
// takes the room they leave and scrolls inside (FolderView with a height: its head stays on top)
const CvJpPaperOverview = observer(function CvJpPaperOverview({ service, history, store, nav, place, tree, paperList, templateList, partitionList, param, nameOf }) {
	const tableRef = useRef(null);
	const [tableHeight, tableHeightSet] = useState(0);
	// the height the table is given, measured before the browser paints: nothing is seen to move
	useLayoutEffect(() => {
		const element = tableRef.current;
		if (!element) return undefined;
		const measure = () => tableHeightSet(Math.max(60, Math.floor(element.clientHeight)));
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);
	const isTableShown = tableHeight > 0;
	// the scroll of the table, kept per place as the panel keeps a paper's
	useLayoutEffect(() => {
		const scroller = tableRef.current?.querySelector('.folder-view-switcher-content');
		if (!scroller) return undefined;
		scroller.scrollTop = store.nav.scrollTopGet(place.path);
		const onScroll = () => store.nav.scrollTopSet(place.path, scroller.scrollTop);
		scroller.addEventListener('scroll', onScroll);
		return () => scroller.removeEventListener('scroll', onScroll);
	}, [place.path, isTableShown, store]);

	const profileDefault = param.profile || service.object.metadata?.profile || '';
	// the view: as changed here, else the item kept, else the default
	const viewPath = typeof param.view === 'string' && param.view.startsWith('/') ? param.view : CV_PAPER_VIEW_PATH;
	const viewAsset = service.assetList(CV_KIND_VIEW).find((asset) => asset.pathList?.includes(viewPath));
	const viewRead = viewAsset ? service.assetDataGet(viewAsset.key) : undefined;
	const viewKept = cvPaperViewRead(viewRead?.status === 'done' ? viewRead.data : undefined);
	const view = store.viewLocal ?? viewKept.view;
	const viewChange = (viewNext) => store.viewChange(service, viewAsset, viewPath, viewNext);
	const viewText = JSON.stringify(cvPaperViewDataBuild(view));
	const isViewUnkept = store.viewLocal !== null && viewText !== JSON.stringify(cvPaperViewDataBuild(viewKept.view)) && viewText !== store.viewSavedText;

	const rowList = cvPaperRowListBuild({ paperList, templateList, place, find: store.find, nameOf });
	const columnShownList = cvPaperColumnShownList(view);
	const partitionLabelById = new Map(partitionList.map((one) => [one.id, one.label]));
	const context = { service, history, store, nav, profileDefault, partitionLabelById, colFirst: columnShownList[0]?.id, isFinding: store.find.trim() !== '', isOneLine: view.lineMode === CV_PAPER_LINE_ONE, renamingKey: store.renamingKey };
	const rowById = new Map(rowList.map((row) => [row.id, row]));
	const folderData = {
		columns: Object.fromEntries(columnShownList.map((column) => [column.id, { data: cvPaperColumnGet(column.id).label }])),
		colsOrder: columnShownList.map((column) => column.id),
		rows: rowList.map((row) => ({ id: row.id, data: {}, rowClassName: `doc-cv-papers-row-${row.kind}` })),
		rowIdsSelected: [],
		getRowData: (rowId) => ({ row: rowById.get(rowId), context }),
	};
	const folderConfig = {
		colSizeById: Object.fromEntries(columnShownList.map((column) => [column.id, { width: column.width, minWidth: cvPaperColumnGet(column.id).minWidth, resizable: true }])),
		colWidthById: Object.fromEntries(columnShownList.map((column) => [column.id, column.width])),
		isColReorderAllowed: true,
		isLastColFilled: true,
		isListOnly: true,
		isStatusBarVisible: false,
		selectionMode: 'none',
		bodyHeight: tableHeight,
		compBodyByColId: cvPaperCellCompGet,
		colResizeDragMode: 'preview',
		isContextMenuBuiltInDisabled: true,
	};
	const onEvent = async (eventType, eventData) => {
		if (eventType === 'colResize' && eventData?.colWidthByIdNext) viewChange(cvPaperViewWidthSet(view, eventData.colWidthByIdNext));
		else if (eventType === 'colReorder' && eventData?.colsOrderNext) viewChange(cvPaperViewShownOrderSet(view, eventData.colsOrderNext));
		else if (eventType === 'rowDoubleClick') {
			const row = rowById.get(eventData?.rowId);
			if (row?.kind === 'paper' && store.renamingKey !== row.asset.key) nav.pathSet(row.asset.pathList?.[0]);
		} else if (eventType === 'rowContextMenu') {
			// a paper and a template have a menu of their own (Open, Rename, in reading mode too):
			// neither the browser's nor the page's menu of the block is shown over them; elsewhere in
			// the block the page's is
			const row = rowById.get(eventData?.rowId);
			const event = eventData?.event;
			if ((row?.kind === 'paper' || row?.kind === 'template') && event) {
				event.preventDefault();
				event.stopPropagation();
				store.menuOpen({ x: event.clientX, y: event.clientY, rowId: row.id });
			}
		}
		return { code: 0 };
	};
	const menuRow = store.menu ? rowById.get(store.menu.rowId) : undefined;
	return (
		<div className="doc-cv-papers-overview">
			<CvJpPaperTools store={store} service={service} history={history} view={view} viewChange={viewChange} isViewUnkept={isViewUnkept} problemList={viewKept.problemList} onSave={() => void store.viewSave(service, viewAsset, viewPath)} partsPath={partsPathGet(tree, place)} onParts={(path) => nav.pathSet(path)} />
			{service.docState?.isEditing ? <CvJpPaperNew service={service} store={store} nav={nav} place={place} templateList={templateList} partitionList={partitionList} param={param} profileDefault={profileDefault} /> : null}
			<div ref={tableRef} className="doc-cv-papers-table" data-line={view.lineMode}>
				{isTableShown ? <FolderView data={folderData} config={folderConfig} onEvent={onEvent} /> : null}
				{isTableShown && rowList.length === 0 ? <p className="doc-cv-list-muted doc-cv-papers-none">{context.isFinding ? `No name here holds “${store.find.trim()}”.` : 'Nothing here.'}</p> : null}
			</div>
			{menuRow ? <CvJpPaperRowMenu store={store} service={service} history={history} nav={nav} row={menuRow} /> : null}
		</div>
	);
});

// the menu of a paper or a template in the table (a right click on its row): open it, rename it,
// duplicate it. The page's menu (react-doc's DocMenu), as the menus of its side panel and its blocks
// look. A name and a copy are written while the document is edited
const CvJpPaperRowMenu = observer(function CvJpPaperRowMenu({ store, service, history, nav, row }) {
	const isPaper = row.kind === 'paper';
	const reason = service.isEditable ? '' : `Written while the document is edited (${service.editUnavailableReason || 'read only'})`;
	const itemList = [
		...(isPaper ? [docMenuEntryBuild('open', ArrowRight, 'Open', { title: 'Its sheet, here' })] : []),
		docMenuEntryBuild('rename', Pencil, 'Rename', { reason, title: 'Type its name in its row; its path stays' }),
		docMenuEntryBuild('duplicate', Copy, 'Duplicate', {
			reason,
			title: `A copy beside it, holding what it holds (its template, its profile, its own cells, rows and parts), its name typed at once${isPaper ? '' : '; a copy of a template is named by no paper until one is set to it'}`,
		}),
	];
	const choose = (id) => {
		store.menuClose();
		if (id === 'open') nav.pathSet(row.asset.pathList?.[0]);
		else if (id === 'rename' && service.isEditable) store.renameStart(row.asset.key);
		else if (id === 'duplicate' && service.isEditable) void store.duplicate(history, service, row.asset);
	};
	return <DocMenu itemList={itemList} point={{ x: store.menu.x, y: store.menu.y }} onChoose={choose} onClose={store.menuClose} />;
});

// the tools of the table, always there: find by name, one line a row or wrapped, the columns, and
// whether the view as changed here is kept
// the gallery of parts a folder offers: of its partition; at the top, of the first partition
function partsPathGet(tree, place) {
	const partition = place.kind === 'root' ? tree.childListGet(place.path)[0]?.path : `/${String(place.path).split('/').filter(Boolean)[0] ?? ''}`;
	const path = partition ? `${partition}/${CV_KIND_PART}` : '';
	return path && tree.isFound(path) ? path : '';
}

const CvJpPaperTools = observer(function CvJpPaperTools({ store, service, history, view, viewChange, isViewUnkept, problemList, onSave, partsPath = '', onParts }) {
	return (
		<div className="doc-cv-papers-tools" role="toolbar" aria-label="How the table is shown">
			<span className="doc-cv-papers-find">
				<Search size={12} aria-hidden="true" />
				<input aria-label="Find a paper by its name" placeholder="Find by name" value={store.find} onChange={(event) => store.findSet(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape' && store.find !== '') { event.stopPropagation(); store.findSet(''); } }} />
				{store.find !== '' ? <button type="button" className="doc-cv-papers-icon-button" aria-label="Clear" title="Clear" onClick={() => store.findSet('')}><X size={12} aria-hidden="true" /></button> : null}
			</span>
			<span className="doc-cv-papers-segment-list" role="group" aria-label="Lines of a row">
				<button type="button" className="doc-cv-papers-segment" aria-pressed={view.lineMode === CV_PAPER_LINE_WRAP} title="The text of a cell breaks into lines" onClick={() => viewChange(cvPaperViewLineSet(view, CV_PAPER_LINE_WRAP))}>Wrap</button>
				<button type="button" className="doc-cv-papers-segment" aria-pressed={view.lineMode === CV_PAPER_LINE_ONE} title="Every row one line: what does not fit is cut, its whole text in its tooltip" onClick={() => viewChange(cvPaperViewLineSet(view, CV_PAPER_LINE_ONE))}>One line</button>
			</span>
			<CvJpPaperColumnMenu view={view} viewChange={viewChange} />
			{partsPath ? (
				<button type="button" className="doc-cv-papers-tool-button" title={`The parts a paper may be made of, each drawn from the profile: ${partsPath}`} onClick={() => onParts?.(partsPath)}>
					<LayoutGrid size={13} aria-hidden="true" /><span>Parts</span>
				</button>
			) : null}
			<span className="doc-cv-papers-space" />
				{store.rowMessage ? <span className="doc-error doc-cv-papers-view-state" role="alert" title={store.rowMessage}>{store.rowMessage}</span> : null}
			<CvJpPaperViewState store={store} service={service} isViewUnkept={isViewUnkept} problemList={problemList} onSave={onSave} />
				{service.docState?.isEditing ? <CvUndoRedo history={history} isWritable={service.isEditable} /> : null}
		</div>
	);
});

// whether the view shown is the one kept: a view changed in reading mode is held here, and said so
const CvJpPaperViewState = observer(function CvJpPaperViewState({ store, service, isViewUnkept, problemList, onSave }) {
	if (store.viewStatus === 'error') return <span className="doc-error doc-cv-papers-view-state" role="alert" title={store.viewMessage}>The view was not kept: {store.viewMessage}</span>;
	if (store.isViewSavePending || store.viewStatus === 'saving') return <span className="doc-cv-list-muted doc-cv-papers-view-state">Keeping the view…</span>;
	if (isViewUnkept) {
		return (
			<span className="doc-cv-papers-view-state">
				<span className="doc-cv-list-muted" title={service.isEditable ? 'This view was changed while the document was read' : `Kept while the document is edited (${service.editUnavailableReason})`}>{service.isEditable ? 'View changed, not kept' : 'View not kept (reading mode)'}</span>
				{service.isEditable ? <button type="button" className="doc-button" onClick={onSave} title="Keep this view of the table in the object, for every block showing it">Keep</button> : null}
				<button type="button" className="doc-cv-papers-icon-button" aria-label="Put the kept view back" title="Put the kept view back" onClick={store.viewDiscard}><RotateCcw size={12} aria-hidden="true" /></button>
			</span>
		);
	}
	if (problemList.length > 0) return <span className="doc-error doc-cv-papers-view-state" title={problemList.join('; ')}>The view kept: {problemList[0]}</span>;
	return null;
});

// the columns: which are shown, in which order; the widths are dragged in the head of the table
function CvJpPaperColumnMenu({ view, viewChange }) {
	const [isOpen, isOpenSet] = useState(false);
	const wrapRef = useRef(null);
	const buttonRef = useRef(null);
	// the menu closes on a pointer pressed elsewhere, and on Escape
	useEffect(() => {
		if (!isOpen) return undefined;
		const onPointerDown = (event) => { if (!wrapRef.current?.contains(event.target)) isOpenSet(false); };
		const onKeyDown = (event) => { if (event.key === 'Escape') { isOpenSet(false); buttonRef.current?.focus(); } };
		document.addEventListener('pointerdown', onPointerDown, true);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown, true);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [isOpen]);
	const countShown = cvPaperColumnShownList(view).length;
	return (
		<span ref={wrapRef} className="doc-cv-papers-menu-wrap">
			<button ref={buttonRef} type="button" className="doc-cv-papers-tool-button" aria-expanded={isOpen} aria-haspopup="true" title="Which columns are shown, in which order (drag a border in the head for a width, a head for the order)" onClick={() => isOpenSet(!isOpen)}>
				<Columns3 size={13} aria-hidden="true" /><span>Columns</span><span className="doc-cv-list-muted">{countShown}/{view.columnList.length}</span>
			</button>
			{isOpen ? (
				<AnchoredPopover anchorRef={buttonRef} className="doc-cv-papers-menu" role="dialog" aria-label="The columns of the table">
					{view.columnList.map((column, index) => {
						const definition = cvPaperColumnGet(column.id);
						return (
							<span key={column.id} className="doc-cv-papers-menu-row">
								<label title={definition.isAlwaysShown ? 'Always shown: it opens a paper' : undefined}>
									<input type="checkbox" checked={!column.isHidden} disabled={definition.isAlwaysShown} onChange={(event) => viewChange(cvPaperViewColumnShownSet(view, column.id, event.target.checked))} />
									<span>{definition.label}</span>
								</label>
								<span className="doc-cv-list-muted doc-cv-papers-menu-width">{column.width}px</span>
								<button type="button" className="doc-cv-papers-icon-button" aria-label={`Move ${definition.label} earlier`} title="Earlier" disabled={index === 0} onClick={() => viewChange(cvPaperViewColumnMove(view, column.id, -1))}><ArrowUp size={12} aria-hidden="true" /></button>
								<button type="button" className="doc-cv-papers-icon-button" aria-label={`Move ${definition.label} later`} title="Later" disabled={index === view.columnList.length - 1} onClick={() => viewChange(cvPaperViewColumnMove(view, column.id, 1))}><ArrowDown size={12} aria-hidden="true" /></button>
							</span>
						);
					})}
					<span className="doc-cv-papers-menu-foot">
						<button type="button" className="doc-button" title="Every column at its default width and place, wrapped" onClick={() => viewChange(cvPaperViewDefaultGet())}>
							<RotateCcw size={12} aria-hidden="true" /><span>Default view</span>
						</button>
					</span>
				</AnchoredPopover>
			) : null}
		</span>
	);
}

// a cell of the table, whatever its column: FolderView asks for a component per column, and gets
// this one, which reads its row (getRowData: { row, context })
const CvPaperCell = observer(function CvPaperCell({ data, colId }) {
	const { row, context } = data ?? {};
	if (!row) return null;
	if (row.kind === 'part') {
		if (colId !== context.colFirst) return null;
		const { part } = row;
		return <span className="doc-cv-papers-part-title">{part.title} <span className="doc-cv-list-muted">({context.isFinding ? `${part.count} of ${part.countAll}` : part.countAll})</span></span>;
	}
	if (row.kind === 'empty') return colId === context.colFirst ? <span className="doc-cv-list-muted">{row.text}</span> : null;
	const { asset } = row;
	const { service, nav } = context;
	const path = asset.pathList?.[0] ?? '';
	// the name typed in its row (Rename in the menu of the row)
	const nameField = (name) => (
		<CvPaperNameField history={context.history} service={service} asset={asset} name={name} isFocusedInitial onDone={context.store.renameEnd} onMessage={context.store.rowMessageSet} />
	);
	if (row.kind === 'template') {
		const form = cvJpFormGet(String(service.assetDataGet(asset.key).data?.form ?? CV_KIND_CV));
		if (colId === 'name' && context.renamingKey === asset.key) return nameField(asset.name || asset.key);
		if (colId === 'name') return <span title={asset.name || asset.key}>{asset.name || asset.key}</span>;
		if (colId === 'path') return <CvPathText path={path} isOneLine={context.isOneLine} />;
		if (colId === 'form') return <span className="doc-cv-list-muted">{form.id}</span>;
		if (colId === 'partition') return <span className="doc-cv-list-muted">{context.partitionLabelById.get(cvPathSplit(path).partition) ?? ''}</span>;
		return null;
	}
	const instance = cvJpInstanceRead(service.assetDataGet(asset.key).data);
	const name = asset.name || instance.name || asset.key;
	if (colId === 'name' && context.renamingKey === asset.key) return nameField(name);
	if (colId === 'name') {
		return <span role="link" tabIndex={0} className="doc-cv-list-link" title={`${name}: open ${path}`} onClick={() => nav.pathSet(path)} onKeyDown={(event) => { if (event.key === 'Enter') nav.pathSet(path); }}>{name}</span>;
	}
	if (colId === 'path') return <CvPathText path={path} isOneLine={context.isOneLine} />;
	if (colId === 'form') return <span className="doc-cv-list-muted">{cvJpFormGet(asset.kind).id}</span>;
	if (colId === 'template') return instance.template ? <CvPathText path={instance.template} isOneLine={context.isOneLine} /> : <span className="doc-cv-list-muted">(the form itself)</span>;
	if (colId === 'profile') {
		const profile = instance.profile || context.profileDefault || '(none)';
		return <span className="doc-cv-list-muted" title={profile}>{profile}</span>;
	}
	if (colId === 'asOf') return <CvAsOf asOf={instance.asOf} />;
	if (colId === 'partition') return <span className="doc-cv-list-muted">{context.partitionLabelById.get(cvPathSplit(path).partition) ?? ''}</span>;
	return null;
});
const cvPaperCellCompGet = () => CvPaperCell;

// a path breaks only before a "/", never inside a segment (not at its hyphens either); one line a
// row has no breaks in it at all (a browser breaks at <wbr> even where nothing wraps), and cuts it,
// its whole text in the tooltip
function CvPathText({ path, isOneLine = false }) {
	const segmentList = path.split('/').filter(Boolean);
	if (segmentList.length === 0 || isOneLine) return <span className="doc-cv-list-muted" title={path}>{path}</span>;
	return <span className="doc-cv-list-muted" title={path}>{segmentList.map((segment, index) => <span key={index}>{index > 0 ? <wbr /> : null}<span className="doc-cv-papers-nowrap">/{segment}</span></span>)}</span>;
}

// the date a paper is written at, with its zone as every time the page shows; a paper naming none
// is drawn at the day it is opened
function CvAsOf({ asOf }) {
	const text = timeTextDisplay(cvJpDateGet(asOf), { part: 'date' });
	if (!asOf) return <span className="doc-cv-list-muted" title="No date is written in the paper: it is drawn at the day it is opened"><span className="doc-cv-papers-nowrap">{text}</span> today</span>;
	if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(asOf.trim())) return <span className="doc-cv-list-muted" title={`asOf: ${asOf} is no date (YYYY-MM-DD); the paper is drawn at the day it is opened`}>{asOf}: not a date</span>;
	return <span className="doc-cv-list-muted doc-cv-papers-nowrap">{text}</span>;
}

// a new paper, while the document is edited: its form, its name, its partition. what the place
// shown says is not asked again (a folder of CVs makes a CV, a partition's place puts it there)
const CvJpPaperNew = observer(function CvJpPaperNew({ service, store, nav, place, templateList, partitionList, param, profileDefault }) {
	const partitionOfPlace = place.kind === 'root' ? '' : cvPathSplit(place.path).partition;
	const kindOfPlace = place.kind === 'folder' && CV_JP_FORM_LIST.some((form) => form.kind === place.segment) ? place.segment : '';
	const partitionChosenId = partitionOfPlace || store.partition || param.partition || CV_PARTITION_EXAMPLE;
	const partitionChosen = partitionList.find((one) => one.id === partitionChosenId);
	const formChosen = cvJpFormGet(kindOfPlace || store.kind || CV_KIND_CV);
	// the template a new paper names: one of its form in the partition chosen, else any of its form
	const templateOfForm = templateList.filter((asset) => String(service.assetDataGet(asset.key).data?.form ?? CV_KIND_CV) === formChosen.kind);
	const templateChosen = templateOfForm.find((asset) => cvPathSplit(asset.pathList?.[0]).partition === partitionChosenId) ?? templateOfForm[0];
	const placeText = `${cvPartitionTitleGet(partitionChosen, `The new ${formChosen.label} goes`, formChosen.kind)}; it reads the profile of the same partition, and opens here.`;
	const create = () => void store.create(service, formChosen, templateChosen, profileDefault, partitionChosenId, nav.pathCurrent);
	return (
		<div className="doc-cv-papers-new" title={placeText}>
			{kindOfPlace ? null : (
				<select aria-label="The form of the new paper" title="The form of the new paper" value={formChosen.kind} onChange={(event) => store.kindSet(event.target.value)}>
					{CV_JP_FORM_LIST.map((form) => <option key={form.kind} value={form.kind}>{form.id}: {form.label}</option>)}
				</select>
			)}
			<input aria-label={`The name of the new ${formChosen.label}`} placeholder={`The name of a new ${formChosen.label}`} value={store.name} onChange={(event) => store.nameSet(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') create(); }} />
			{!partitionOfPlace && partitionList.length > 1 ? (
				<select aria-label="The partition of the new paper" title={cvPartitionTitleGet(partitionChosen, 'The new paper goes', formChosen.kind)} value={partitionChosenId} onChange={(event) => store.partitionSet(event.target.value)}>
					{partitionList.map((one) => <option key={one.id} value={one.id}>{one.label}</option>)}
				</select>
			) : null}
			<button type="button" className="doc-button" disabled={store.status === 'submitting' || !service.isEditable} title={service.isEditable ? `${placeText} It names ${templateChosen?.pathList?.[0] ?? 'the standard template, written beside it'}.` : service.editUnavailableReason} onClick={create}>
				<Plus size={12} aria-hidden="true" /><span>New {formChosen.label}</span>
			</button>
			{store.message ? <span className="doc-error" role="alert">{store.message}</span> : null}
		</div>
	);
});

function heightGet(value) {
	const height = Number(value);
	return Number.isFinite(height) && height > 0 ? Math.max(CV_PAPERS_HEIGHT_MIN, Math.round(height)) : CV_PAPERS_HEIGHT;
}
