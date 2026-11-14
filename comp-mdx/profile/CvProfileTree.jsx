import { observer } from 'mobx-react-lite';
import { ArrowLeftRight, ChevronRight, Plus } from 'lucide-react';
import { CvProfileRowDraft, CvProfileRowLeaf, cvProfileIndentStyle } from './CvProfileRow.jsx';

// The values of a profile as a tree of rows (query/CvInfoTree.js): a folder a click opens, a
// value changed in its row. The names are indented a level at a time, so the values stand in
// one column whatever their depth.
//
//   ▸ name      8    山田 · やまだ · Yamada …      a closed folder says what it holds     [+]
//   ▾ address   6                                                                         [+]
//       (a new value: its name | its value)                                          [✓] [×]
//     ▸ jp ⇄    5    100-0001 · 東京都千代田区 …                                           [+]
//     gender         male                                                        [copy] [bin]
//
// the + of a folder adds a value inside it: typed in the first row of the folder, where it will be.
// ⇄ marks a level that comes in any order with another one (a member of an unordered group): the
// tree draws one order, the canonical one, and says where the other is as good.
//
//   rowList      the rows drawn (cvInfoTreeRowListGet)
//   isFinding    words are typed: the tree is what they leave of it
export const CvProfileTree = observer(function CvProfileTree({ rowList, store, service, info, partitionId, isEditShown, isLocked, lockedReason, isFinding }) {
	if (rowList.length === 0) return <div className="doc-cv-profile-empty"><span className="doc-cv-profile-muted">{isFinding ? 'No value has these words in its path or its text.' : 'No information in this partition yet.'}</span></div>;
	return (
		<div className="doc-cv-profile-tree" role="tree" aria-label="The values of the profile">
			{rowList.map((row) => {
				if (row.kind === 'draft') return <CvProfileRowDraft key={row.id} depth={row.depth} store={store} service={service} info={info} partitionId={partitionId} />;
				if (row.kind === 'folder') return <CvProfileRowFolder key={row.id} row={row} store={store} isEditShown={isEditShown} isLocked={isLocked} lockedReason={lockedReason} isFinding={isFinding} />;
				return (
					<CvProfileRowLeaf key={row.id} id={row.id} leaf={row.node.leaf} depth={row.depth} store={store} service={service} isEditShown={isEditShown} isLocked={isLocked} lockedReason={lockedReason}>
						<span className="doc-cv-profile-chevron-space" />
						<span className="doc-cv-profile-name-text">{row.node.name}</span>
						<CvProfileOrderFree node={row.node} />
					</CvProfileRowLeaf>
				);
			})}
		</div>
	);
});

// the mark of a level that could as well come after the next one, or before the one above
function CvProfileOrderFree({ node }) {
	if (node.memberOtherList.length === 0) return null;
	return (
		<span className="doc-cv-profile-order-free" title={`${node.name} comes in any order with ${node.memberOtherList.join(', ')}: a query may name either first`}>
			<ArrowLeftRight size={11} aria-hidden="true" />
		</span>
	);
}

const CvProfileRowFolder = observer(function CvProfileRowFolder({ row, store, isEditShown, isLocked, lockedReason, isFinding }) {
	const { node, isOpen } = row;
	const toggle = () => { if (!isFinding) store.folderToggle(node.path); };
	const preview = `${node.previewList.join(' · ')}${node.countLeaf > node.previewList.length ? ' …' : ''}`;
	return (
		<div
			className="doc-cv-profile-row"
			data-kind="folder"
			role="treeitem"
			aria-expanded={isOpen}
			tabIndex={0}
			onClick={toggle}
			onKeyDown={(event) => {
				if (event.target !== event.currentTarget) return;
				if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); }
			}}
		>
			<span className="doc-cv-profile-name" style={cvProfileIndentStyle(row.depth)}>
				<ChevronRight size={12} aria-hidden="true" className="doc-cv-profile-chevron" data-open={isOpen ? '' : undefined} />
				<span className="doc-cv-profile-name-text" title={`${node.path}: ${node.countLeaf} ${node.countLeaf === 1 ? 'value' : 'values'}`}>{node.name}</span>
				<CvProfileOrderFree node={node} />
				<span className="doc-cv-profile-count">{node.countLeaf}</span>
			</span>
			{/* open, its values are below it; closed, it says the first of them */}
			<span className="doc-cv-profile-value doc-cv-profile-preview">{isOpen ? '' : preview}</span>
			<span className="doc-cv-profile-action-list">
				{isEditShown ? (
					<button type="button" className="doc-cv-profile-icon-button" disabled={isLocked} aria-label={`Add a value in ${node.path}`} title={lockedReason || `Add a value in ${node.path}`} onClick={(event) => { event.stopPropagation(); store.draftOpen(node.path); }}>
						<Plus size={13} aria-hidden="true" />
					</button>
				) : null}
			</span>
		</div>
	);
});
