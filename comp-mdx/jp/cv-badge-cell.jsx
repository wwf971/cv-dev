import { useContext } from 'react';
import { observer } from 'mobx-react-lite';
import { Award, Trash2 } from 'lucide-react';
import { cellTokenDefine, EditValueInline, slashActionDefine, slashEffect } from '@wwf971/react-doc';
import {
	CV_BADGE_FOLDER, CV_BADGE_SIZE_BY_NAME, CV_BADGE_SIZE_MAX, CV_BADGE_SIZE_MIN, cvBadgeCaptionDecode, cvBadgeCaptionEncode, cvBadgeCaptionLineListGet, cvBadgeCompleteListGet,
	cvBadgePathNormalize, cvBadgeResolve, cvBadgeSizeGet, cvBadgeSizeParamGet,
} from '../query/CvBadge.js';
import { CvJpImagePick } from './CvJpImagePick.jsx';
import { cvJpRowBreakKey } from './cv-page-break.js';
import { CvJpRowBreakContext } from './cv-page-break-context.js';

// A badge as a token kind of a CV's cells and rows (doc/cv-badge.md): the CV's second kind in
// react-doc's cell editing kit (react-doc: main/doc_page_impl_edit_cell.md), beside the query.
//
//   written   {{/badge/aws/saa}}            the badge at that path of the profile's partition; a
//             {{/badge/aws/saa/v1|size=l}}  folder names its first badge. after "|": how this
//             {{/badge/aws/saa|size=64,caption}}   one is drawn here:
//               size      its height: s, m, l, or any number of px (size=64)
//               name      its name beside it
//               caption   text under it: the badge's own, kept in the profile; caption=…: this
//                         place's own, a line under another (written …\n…)
//   drawn     as its image, in the line; with a caption as a tile, the image over its text, so
//             that badges one after another stand as a grid
//   typed     with /badge (or /bd), or by typing "{{/badge/": a folder at a time; a path
//             nothing is at offers to make the badge
//   changed   a click on a badge of a sheet being edited selects it, and its card stands to
//             its right: its size and text here, its name, caption and image in the profile,
//             taking it out
//
//             a field of the card is typed in place and written when Enter is pressed or the
//             field is left (no button saves): the badge on the sheet shows it at once, and a
//             write the profile refused is said in the card
//
// context (the cell's, kept current by the sheet): badge (cvBadgeRead of the profile's
// partition), isEditing, isProfileEditable, badgeCreate(path), badgeWrite(badge, change),
// writeProblem (why the last write failed, '' when it did not)

export const CV_BADGE_SIGIL = `/${CV_BADGE_FOLDER}/`;
export const CV_BADGE_SIZE_LIST = [{ id: 's', label: 'S', title: 'Small: the height of a line' }, { id: 'm', label: 'M', title: 'Medium' }, { id: 'l', label: 'L', title: 'Large' }];
// what the text under a badge is, in one place
const CV_BADGE_CAPTION_MODE_LIST = [
	{ id: 'none', label: 'None', title: 'The image alone, in the line' },
	{ id: 'badge', label: "The badge's", title: 'The caption kept with the badge in the profile, the same in every paper (its name while it has none)' },
	{ id: 'own', label: 'Own', title: 'Text of this place only' },
];

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
	// in a row of a history: a place the row may be cut after, on pages (cv-page-break.js)
	const rowId = useContext(CvJpRowBreakContext);
	const pageBreak = rowId ? cvJpRowBreakKey(rowId, token.end) : undefined;
	const resolved = cvBadgeResolve(cell.context.badge, token.data.path);
	const captionMode = captionModeGet(token.param);
	const height = cvBadgeSizeGet(token.param.size, captionMode !== 'none');
	if (resolved.status !== 'found') {
		// while a sheet is edited a badge nothing answers to is seen and can be selected; read, it is nothing
		if (!cell.context.isEditing) return null;
		return <span className="doc-cv-badge-missing" title={resolved.status === 'loading' ? 'reading the badge' : resolved.message}>{token.data.path}</span>;
	}
	const { badge } = resolved;
	const image = <img className="doc-cv-badge" style={{ height: `${height}px` }} src={badge.image} alt={badge.name} title={badge.name || badge.path} />;
	if (captionMode !== 'none') {
		// a tile: the image over its text. tiles one after another in a line stand as a grid
		return (
			<span className="doc-cv-badge-tile" style={{ minWidth: `${height}px` }} data-page-break={pageBreak}>
				{image}
				<span className="doc-cv-badge-caption">
					{cvBadgeCaptionLineListGet(token.param, badge).map((line, index) => <span key={index} className="doc-cv-badge-caption-line">{line}</span>)}
				</span>
			</span>
		);
	}
	return (
		<span className="doc-cv-badge-box" data-page-break={pageBreak}>
			{image}
			{token.param.name ? <span className="doc-cv-badge-name">{badge.name}</span> : null}
		</span>
	);
});

function captionModeGet(param) {
	if (param?.caption === true) return 'badge';
	return param?.caption ? 'own' : 'none';
}

// lines of text edited a line a field: each is changed in place, an empty one goes, and the
// field after the last adds a line. so a text of any number of lines needs no editor of its own
function CvBadgeLineListEdit({ lineList, placeholder, isLocked = false, title, onCommit }) {
	const lineSet = (index, text) => {
		const lineNext = [...lineList];
		lineNext[index] = text;
		onCommit(lineNext.map((line) => String(line ?? '').trim()).filter((line) => line !== ''));
	};
	return (
		<div className="doc-cv-badge-card-line-list">
			{[...lineList, ''].map((line, index) => (
				<EditValueInline key={`${index}:${lineList.length}`} className="doc-cv-badge-card-text" value={line} placeholder={index === lineList.length ? placeholder : ''} isLocked={isLocked} title={title} onCommit={(text) => lineSet(index, text)} />
			))}
		</div>
	);
}

// the card of a selected badge: how it is drawn in this place (parameters of the token), and
// the badge itself, which is the profile's and so the same in every paper reading it
const CvBadgeCard = observer(function CvBadgeCard({ token, cell, tokenSet }) {
	const context = cell.context;
	const resolved = cvBadgeResolve(context.badge, token.data.path);
	const badge = resolved.badge;
	const captionMode = captionModeGet(token.param);
	const isCaption = captionMode !== 'none';
	const height = cvBadgeSizeGet(token.param.size, isCaption);
	const isLocked = !context.isProfileEditable;
	const sizeSet = (value) => tokenSet({ param: { size: cvBadgeSizeParamGet(value, isCaption) ?? null } });
	const captionModeSet = (mode) => {
		if (mode === 'none') tokenSet({ param: { caption: null } });
		else if (mode === 'badge') tokenSet({ param: { caption: true, name: null } });
		// its own text starts as what is drawn now, to be changed
		else tokenSet({ param: { caption: cvBadgeCaptionEncode(cvBadgeCaptionLineListGet({ caption: true }, badge)) || (badge?.name ?? token.data.path), name: null } });
	};
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
							<button key={one.id} type="button" className={CV_BADGE_SIZE_BY_NAME[one.id] === height ? 'is-active' : ''} aria-pressed={CV_BADGE_SIZE_BY_NAME[one.id] === height} title={`${one.title}: ${CV_BADGE_SIZE_BY_NAME[one.id]}px`} onClick={() => sizeSet(one.id)}>{one.label}</button>
						))}
					</span>
					{/* any height, typed: the three names are only the usual ones */}
					<EditValueInline className="doc-cv-badge-card-number" value={String(height)} aria-label="The height of the badge here, in px" title={`Its height in px, from ${CV_BADGE_SIZE_MIN} to ${CV_BADGE_SIZE_MAX}`} onCommit={(text) => { if (Number.parseFloat(text) > 0) sizeSet(text); }} />
					<span className="doc-cv-jp-editor-hint">px</span>
				</div>
				<div className="doc-cv-badge-card-line">
					<span className="doc-cv-jp-editor-hint">Text under it</span>
					<span className="doc-edit-segment" role="group" aria-label="The text under the badge here">
						{CV_BADGE_CAPTION_MODE_LIST.map((one) => (
							<button key={one.id} type="button" className={one.id === captionMode ? 'is-active' : ''} aria-pressed={one.id === captionMode} title={one.title} onClick={() => captionModeSet(one.id)}>{one.label}</button>
						))}
					</span>
				</div>
				{captionMode === 'own' ? (
					<CvBadgeLineListEdit lineList={cvBadgeCaptionDecode(token.param.caption)} placeholder="+ a line" onCommit={(lineList) => tokenSet({ param: { caption: cvBadgeCaptionEncode(lineList) || true } })} />
				) : null}
				{!isCaption ? (
					<div className="doc-cv-badge-card-line">
						<span className="doc-cv-jp-editor-hint">Its name</span>
						<span className="doc-edit-segment" role="group" aria-label="Whether the name of the badge is written beside its image">
							<button type="button" className={!token.param.name ? 'is-active' : ''} aria-pressed={!token.param.name} title="The image alone" onClick={() => tokenSet({ param: { name: null } })}>Hidden</button>
							<button type="button" className={token.param.name ? 'is-active' : ''} aria-pressed={Boolean(token.param.name)} title="The name of the badge beside its image" onClick={() => tokenSet({ param: { name: true } })}>Beside it</button>
						</span>
					</div>
				) : null}
				<div className="doc-cv-badge-card-line">
					<button type="button" className="doc-button" title="Take the badge out of this text; the profile keeps it" onClick={() => tokenSet(null)}>
						<Trash2 size={12} aria-hidden="true" /><span>Take out of the text</span>
					</button>
				</div>
			</div>
			{badge ? (
				<div className="doc-cv-badge-card-section">
					<span className="doc-cv-jp-editor-label">The badge, in the profile: for every paper of the partition</span>
					{isLocked ? null : <span className="doc-cv-jp-editor-hint">Click a text to change it · Enter, or leaving it, saves · Esc keeps the old one</span>}
					<div className="doc-cv-badge-card-line">
						<span className="doc-cv-jp-editor-hint">Name</span>
						<EditValueInline value={badge.name} placeholder="(its name)" isLocked={isLocked} title={isLocked ? context.profileUnavailableReason : undefined} onCommit={(name) => context.badgeWrite?.(badge, { name })} />
					</div>
					<span className="doc-cv-jp-editor-hint">Caption: the text under it wherever a paper asks for the badge's own (AWS SAA, then 2023.06)</span>
					<CvBadgeLineListEdit lineList={String(badge.caption ?? '').split('\n').filter((line) => line.trim() !== '')} placeholder="+ a line" isLocked={isLocked} title={isLocked ? context.profileUnavailableReason : undefined} onCommit={(lineList) => context.badgeWrite?.(badge, { caption: lineList.join('\n') })} />
					<div className="doc-cv-badge-card-line">
						<CvJpImagePick label="Replace its image…" sizeMax={400} isDisabled={isLocked} onImage={(image) => context.badgeWrite?.(badge, { image })} />
					</div>
					{context.writeProblem ? <p className="doc-cv-jp-editor-missing" role="alert">Not saved: {context.writeProblem}</p> : null}
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
