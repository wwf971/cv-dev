import { assetPathIndexBelowList, assetPathIndexBuild, assetPathIndexComplete, assetPathIndexGet, assetPathIndexNodeGet, assetPathSplit } from '@wwf971/react-doc/asset-path';
import { cvPathInPartition, cvPathSplit } from './CvProfile.js';

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
export const CV_BADGE_FOLDER = 'badge';

// the badges of a profile in a partition, as its object says now:
//   { badgeList, index, countLoading, countAll, problemList }
//   a badge: { key, path, name, issuer, url, image, pathFull }   path: below /badge, aws/saa/v1
export function cvBadgeRead(profile, partition = '') {
	const badgeList = [];
	const problemList = [];
	let countLoading = 0;
	const assetList = profile.assetList(CV_KIND_BADGE)
		.filter((asset) => asset.status === 'found')
		.filter((asset) => cvPathSplit(asset.pathList?.[0]).partition === partition);
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
export function cvBadgeCreateInput(partition, pathInput, data = {}) {
	const path = cvBadgePathNormalize(pathInput);
	return {
		kind: CV_KIND_BADGE,
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
