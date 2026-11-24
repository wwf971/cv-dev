import assert from 'node:assert/strict';
import test from 'node:test';
import {
	cvBadgeCompleteListGet, cvBadgeCreateInput, cvBadgeLabelOf, cvBadgePathNormalize, cvBadgePathOf, cvBadgePlaceholderBuild, cvBadgeRead, cvBadgeResolve,
} from './CvBadge.js';

// a profile as the api of a mode gives it: badges are data items of the kind badge
const dataByKey = {
	'badge-1': { name: 'AWS Certified Solutions Architect – Associate', issuer: 'Amazon Web Services', image: 'data:image/png;base64,AAAA' },
	'badge-2': { name: 'SAA, the older badge', image: 'data:image/png;base64,BBBB' },
	'badge-3': { name: 'AWS Certified AI Practitioner', image: 'data:image/png;base64,CCCC' },
	'badge-9': { name: 'Mine', image: 'data:image/png;base64,ZZZZ' },
};
const assetList = [
	{ key: 'badge-1', kind: 'badge', status: 'found', pathList: ['/playground/badge/aws/saa/v2'] },
	{ key: 'badge-2', kind: 'badge', status: 'found', pathList: ['/playground/badge/aws/saa/v1'] },
	{ key: 'badge-3', kind: 'badge', status: 'found', pathList: ['/playground/badge/aws/aif/v1'] },
	{ key: 'badge-9', kind: 'badge', status: 'found', pathList: ['/real/badge/aws/saa/v1'] },
	{ key: 'info-1', kind: 'info', status: 'found', pathList: ['/playground/info/name'] },
];
const profile = {
	assetList: (kind) => assetList.filter((asset) => asset.kind === kind),
	assetDataGet: (key) => ({ status: 'done', data: dataByKey[key] }),
};

test('the badges of a partition, by their path below /badge', () => {
	const read = cvBadgeRead(profile, 'playground');
	assert.deepEqual(read.badgeList.map((badge) => badge.path), ['aws/saa/v2', 'aws/saa/v1', 'aws/aif/v1']);
	assert.equal(read.badgeList[0].name, 'AWS Certified Solutions Architect – Associate');
	assert.equal(read.badgeList[0].issuer, 'Amazon Web Services');
	// each partition is its own
	assert.deepEqual(cvBadgeRead(profile, 'real').badgeList.map((badge) => badge.key), ['badge-9']);
	assert.equal(cvBadgePathOf('/playground/badge/aws/saa/v1'), 'aws/saa/v1');
	assert.equal(cvBadgePathOf('/playground/info/name'), '');
	assert.equal(cvBadgePathNormalize('/badge/aws/saa/'), 'aws/saa');
});

test('a path names its badge; a folder names the first badge below it', () => {
	const read = cvBadgeRead(profile, 'playground');
	const exact = cvBadgeResolve(read, 'aws/saa/v1');
	assert.deepEqual([exact.status, exact.badge.key, exact.isDefault], ['found', 'badge-2', false]);
	// the order of the profile decides the default: v2 is listed first
	const folder = cvBadgeResolve(read, '/badge/aws/saa');
	assert.deepEqual([folder.status, folder.badge.key, folder.isDefault], ['found', 'badge-1', true]);
	assert.equal(cvBadgeResolve(read, 'aws').badge.key, 'badge-1');
	assert.equal(cvBadgeResolve(read, 'aws/dva').status, 'unknown');
	assert.equal(cvBadgeResolve(read, '').status, 'unknown');
	// while the data of a badge is on its way, a path nothing answers yet is not unknown
	const loading = cvBadgeRead({ ...profile, assetDataGet: () => ({ status: 'loading' }) }, 'playground');
	assert.equal(cvBadgeResolve(loading, 'aws/saa').status, 'loading');
});

test('a typed path is completed a folder at a time, and a path nothing is at can be made', () => {
	const read = cvBadgeRead(profile, 'playground');
	assert.deepEqual(cvBadgeCompleteListGet(read, '').map((item) => [item.kind, item.path]), [['dir', 'aws']]);
	// inside a folder: the folder itself as a badge (its first), then what is below
	assert.deepEqual(cvBadgeCompleteListGet(read, 'aws/').map((item) => [item.kind, item.path]), [['default', 'aws'], ['dir', 'aws/aif'], ['dir', 'aws/saa']]);
	assert.deepEqual(cvBadgeCompleteListGet(read, 'aws/saa/').map((item) => [item.kind, item.path]), [['default', 'aws/saa'], ['badge', 'aws/saa/v1'], ['badge', 'aws/saa/v2']]);
	assert.deepEqual(cvBadgeCompleteListGet(read, 'aws/s').map((item) => [item.kind, item.path]), [['dir', 'aws/saa']]);
	assert.deepEqual(cvBadgeCompleteListGet(read, 'aws/dva/v1').map((item) => [item.kind, item.path]), [['new', 'aws/dva/v1']]);
	// a text that is no path of a badge offers nothing to make
	assert.deepEqual(cvBadgeCompleteListGet(read, 'aws/d va'), []);
});

test('a new badge: its place, its name, an image of its own until one is given', () => {
	const input = cvBadgeCreateInput('playground', '/badge/aws/dva/v1');
	assert.deepEqual([input.kind, input.partition, input.groupPath, input.name], ['badge', 'playground', 'badge', 'AWS DVA']);
	assert.deepEqual(input.pathList, ['/playground/badge/aws/dva/v1']);
	assert.equal(input.data.name, 'AWS DVA');
	assert.ok(input.data.image.startsWith('data:image/svg+xml'));
	assert.equal(cvBadgeLabelOf('aws/saa'), 'AWS SAA');
	// the stand-in holds the letters of the name and nothing of an issuer's artwork
	assert.ok(decodeURIComponent(cvBadgePlaceholderBuild('AWS SAA')).includes('>SAA<'));
});

test('a badge the profile lists and the store lacks is said', () => {
	const read = cvBadgeRead({
		assetList: (kind) => [{ key: 'b1', kind: 'badge', status: 'deleted', pathList: ['/example/badge/aws/saa/v1'] }].filter((asset) => asset.kind === kind),
		assetDataGet: () => ({ status: 'done', data: {} }),
	}, 'example');
	assert.equal(read.badgeList.length, 0);
	assert.match(read.problemList[0], /^\/example\/badge\/aws\/saa\/v1: listed by the profile, and deleted/);
});

test('how a badge is drawn in one place: any height, and text under it', async () => {
	const { cvBadgeSizeGet, cvBadgeSizeParamGet, cvBadgeCaptionEncode, cvBadgeCaptionDecode, cvBadgeCaptionLineListGet } = await import('./CvBadge.js');
	// a size is a name, or a number of px; the default is larger with text under the badge
	assert.deepEqual([cvBadgeSizeGet('s'), cvBadgeSizeGet('L'), cvBadgeSizeGet('64'), cvBadgeSizeGet(72.4), cvBadgeSizeGet(undefined), cvBadgeSizeGet('odd'), cvBadgeSizeGet(undefined, true)], [18, 46, 64, 72, 30, 30, 60]);
	assert.deepEqual([cvBadgeSizeGet(2), cvBadgeSizeGet(5000)], [10, 300]);
	// written back: the name of a named height, the number of any other, nothing for the default
	assert.deepEqual([cvBadgeSizeParamGet(46), cvBadgeSizeParamGet('64'), cvBadgeSizeParamGet(30), cvBadgeSizeParamGet(60, true), cvBadgeSizeParamGet(30, true)], ['l', '64', undefined, undefined, 'm']);
	// text under it: lines in one parameter, without the marks a parameter cannot hold
	const caption = cvBadgeCaptionEncode(['AWS SAP', ' 2026/01 ~ 2026/04 ', '', 'a,b|c']);
	assert.equal(caption, 'AWS SAP\\n2026/01 ~ 2026/04\\na，b｜c');
	assert.deepEqual(cvBadgeCaptionDecode(caption), ['AWS SAP', '2026/01 ~ 2026/04', 'a，b｜c']);
	// none, the badge's own (its name while it has none), or this place's
	const badge = { name: 'AWS Certified Solutions Architect – Associate', caption: 'AWS SAA\n2023.06' };
	assert.deepEqual(cvBadgeCaptionLineListGet({}, badge), []);
	assert.deepEqual(cvBadgeCaptionLineListGet({ caption: true }, badge), ['AWS SAA', '2023.06']);
	assert.deepEqual(cvBadgeCaptionLineListGet({ caption: true }, { name: 'A badge' }), ['A badge']);
	assert.deepEqual(cvBadgeCaptionLineListGet({ caption }, badge), ['AWS SAP', '2026/01 ~ 2026/04', 'a，b｜c']);
});
