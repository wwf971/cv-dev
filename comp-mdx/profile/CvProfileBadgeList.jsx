import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { Check, Copy, Plus, Trash2, X } from 'lucide-react';
import { EditValueInline } from '@wwf971/react-doc';
import { cvBadgePathIsValid, cvBadgePathNormalize } from '../query/CvBadge.js';
import { CvJpImagePick } from '../jp/CvJpImagePick.jsx';
import { CV_PROFILE_EDIT_CLASS, cvProfileEditKeyDown } from './CvProfileRow.jsx';

// The badges of a partition (doc/cv-badge.md), the second tab of the mode Information: a row a
// badge, its image | its path below /badge | its name | what can be done with it. A new one is
// typed in the first row: its path, then its image chosen or pasted (or none: a stand-in).
//
//   badgeList   the badges of the partition (cvBadgeRead)
export const CvProfileBadgeList = observer(function CvProfileBadgeList({ badgeList, store, service, partitionId, isEditShown, isLocked, lockedReason }) {
	const isDraftShown = isEditShown && Boolean(store.badgeDraft);
	if (badgeList.length === 0 && !isDraftShown) return <div className="doc-cv-profile-empty"><span className="doc-cv-profile-muted">No badge in this partition yet.</span></div>;
	return (
		<div className="doc-cv-profile-badge-list">
			{isDraftShown ? <CvProfileBadgeDraft store={store} service={service} partitionId={partitionId} isLocked={isLocked} /> : null}
			{badgeList.map((badge) => {
				const token = `{{/badge/${badge.path}}}`;
				const isCopied = store.copiedId === badge.key;
				return (
					<div key={badge.key} className="doc-cv-profile-row" data-kind="badge">
						<span className="doc-cv-profile-badge-image">{badge.image ? <img src={badge.image} alt="" /> : null}</span>
						<span className="doc-cv-profile-name" title={`A CV shows it as ${token}`}><span className="doc-cv-profile-name-text">/badge/{badge.path}</span></span>
						<span className="doc-cv-profile-value">
							{!isEditShown ? <span className="doc-cv-profile-text">{badge.name}</span>
								: <EditValueInline className={CV_PROFILE_EDIT_CLASS} value={badge.name} placeholder="(its name)" isLocked={isLocked} title={lockedReason || undefined} onKeyDown={cvProfileEditKeyDown} onCommit={(name) => store.badgeWrite(service, badge, { name })} />}
						</span>
						<span className="doc-cv-profile-action-list">
							{isEditShown ? <CvJpImagePick label="Image…" sizeMax={400} isPasteTaken={false} isDisabled={isLocked} onImage={(image) => store.badgeWrite(service, badge, { image })} onProblem={store.messageSet} /> : null}
							<button type="button" className="doc-cv-profile-icon-button" aria-label={`Copy ${token}`} title={isCopied ? 'Copied' : `Copy ${token}, what a CV writes to show this badge`} onClick={() => store.copy(badge.key, token)}>
								{isCopied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
							</button>
							{isEditShown ? (
								<button type="button" className="doc-cv-profile-icon-button" disabled={isLocked} aria-label={`Remove the badge ${badge.path}`} title={lockedReason || `Remove the badge ${badge.path}`} onClick={() => store.badgeRemove(service, badge)}>
									<Trash2 size={13} aria-hidden="true" />
								</button>
							) : null}
						</span>
					</div>
				);
			})}
		</div>
	);
});

const CvProfileBadgeDraft = observer(function CvProfileBadgeDraft({ store, service, partitionId, isLocked }) {
	const pathRef = useRef(null);
	useEffect(() => {
		pathRef.current?.focus();
		pathRef.current?.scrollIntoView({ block: 'nearest' });
	}, []);
	const path = cvBadgePathNormalize(store.badgeDraft?.path);
	const isValid = cvBadgePathIsValid(path);
	return (
		<div className="doc-cv-profile-row" data-kind="draft">
			<span className="doc-cv-profile-badge-image" />
			<span className="doc-cv-profile-name">
				<input ref={pathRef} className="doc-cv-profile-input" aria-label="The path of a new badge" placeholder="its path: aws/saa/v2" value={store.badgeDraft?.path ?? ''} onChange={(event) => store.badgeDraftSet({ path: event.target.value })} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); store.badgeDraftClose(); } }} />
			</span>
			{/* its image chosen or pasted makes it; without one it starts with a stand-in */}
			<span className="doc-cv-profile-value doc-cv-profile-badge-make">
				<CvJpImagePick label="Add with an image…" sizeMax={400} isPasteTaken={isValid} isDisabled={isLocked || !isValid || store.isSubmitting} onImage={(image) => store.badgeAdd(service, partitionId, image)} onProblem={store.messageSet} />
				<button type="button" className="doc-button" disabled={isLocked || !isValid || store.isSubmitting} title="Add the badge with a stand-in image, to be replaced" onClick={() => store.badgeAdd(service, partitionId)}><Plus size={12} aria-hidden="true" /><span>Add without one</span></button>
			</span>
			<span className="doc-cv-profile-action-list" data-shown="">
				<button type="button" className="doc-cv-profile-icon-button" aria-label="Cancel" title="Cancel" onClick={store.badgeDraftClose}><X size={13} aria-hidden="true" /></button>
			</span>
		</div>
	);
});
