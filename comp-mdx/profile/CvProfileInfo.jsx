import { useId, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { ChevronsDownUp, ChevronsUpDown, Copy, Plus, Search, X } from 'lucide-react';
import { useCompStateStore } from '@wwf971/react-doc';
import { CV_PARTITION_EXAMPLE, cvLeafQueryGet, cvPartitionListGet, cvPartitionTitleGet, cvPathSplit, cvProfileRead, CV_KIND_INFO } from '../query/CvProfile.js';
import { cvQueryResolve } from '../query/CvQuery.js';
import { CV_KIND_BADGE, cvBadgeRead } from '../query/CvBadge.js';
import { cvInfoFindWordList, cvInfoTreeBuild, cvInfoTreeFolderPathList, cvInfoTreeRowListGet, cvValueIsImage } from '../query/CvInfoTree.js';
import { cvInfoExploreGet, cvInfoFindListGet } from '../query/CvInfoExplore.js';
import { CV_PROFILE_TAB_BADGE, CV_PROFILE_TAB_INFO, CV_PROFILE_VIEW_EXPLORE, CV_PROFILE_VIEW_LIST, CV_PROFILE_VIEW_TREE, CvProfileStore } from './CvProfileStore.js';
import { CvProfileExplore, CvProfilePathBar } from './CvProfileExplore.jsx';
import { CvProfileTree } from './CvProfileTree.jsx';
import { CvProfileBadgeList } from './CvProfileBadgeList.jsx';
import { useFindHighlight } from './cv-profile-highlight.js';
import './CvProfile.css';

// The personal information of a profile, a mode of its frontend object (doc/cv-query.md#the-mode-information).
// One panel no taller than param.heightMax, whatever the profile holds:
//
//   [ Information 57 ][ Badges 12 ]                      Partition [ Playground ] kept out of git
//   [+ Add a value]  View [ Explorer | Tree ]  [ find a value, or try a query               ]
//   [↑]  ⌂ › name                                          the values walked as a file explorer
//   ▭ ( ⇄ jp | last )  3   山田 · やまだ · Yamada …         walks folders (CvProfileExplore), or as
//   ▭ ( ⇄ jp | first ) 3   太郎 · たろう · Taro             a tree (CvProfileTree); a value is
//     ( ⇄ en | last )      Yamada                          changed in its row
//
// Its data items are of the kind "info", one per subject, in partitions (doc/README.md#partitions):
// one is shown at a time, param.partition first, and a new value goes into it. The second tab is
// the badges of the partition (doc/cv-badge.md), data items of the kind "badge". A partition
// holding nothing yet (a playground after a clone) can be filled with a copy of another one.
//
//   param.partition   the partition shown first
//   param.heightMax   the tallest the list of values (or badges) gets, in px (360); it scrolls past that
//   param.view        the view of the values shown first: explorer (the default) | tree
const CV_PROFILE_HEIGHT_MAX = 360;
const CV_PROFILE_HEIGHT_MIN = 120;

export const CvProfileInfo = observer(function CvProfileInfo({ data = {}, config = {} }) {
	const service = config.objectFrontend;
	// the store is the block's: the panel mounted again (the document entering or leaving edit
	// mode) is where it was: its tab, its view, the path walked, the folders opened, its scroll
	const store = useCompStateStore(config, 'profile', () => new CvProfileStore());
	const partitionSelectId = useId();
	const bodyRef = useRef(null);
	const bodySet = (element) => {
		if (element && element !== bodyRef.current) element.scrollTop = store.scrollTop;
		bodyRef.current = element;
	};
	// the words typed, marked where the rows say them (only the values are searched, not the badges)
	useFindHighlight(bodyRef, store.tab === CV_PROFILE_TAB_INFO ? cvInfoFindWordList(store.find) : []);
	if (!service) return <p className="doc-error">CvProfileInfo is a mode of a frontend object (ObjectFrontend).</p>;
	const assetList = [...service.assetList(CV_KIND_INFO), ...service.assetList(CV_KIND_BADGE)];
	const partitionList = cvPartitionListGet(service, assetList);
	const partitionFound = assetList.map((asset) => cvPathSplit(asset.pathList?.[0]).partition);
	const partitionId = store.partition ?? data.param?.partition ?? (partitionFound.includes(CV_PARTITION_EXAMPLE) ? CV_PARTITION_EXAMPLE : partitionFound[0] ?? CV_PARTITION_EXAMPLE);
	const partition = partitionList.find((one) => one.id === partitionId);
	const read = cvProfileRead(service, {}, partitionId);
	if (read.countLoading > 0) return <p className="doc-note">Reading the information ({read.countAll - read.countLoading} of {read.countAll})…</p>;
	const { info } = read;
	const badgeRead = cvBadgeRead(service, partitionId);
	// values are changed, removed and added while the document is edited; in reading mode they
	// read as text (react-doc: main/doc_page_impl_obj_frontend.md#reading-and-editing)
	const isEditShown = service.docState?.isEditing === true;
	const isLocked = !service.isEditable;
	const lockedReason = isLocked ? service.editUnavailableReason : '';
	const heightMax = heightMaxGet(data.param?.heightMax);
	// a partition holding nothing can start as a copy of one that holds something
	const partitionFilledList = partitionList.filter((one) => one.id !== partitionId && partitionFound.includes(one.id));
	const isPartitionEmpty = info.leafList.length === 0 && badgeRead.badgeList.length === 0 && badgeRead.countLoading === 0;
	const isTabInfo = store.tab === CV_PROFILE_TAB_INFO;
	const tabList = [
		{ id: CV_PROFILE_TAB_INFO, label: 'Information', count: info.leafList.length },
		{ id: CV_PROFILE_TAB_BADGE, label: 'Badges', count: badgeRead.badgeList.length },
	];

	// the words typed, and what a query among them reads: it shows the values it reads from,
	// whatever its words (name/first/jp/katakana is derived from the hiragana)
	const find = store.find.trim();
	const resolved = find !== '' && !/\s/.test(find) ? cvQueryResolve(info, find) : undefined;
	const isResolved = resolved?.status === 'found';
	const leafShownList = isResolved ? resolved.leafList.filter(Boolean) : [];
	const view = store.view ?? (data.param?.view === CV_PROFILE_VIEW_TREE ? CV_PROFILE_VIEW_TREE : CV_PROFILE_VIEW_EXPLORE);
	const isExplore = view === CV_PROFILE_VIEW_EXPLORE;
	// the explorer: what lies at the path walked, or what the words find
	const explore = isExplore ? cvInfoExploreGet(info, store.pathList) : undefined;
	const foundList = isExplore && find !== '' ? cvInfoFindListGet(info, find, leafShownList) : undefined;
	// it is as tall as its top level needs, however short the folder shown: walking moves nothing
	const exploreRowCount = isExplore ? cvInfoExploreGet(info, []).itemList.length : 0;
	// the tree, and what the words leave of it
	const root = isExplore ? undefined : cvInfoTreeBuild(info.leafList);
	const rowList = isExplore ? [] : cvInfoTreeRowListGet(root, {
		isOpenByPath: store.isOpenByPath,
		find,
		leafShownList,
		draftPath: isEditShown && store.draft ? store.draft.pathParent : undefined,
	});
	const folderPathList = isExplore ? [] : cvInfoTreeFolderPathList(root);
	const isAllOpen = folderPathList.length > 0 && folderPathList.every((path) => store.isOpenByPath[path]);
	const pathWalked = store.pathList.join('/');

	return (
		<div className="doc-cv-profile not-prose">
			<div className="doc-cv-profile-head">
				<div className="doc-cv-profile-tab-list" role="tablist" aria-label="What of the profile is shown">
					{tabList.map((tab) => (
						<button key={tab.id} type="button" role="tab" className="doc-cv-profile-tab" aria-selected={store.tab === tab.id} onClick={() => store.tabSet(tab.id)}>
							<span>{tab.label}</span><span className="doc-cv-profile-count">{tab.count}</span>
						</button>
					))}
				</div>
				<span className="doc-cv-profile-space" />
				<label className="doc-cv-profile-muted" htmlFor={partitionSelectId}>Partition</label>
				<select id={partitionSelectId} className="doc-cv-profile-select" value={partitionId} title={cvPartitionTitleGet(partition, 'Its data lies')} onChange={(event) => store.partitionSet(event.target.value)}>
					{partitionList.map((one) => <option key={one.id} value={one.id}>{one.label}</option>)}
				</select>
				<span className="doc-cv-profile-muted" title={cvPartitionTitleGet(partition, 'Its data lies')}>{partition?.isGitIgnored ? 'kept out of git' : 'tracked by git'}</span>
			</div>

			{isTabInfo ? (
				<div className="doc-cv-profile-tool">
					{isEditShown ? (
						<button
							type="button"
							className="doc-button"
							disabled={isLocked || store.isSubmitting || (isExplore && find !== '')}
							title={lockedReason || (isExplore ? `A new value ${pathWalked ? `in ${pathWalked}` : 'at the top level'}: where the explorer is` : 'A new value at the top level; the + of a folder adds one inside it')}
							onClick={() => store.draftOpen(isExplore ? pathWalked : '')}
						>
							<Plus size={12} aria-hidden="true" /><span>Add a value</span>
						</button>
					) : null}
					<span className="doc-cv-profile-view" role="group" aria-label="The view of the values">
						<span className="doc-cv-profile-muted">View</span>
						<span className="doc-cv-profile-segment-list">
							{CV_PROFILE_VIEW_LIST.map((one) => (
								<button key={one.id} type="button" className="doc-cv-profile-segment" aria-pressed={view === one.id} title={one.title} onClick={() => store.viewSet(one.id)}>{one.label}</button>
							))}
						</span>
					</span>
					<span className="doc-cv-profile-find">
						<Search size={12} aria-hidden="true" />
						<input aria-label="Find a value, or try a query" placeholder="Find a value, or try a query: name/first/jp/katakana" value={store.find} onChange={(event) => store.findSet(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape' && store.find !== '') { event.stopPropagation(); store.findSet(''); } }} />
						{store.find !== '' ? <button type="button" className="doc-cv-profile-icon-button" aria-label="Clear" title="Clear" onClick={() => store.findSet('')}><X size={12} aria-hidden="true" /></button> : null}
					</span>
					{/* its room is kept in the explorer, which has no folders to open: the field stays as wide */}
					<button type="button" className="doc-cv-profile-icon-button" data-hidden={isExplore ? '' : undefined} disabled={isExplore || folderPathList.length === 0 || find !== ''} aria-hidden={isExplore} aria-label={isAllOpen ? 'Close every folder' : 'Open every folder'} title={isAllOpen ? 'Close every folder' : 'Open every folder'} onClick={() => store.folderAllSet(folderPathList, !isAllOpen)}>
						{isAllOpen ? <ChevronsDownUp size={13} aria-hidden="true" /> : <ChevronsUpDown size={13} aria-hidden="true" />}
					</button>
				</div>
			) : (
				<div className="doc-cv-profile-tool">
					{isEditShown ? (
						<button type="button" className="doc-button" disabled={isLocked || store.isSubmitting} title={lockedReason || 'A new badge of this partition'} onClick={store.badgeDraftOpen}>
							<Plus size={12} aria-hidden="true" /><span>Add a badge</span>
						</button>
					) : null}
					<span className="doc-cv-profile-muted">A CV shows a badge in a line as {'{{/badge/aws/saa}}'}: typed there as /badge.</span>
				</div>
			)}

			{/* what a query typed reads: the answer a CV would get */}
			{isTabInfo && isResolved ? (
				<div className="doc-cv-profile-result">
					<span className="doc-cv-profile-muted">{`{{${resolved.query}}}`} reads</span>
					<span className="doc-cv-profile-result-value">{cvValueIsImage(resolved.value) ? '(an image)' : resolved.value}</span>
					<span className="doc-cv-profile-muted">· {RESOLVED_BY_LABEL[resolved.by] ?? resolved.by}{resolved.alternativeList.length > 0 ? ` · the first of ${resolved.alternativeList.length + 1}: also ${resolved.alternativeList.slice(0, 3).map((leaf) => cvLeafQueryGet(leaf)).join(', ')}${resolved.alternativeList.length > 3 ? ', …' : ''}` : ''}</span>
				</div>
			) : null}
			{store.message ? <p className="doc-cv-profile-problem" role="alert">{store.message}</p> : null}
			{(isTabInfo ? read.problemList : badgeRead.problemList).map((problem) => <p key={problem} className="doc-cv-profile-problem">{problem}</p>)}

			{isTabInfo && isExplore && !foundList && !isPartitionEmpty ? <CvProfilePathBar store={store} countLeaf={explore.countLeaf} /> : null}
			<div ref={bodySet} className="doc-cv-profile-body" onScroll={(event) => store.scrollTopSet(event.currentTarget.scrollTop)} style={{ maxHeight: `${heightMax}px`, minHeight: isTabInfo && isExplore && !isPartitionEmpty ? `min(${heightMax}px, calc(${exploreRowCount} * (1.65rem + 1px)))` : undefined }}>
				{isPartitionEmpty && !store.draft && !store.badgeDraft ? (
					<div className="doc-cv-profile-empty">
						<span className="doc-cv-profile-muted">This partition holds nothing yet.</span>
						{isEditShown ? partitionFilledList.map((one) => (
							<button key={one.id} type="button" className="doc-button" disabled={isLocked || store.isSubmitting} title={lockedReason || `Every value and badge of ${one.label}, copied into ${partition?.label ?? partitionId}`} onClick={() => store.partitionCopy(service, one.id, partitionId)}>
								<Copy size={12} aria-hidden="true" /><span>Start from a copy of {one.label}</span>
							</button>
						)) : null}
					</div>
				) : isTabInfo && isExplore ? (
					<CvProfileExplore explore={explore} foundList={foundList} store={store} service={service} info={info} partitionId={partitionId} isEditShown={isEditShown} isLocked={isLocked} lockedReason={lockedReason} />
				) : isTabInfo ? (
					<CvProfileTree rowList={rowList} store={store} service={service} info={info} partitionId={partitionId} isEditShown={isEditShown} isLocked={isLocked} lockedReason={lockedReason} isFinding={find !== ''} />
				) : (
					<CvProfileBadgeList badgeList={badgeRead.badgeList} store={store} service={service} partitionId={partitionId} isEditShown={isEditShown} isLocked={isLocked} lockedReason={lockedReason} />
				)}
			</div>
		</div>
	);
});

// how a query came by its value (cvQueryResolve), said to a reader
const RESOLVED_BY_LABEL = {
	stored: 'stored',
	script: 'written in another script of the value stored',
	derive: 'worked out from the date stored',
	join: 'joined from the parts stored',
};

function heightMaxGet(value) {
	const height = Number(value);
	return Number.isFinite(height) && height > 0 ? Math.max(CV_PROFILE_HEIGHT_MIN, Math.round(height)) : CV_PROFILE_HEIGHT_MAX;
}
