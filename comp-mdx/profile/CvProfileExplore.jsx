import { observer } from 'mobx-react-lite';
import { ArrowLeftRight, ArrowUp, ChevronRight, Folder, Home } from 'lucide-react';
import { CvProfileRowDraft, CvProfileRowLeaf } from './CvProfileRow.jsx';

// The values of a profile walked as a file explorer walks folders (query/CvInfoExplore.js): a
// path bar, and under it what lies next to the path walked.
//
//   [↑]  ⌂ › name › last                                                     2 values
//   ▭ jp               3   山田 · やまだ · Yamada                                    ›
//     en                   Yamada                                        [copy] [bin]
//
// A folder is entered by a click; a value is read, and changed in its row. Segments that come in
// any order (an unordered group of a path pattern) are ONE item, as they are written, and each
// of them is a way forward:
//
//   ▭ ( ⇄ jp | last )  3   山田 · やまだ · Yamada       jp: on to name/jp; last: on to name/last;
//     ( ⇄ en | last )      Yamada                      the row itself: past both, name/jp/last
//
// so the path bar says the order the reader took, which is one of the orders a query may have.
// Words typed leave the explorer for what they find: every value found with the folder it lies
// in, a click on which goes there.

// the bar of the path walked: up a level, the top, every folder on the way
//   countLeaf   the values at the path and below
export const CvProfilePathBar = observer(function CvProfilePathBar({ store, countLeaf }) {
	const { pathList } = store;
	return (
		<div className="doc-cv-profile-path" role="navigation" aria-label="The path walked">
			<button type="button" className="doc-cv-profile-icon-button" disabled={pathList.length === 0} aria-label="Up a level" title="Up a level" onClick={() => store.pathSet(pathList.slice(0, -1))}>
				<ArrowUp size={13} aria-hidden="true" />
			</button>
			<span className="doc-cv-profile-crumb-list">
				<button type="button" className="doc-cv-profile-crumb" aria-current={pathList.length === 0 ? 'page' : undefined} aria-label="The top of the profile" title="The top of the profile" onClick={() => store.pathSet([])}>
					<Home size={12} aria-hidden="true" />
				</button>
				{pathList.map((segment, index) => (
					// the place of a crumb is its key: the same word may stand twice in a path
					// eslint-disable-next-line react/no-array-index-key
					<span key={index} className="doc-cv-profile-crumb-step">
						<ChevronRight size={11} aria-hidden="true" className="doc-cv-profile-crumb-mark" />
						<button type="button" className="doc-cv-profile-crumb" aria-current={index === pathList.length - 1 ? 'page' : undefined} title={pathList.slice(0, index + 1).join('/')} onClick={() => store.pathSet(pathList.slice(0, index + 1))}>{segment}</button>
					</span>
				))}
			</span>
			<span className="doc-cv-profile-space" />
			<span className="doc-cv-profile-muted">{countLeaf} {countLeaf === 1 ? 'value' : 'values'}</span>
		</div>
	);
});

//   explore     what lies at the path walked (cvInfoExploreGet)
//   foundList   words are typed: what they find (cvInfoFindListGet), drawn instead; else undefined
export const CvProfileExplore = observer(function CvProfileExplore({ explore, foundList, store, service, info, partitionId, isEditShown, isLocked, lockedReason }) {
	const rowProp = { store, service, isEditShown, isLocked, lockedReason };
	if (foundList) {
		if (foundList.length === 0) return <div className="doc-cv-profile-empty"><span className="doc-cv-profile-muted">No value has these words in its path or its text.</span></div>;
		return (
			<div className="doc-cv-profile-explore">
				{foundList.map((found) => (
					<CvProfileRowLeaf key={found.id} id={found.id} leaf={found.leaf} {...rowProp}>
						<button type="button" className="doc-cv-profile-found" title={`Go to ${found.pathParentList.join('/') || 'the top of the profile'}`} onClick={() => store.pathSet(found.pathParentList, { isFindEnded: true })}>
							{found.pathParentList.length > 0 ? <span className="doc-cv-profile-found-folder">{found.pathParentList.join('/')}/</span> : null}
							<span>{found.name}</span>
						</button>
					</CvProfileRowLeaf>
				))}
			</div>
		);
	}
	const isDraftShown = isEditShown && Boolean(store.draft);
	if (explore.itemList.length === 0 && !isDraftShown) {
		return <div className="doc-cv-profile-empty"><span className="doc-cv-profile-muted">{explore.segmentList.length === 0 ? 'No information in this partition yet.' : `Nothing lies at ${explore.segmentList.join('/')}.`}</span></div>;
	}
	return (
		<div className="doc-cv-profile-explore">
			{isDraftShown ? <CvProfileRowDraft store={store} service={service} info={info} partitionId={partitionId} /> : null}
			{explore.itemList.map((item) => (item.kind === 'folder'
				? <CvProfileItemFolder key={item.id} item={item} explore={explore} store={store} />
				: (
					<CvProfileRowLeaf key={item.id} id={item.id} leaf={item.leaf} {...rowProp}>
						<span className="doc-cv-profile-item-icon" />
						<CvProfileItemName item={item} explore={explore} store={store} />
					</CvProfileRowLeaf>
				)))}
		</div>
	);
});

// a folder: entered by a click on its row; a group, also by any one of its members
const CvProfileItemFolder = observer(function CvProfileItemFolder({ item, explore, store }) {
	const enter = () => store.pathSet(item.pathNextList);
	const preview = `${item.previewList.join(' · ')}${item.countLeaf > item.previewList.length ? ' …' : ''}`;
	return (
		<div
			className="doc-cv-profile-row"
			data-kind="folder"
			role="button"
			tabIndex={0}
			title={`Open ${item.pathNextList.join('/')}`}
			onClick={enter}
			onKeyDown={(event) => {
				if (event.target !== event.currentTarget) return;
				if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); enter(); }
			}}
		>
			<span className="doc-cv-profile-name">
				<span className="doc-cv-profile-item-icon"><Folder size={13} aria-hidden="true" /></span>
				<CvProfileItemName item={item} explore={explore} store={store} />
				<span className="doc-cv-profile-count">{item.countLeaf}</span>
			</span>
			<span className="doc-cv-profile-value doc-cv-profile-preview">{preview}</span>
			<span className="doc-cv-profile-action-list" data-shown=""><ChevronRight size={13} aria-hidden="true" className="doc-cv-profile-enter-mark" /></span>
		</div>
	);
});

// what an item is called: a segment, or the members of an unordered group, each a button going
// on by that member first. A value lying at the path walked itself has no name left
const CvProfileItemName = observer(function CvProfileItemName({ item, explore, store }) {
	if (item.memberList.length === 0) return <span className="doc-cv-profile-name-text doc-cv-profile-muted">(the value at this path)</span>;
	if (!item.isGroup) return <span className="doc-cv-profile-name-text">{item.memberList[0].label}</span>;
	const labelList = item.memberList.map((member) => member.label);
	return (
		<span className="doc-cv-profile-group" title={`${labelList.join(', ')}: in any order. Choose which comes first`}>
			<ArrowLeftRight size={11} aria-hidden="true" className="doc-cv-profile-group-mark" />
			{item.memberList.map((member) => (
				<button
					key={member.label}
					type="button"
					className="doc-cv-profile-group-member"
					title={`Go on by ${member.label}: ${[...explore.segmentList, ...member.segmentList].join('/')}`}
					onClick={(event) => { event.stopPropagation(); store.pathSet([...explore.segmentList, ...member.segmentList]); }}
				>{member.label}</button>
			))}
		</span>
	);
});
