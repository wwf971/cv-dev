import { assetPathIndexBelowList, assetPathIndexBuild, assetPathIndexComplete, assetPathIndexGet, assetPathIndexNodeGet, assetPathSplit } from '@wwf971/react-doc/asset-path';
import { cvAssetStatusText, cvKindNameOf, cvPathInPartition, cvPathSplit } from './CvProfile.js';

// The badges of a profile (doc/cv-badge.md): a certification badge, a logo, any small image a
// CV shows beside a line. A badge is a data item of the profile of the kind "badge", one item
// per badge, since an image is too large to live among the values of an item of information
// and is replaced on its own:
//
//   /{partition}/badge/aws/saa/v1      { name, issuer?, url?, image: a data url }
//
// It is named inside its partition by its path below /badge: aws/saa/v1. A path that is a
// folder names the first badge below it, in the order of the profile, so a CV writes
// /badge/aws/saa and shows the version the profile lists first. This module is pure: it
// reads a profile through the api of a mode, and knows no form of CV.
export const CV_KIND_BADGE = 'badge';
// the kind of a badge, declared by cv.profile: read in whatever object holds it, by its name there
export const CV_KIND_ID_BADGE = 'cv.profile.badge';
export const CV_BADGE_FOLDER = 'badge';

// the badges of a profile in a partition, as its object says now:
//   { badgeList, index, countLoading, countAll, problemList }
//   a badge: { key, path, name, caption, issuer, url, image, pathFull }   path: below /badge, aws/saa/v1
export function cvBadgeRead(profile, partition = '') {
	const badgeList = [];
	const problemList = [];
	let countLoading = 0;
	const kindName = cvKindNameOf(profile, CV_KIND_ID_BADGE, CV_KIND_BADGE);
	const assetListListed = (kindName ? profile.assetList(kindName) : [])
		.filter((asset) => cvPathSplit(asset.pathList?.[0]).partition === partition);
	for (const asset of assetListListed) {
		if (asset.status !== 'found') problemList.push(`${asset.pathList?.[0] ?? asset.key}: ${cvAssetStatusText(asset.status)}, the badge is not read`);
	}
	const assetList = assetListListed.filter((asset) => asset.status === 'found');
	for (const asset of assetList) {
		const path = cvBadgePathOf(asset.pathList?.[0]);
		if (!path) {
			problemList.push(`${asset.pathList?.[0] ?? asset.key}: a badge lies below /${CV_BADGE_FOLDER}/ of its partition`);
			continue;
		}
		const read = profile.assetDataGet(asset.key);
		if (read.status === 'loading') {
			countLoading += 1;
			continue;
		}
		if (read.status !== 'done') {
			problemList.push(`${asset.pathList?.[0] ?? asset.key}: ${read.message}`);
			continue;
		}
		const data = read.data && typeof read.data === 'object' ? read.data : {};
		badgeList.push({
			key: asset.key,
			path,
			pathFull: asset.pathList[0],
			name: String(data.name ?? asset.name ?? ''),
			caption: typeof data.caption === 'string' ? data.caption : '',
			issuer: String(data.issuer ?? ''),
			url: String(data.url ?? ''),
			image: String(data.image ?? ''),
			data,
		});
	}
	const index = assetPathIndexBuild(badgeList.map((badge) => ({ entry: badge, pathList: [badge.path] })), { labelOf: (badge) => badge.name, segmentNormalize: (segment) => segment.toLowerCase() });
	return { badgeList, index, countLoading, countAll: assetList.length, problemList: [...problemList, ...index.problemList] };
}

// /example/badge/aws/saa/v1 -> aws/saa/v1; '' for a path that is not a badge's
export function cvBadgePathOf(pathFull) {
	const segmentList = assetPathSplit(cvPathSplit(pathFull).pathInPartition);
	return segmentList[0] === CV_BADGE_FOLDER && segmentList.length > 1 ? segmentList.slice(1).join('/') : '';
}

// the path as typed, without what does not belong to it: slashes at its ends, a leading /badge/
export function cvBadgePathNormalize(text) {
	const segmentList = String(text ?? '').split('/').map((segment) => segment.trim()).filter(Boolean);
	return (segmentList[0] === CV_BADGE_FOLDER ? segmentList.slice(1) : segmentList).join('/');
}

// what a path names: the badge at it, else the first badge below it
//   { status: found | unknown | loading, badge?, isDefault, message }
export function cvBadgeResolve(read, pathInput) {
	const path = cvBadgePathNormalize(pathInput);
	if (!read) return { status: 'unknown', isDefault: false, message: 'no profile is read' };
	if (path === '') return { status: 'unknown', isDefault: false, message: 'name a badge: aws/saa' };
	const segmentList = path.split('/');
	const exact = assetPathIndexGet(read.index, segmentList);
	if (exact) return { status: 'found', badge: exact, isDefault: false, message: '' };
	const [first] = assetPathIndexBelowList(read.index, segmentList);
	if (first) return { status: 'found', badge: first, isDefault: true, message: '' };
	if (read.countLoading > 0) return { status: 'loading', isDefault: false, message: '' };
	return { status: 'unknown', isDefault: false, message: `the profile has no badge at ${path}` };
}

// the candidates completing a typed path, a folder at a time:
//   { kind: 'default', path, badge }   the folder typed so far, read as a badge (its first one)
//   { kind: 'dir', path, label, count }   a folder below: choosing goes on inside it
//   { kind: 'badge', path, badge }     a badge
//   { kind: 'new', path }              a path nothing is at: a badge to make
export function cvBadgeCompleteListGet(read, textInput) {
	const text = String(textInput ?? '').trimStart().replace(/^\/+/, '');
	if (!read) return [];
	const itemList = [];
	const folder = text.slice(0, text.lastIndexOf('/') + 1);
	const folderPath = cvBadgePathNormalize(folder);
	// the folder typed so far names a badge by itself: the first below it
	if (folderPath !== '' && text.endsWith('/')) {
		const resolved = cvBadgeResolve(read, folderPath);
		if (resolved.status === 'found' && resolved.isDefault) itemList.push({ id: `default:${folderPath}`, kind: 'default', path: folderPath, badge: resolved.badge });
	}
	for (const one of assetPathIndexComplete(read.index, text, { isEntryWanted: () => true, labelOf: (badge) => badge.name })) {
		const path = one.path.replace(/^\/+/, '');
		if (one.kind === 'folder') itemList.push({ id: `dir:${path}`, kind: 'dir', path, label: `${one.segment}/`, count: one.entryCount });
		else itemList.push({ id: `badge:${path}`, kind: 'badge', path, badge: one.entry });
	}
	const pathTyped = cvBadgePathNormalize(text);
	const isKnown = pathTyped !== '' && (assetPathIndexNodeGet(read.index, pathTyped.split('/')) || itemList.some((item) => item.kind !== 'default'));
	if (pathTyped !== '' && !text.endsWith('/') && !isKnown && cvBadgePathIsValid(pathTyped)) itemList.push({ id: `new:${pathTyped}`, kind: 'new', path: pathTyped });
	return itemList;
}

// a path a badge can be made at: segments of letters, digits, "-", "_" and "."
export function cvBadgePathIsValid(path) {
	return /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/.test(String(path ?? ''));
}

// a new badge of a profile: what its object's api creates (assetCreate)
// kindName: the name the profile holds the kind under (cvKindNameOf)
export function cvBadgeCreateInput(partition, pathInput, data = {}, kindName = CV_KIND_BADGE) {
	const path = cvBadgePathNormalize(pathInput);
	return {
		kind: kindName,
		name: String(data.name ?? cvBadgeLabelOf(path)),
		pathList: [cvPathInPartition(partition, `/${CV_BADGE_FOLDER}/${path}`)],
		...(partition ? { partition } : {}),
		groupPath: CV_BADGE_FOLDER,
		data: { name: cvBadgeLabelOf(path), image: cvBadgePlaceholderBuild(cvBadgeLabelOf(path)), ...data },
	};
}

// a name for a badge nobody named: its path in capitals, without its version (aws/saa/v1 -> AWS SAA)
export function cvBadgeLabelOf(path) {
	const segmentList = cvBadgePathNormalize(path).split('/').filter(Boolean);
	const namedList = segmentList.length > 1 && /^v\d+$/i.test(segmentList[segmentList.length - 1]) ? segmentList.slice(0, -1) : segmentList;
	return namedList.map((segment) => segment.toUpperCase()).join(' ');
}

// the image a badge has until its own is given: a plain hexagon with the letters of its
// name. It is a stand-in drawn here, not the artwork of any issuer: the real image of a
// badge is its holder's to paste in
export function cvBadgePlaceholderBuild(label) {
	const lineList = String(label ?? '').trim().split(/\s+/).filter(Boolean).slice(-2);
	const text = lineList.map((line, index) => `<text x="48" y="${lineList.length === 1 ? 56 : 44 + index * 22}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${lineList.length === 1 ? 24 : 18}" font-weight="700" fill="#ffffff">${xmlEscape(line.slice(0, 6))}</text>`).join('');
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96"><polygon points="48,4 86,26 86,70 48,92 10,70 10,26" fill="#334155" stroke="#94a3b8" stroke-width="3"/>${text}</svg>`;
	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function xmlEscape(text) {
	return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
}

// ---------- how a badge is drawn in one place: the parameters of its token ----------

// the height of a badge by the names of its sizes, in px; any other height is written as a number
export const CV_BADGE_SIZE_BY_NAME = { s: 18, m: 30, l: 46 };
export const CV_BADGE_SIZE_DEFAULT = 'm';
// the height of a badge with text under it, when its token names none: large enough to read
export const CV_BADGE_SIZE_CAPTION = 60;
export const CV_BADGE_SIZE_MIN = 10;
export const CV_BADGE_SIZE_MAX = 300;

// the height in px of a badge whose token says size (s, m, l, or a number of px: size=64)
export function cvBadgeSizeGet(size, isCaption = false) {
	const text = String(size ?? '').trim().toLowerCase();
	if (CV_BADGE_SIZE_BY_NAME[text] !== undefined) return CV_BADGE_SIZE_BY_NAME[text];
	const px = Number.parseFloat(text);
	if (Number.isFinite(px) && px > 0) return Math.min(CV_BADGE_SIZE_MAX, Math.max(CV_BADGE_SIZE_MIN, Math.round(px)));
	return isCaption ? CV_BADGE_SIZE_CAPTION : CV_BADGE_SIZE_BY_NAME[CV_BADGE_SIZE_DEFAULT];
}

// the size as its token writes it: the name of a named height, else the number; undefined for the default
export function cvBadgeSizeParamGet(px, isCaption = false) {
	const height = cvBadgeSizeGet(px, isCaption);
	if (height === cvBadgeSizeGet(undefined, isCaption)) return undefined;
	const name = Object.keys(CV_BADGE_SIZE_BY_NAME).find((one) => CV_BADGE_SIZE_BY_NAME[one] === height);
	return name ?? String(height);
}

// the text under a badge, a line under another, as a parameter of its token keeps it: one line of
// text, its lines parted by "\n" as written (a backslash and an n), since a token is never broken
// over lines. the marks a parameter cannot hold (, | { }) are written in their full width
const CAPTION_LINE_MARK = '\\n';
const CAPTION_CHAR_SAFE = { ',': '，', '|': '｜', '{': '｛', '}': '｝' };

export function cvBadgeCaptionEncode(lineList) {
	return (lineList ?? []).map((line) => String(line ?? '').replace(/\r?\n/g, ' ').replace(/[,|{}]/g, (char) => CAPTION_CHAR_SAFE[char]).trim())
		.filter((line) => line !== '').join(CAPTION_LINE_MARK);
}

export function cvBadgeCaptionDecode(text) {
	return String(text ?? '').split(CAPTION_LINE_MARK).map((line) => line.trim()).filter((line) => line !== '');
}

// the lines under a badge in one place (param: the parameters of its token):
//   no caption     none: the badge stands in the line as an image
//   caption        the badge's own, kept in the profile for every paper (badge.caption, a line a
//                  line), else its name
//   caption=…      this place's own
export function cvBadgeCaptionLineListGet(param, badge) {
	const caption = param?.caption;
	if (caption === undefined || caption === null || caption === false || caption === '') return [];
	if (caption !== true) return cvBadgeCaptionDecode(caption);
	const own = String(badge?.caption ?? '').split('\n').map((line) => line.trim()).filter((line) => line !== '');
	return own.length > 0 ? own : [String(badge?.name ?? '')].filter((line) => line !== '');
}
