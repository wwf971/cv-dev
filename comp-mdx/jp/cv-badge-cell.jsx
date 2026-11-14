import { observer } from 'mobx-react-lite';
import { Award, Trash2 } from 'lucide-react';
import { cellTokenDefine, EditValueInline, slashActionDefine, slashEffect } from '@wwf971/react-doc';
import { CV_BADGE_FOLDER, cvBadgeCompleteListGet, cvBadgePathNormalize, cvBadgeResolve } from '../query/CvBadge.js';
import { CvJpImagePick } from './CvJpImagePick.jsx';

// A badge as a token kind of a CV's cells and rows (doc/cv-badge.md): the CV's second kind in
// react-doc's cell edit layer (react-doc: main/doc_page_impl_edit_cell.md), beside the query.
//
//   written   {{/badge/aws/saa}}            the badge at that path of the profile's partition; a
//             {{/badge/aws/saa/v1|size=l}}  folder names its first badge. after "|": how this
//                                           one is drawn here (size: s, m, l; name: its name beside it)
//   drawn     as its image, in the line
//   typed     with /badge (or /bd), or by typing "{{/badge/": a folder at a time; a path
//             nothing is at offers to make the badge
//   changed   a click on a badge of a sheet being edited selects it, and its card stands to
//             its right: its size here, its name and image in the profile, taking it out
//
// context (the cell's, kept current by the sheet): badge (cvBadgeRead of the profile's
// partition), isEditing, isProfileEditable, badgeCreate(path), badgeWrite(badge, change)

export const CV_BADGE_SIGIL = `/${CV_BADGE_FOLDER}/`;
export const CV_BADGE_SIZE_LIST = [{ id: 's', label: 'S', title: 'Small: the height of a line' }, { id: 'm', label: 'M', title: 'Medium' }, { id: 'l', label: 'L', title: 'Large' }];
const CV_BADGE_SIZE_DEFAULT = 'm';

export function cvBadgeTokenTextBuild(path) {
	return `{{${CV_BADGE_SIGIL}${cvBadgePathNormalize(path)}}}`;
}

export const cvBadgeSlashAction = slashActionDefine({
	name: 'badge',
	aliasList: ['bd'],
	label: 'Badge',
	description: 'a badge of the profile, by its path: aws/saa',
	icon: Award,
	param: {
		placeholder: 'a path below /badge of the profile: aws/, aws/saa/ … (a folder goes on)',
		emptyText: 'The profile has no badge here; type a whole path (aws/saa/v1) to make one',
		itemListGet: (param, context) => cvBadgeCompleteListGet(context.badge, param).map((item) => {
			if (item.kind === 'dir') return { ...item, detail: `${item.count} badge${item.count === 1 ? '' : 's'}` };
			if (item.kind === 'new') return { ...item, label: `New badge at ${item.path}`, detail: context.isProfileEditable ? 'made in the profile, with a stand-in image' : 'the profile cannot be written now' };
			return { ...item, label: item.kind === 'default' ? `${item.path}/ itself` : item.path.split('/').pop(), detail: item.kind === 'default' ? `its first badge: ${item.badge.name || item.badge.path}` : item.badge.name };
		}),
		itemChoose: (item, param, context) => {
			if (item.kind === 'dir') return slashEffect.paramSet(`${item.path}/`);
			if (item.kind === 'new') {
				if (!context.isProfileEditable) return undefined;
				// the badge is made while the token is written; the token draws it once it is there
				void context.badgeCreate?.(item.path);
			}
			return slashEffect.replace(cvBadgeTokenTextBuild(item.path));
		},
		ItemRender: CvBadgeSlashItem,
	},
});

function CvBadgeSlashItem({ item }) {
	return (
		<span className="doc-edit-slash-row">
			{item.badge?.image ? <img className="doc-cv-badge-thumb" src={item.badge.image} alt="" /> : <Award size={13} className="doc-edit-slash-icon" aria-hidden="true" />}
			<span className="doc-edit-slash-label-main">{item.label}</span>
			{item.detail ? <span className="doc-edit-slash-muted doc-edit-slash-fill">{item.detail}</span> : null}
		</span>
	);
}

const CvBadgeRender = observer(function CvBadgeRender({ token, cell }) {
	const resolved = cvBadgeResolve(cell.context.badge, token.data.path);
	const size = CV_BADGE_SIZE_LIST.some((one) => one.id === token.param.size) ? token.param.size : CV_BADGE_SIZE_DEFAULT;
	if (resolved.status !== 'found') {
		// while a sheet is edited a badge nothing answers to is seen and can be selected; read, it is nothing
		if (!cell.context.isEditing) return null;
		return <span className="doc-cv-badge-missing" data-size={size} title={resolved.status === 'loading' ? 'reading the badge' : resolved.message}>{token.data.path}</span>;
	}
	const { badge } = resolved;
	return (
		<span className="doc-cv-badge-box" data-size={size}>
			<img className="doc-cv-badge" src={badge.image} alt={badge.name} title={badge.name || badge.path} />
			{token.param.name ? <span className="doc-cv-badge-name">{badge.name}</span> : null}
		</span>
	);
});

// the card of a selected badge: how it is drawn in this place (parameters of the token), and
// the badge itself, which is the profile's and so the same in every CV reading it
const CvBadgeCard = observer(function CvBadgeCard({ token, cell, tokenSet }) {
	const context = cell.context;
	const resolved = cvBadgeResolve(context.badge, token.data.path);
	const badge = resolved.badge;
	const size = CV_BADGE_SIZE_LIST.some((one) => one.id === token.param.size) ? token.param.size : CV_BADGE_SIZE_DEFAULT;
	const isLocked = !context.isProfileEditable;
	return (
		<>
			<div className="doc-cv-badge-card-top">
				{badge?.image ? <img className="doc-cv-badge-card-image" src={badge.image} alt="" /> : <span className="doc-cv-badge-card-image" data-empty="" />}
				<div className="doc-cv-badge-card-what">
					<span className="doc-cv-badge-card-path">/{CV_BADGE_FOLDER}/{token.data.path}</span>
					<span className="doc-cv-jp-editor-hint">
						{resolved.status !== 'found' ? resolved.message || 'reading…' : resolved.isDefault ? `a folder: its first badge, ${badge.path}` : 'this badge'}
					</span>
				</div>
			</div>
			<div className="doc-cv-badge-card-section">
				<span className="doc-cv-jp-editor-label">Here</span>
				<div className="doc-cv-badge-card-line">
					<span className="doc-cv-jp-editor-hint">Size</span>
					<span className="doc-edit-segment" role="group" aria-label="The size of the badge here">
						{CV_BADGE_SIZE_LIST.map((one) => (
							<button key={one.id} type="button" className={one.id === size ? 'is-active' : ''} aria-pressed={one.id === size} title={one.title} onClick={() => tokenSet({ param: { size: one.id === CV_BADGE_SIZE_DEFAULT ? null : one.id } })}>{one.label}</button>
						))}
					</span>
				</div>
				<div className="doc-cv-badge-card-line">
					<span className="doc-cv-jp-editor-hint">Its name</span>
					<span className="doc-edit-segment" role="group" aria-label="Whether the name of the badge is written beside its image">
						<button type="button" className={!token.param.name ? 'is-active' : ''} aria-pressed={!token.param.name} title="The image alone" onClick={() => tokenSet({ param: { name: null } })}>Hidden</button>
						<button type="button" className={token.param.name ? 'is-active' : ''} aria-pressed={Boolean(token.param.name)} title="The name of the badge beside its image" onClick={() => tokenSet({ param: { name: true } })}>Beside it</button>
					</span>
				</div>
				<div className="doc-cv-badge-card-line">
					<button type="button" className="doc-button" title="Take the badge out of this text; the profile keeps it" onClick={() => tokenSet(null)}>
						<Trash2 size={12} aria-hidden="true" /><span>Take out of the text</span>
					</button>
				</div>
			</div>
			{badge ? (
				<div className="doc-cv-badge-card-section">
					<span className="doc-cv-jp-editor-label">The badge, in the profile: for every CV of the partition</span>
					<div className="doc-cv-badge-card-line">
						<span className="doc-cv-jp-editor-hint">Name</span>
						<EditValueInline value={badge.name} placeholder="(its name)" isLocked={isLocked} title={isLocked ? context.profileUnavailableReason : undefined} onCommit={(name) => context.badgeWrite?.(badge, { name })} />
					</div>
					<div className="doc-cv-badge-card-line">
						<CvJpImagePick label="Replace its image…" sizeMax={400} isDisabled={isLocked} onImage={(image) => context.badgeWrite?.(badge, { image })} />
					</div>
				</div>
			) : null}
		</>
	);
});

export const cvBadgeToken = cellTokenDefine({
	name: 'badge',
	label: 'Badge',
	description: 'a badge of the profile the CV reads: {{/badge/aws/saa}}',
	brace: { sigil: CV_BADGE_SIGIL },
	read: (body) => (cvBadgePathNormalize(body) === '' ? undefined : { path: cvBadgePathNormalize(body) }),
	textGet: (token, cell) => cvBadgeResolve(cell.context.badge, token.data.path).badge?.name ?? '',
	Render: CvBadgeRender,
	Card: CvBadgeCard,
	slashAction: cvBadgeSlashAction,
});
