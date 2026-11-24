import assert from 'node:assert/strict';
import test from 'node:test';
import { cvAssetStatusText, cvInfoCreateInput, cvKindNameOf, cvProfileHoldProblemGet, cvProfileRead, CV_KIND_ID_INFO } from './CvProfile.js';
import { cvQueryResolve } from './CvQuery.js';

// a profile as the api of a mode (or otherGet) gives it
function profileOf(assetList, dataByKey) {
	return {
		partitionList: [{ id: 'example' }],
		assetList: (kind) => assetList.filter((asset) => kind === undefined || asset.kind === kind),
		assetDataGet: (key) => ({ status: 'done', data: dataByKey[key] }),
	};
}

test('an item the profile lists and the store lacks is said, not dropped in silence', () => {
	const profile = profileOf([
		{ key: 'name', kind: 'info', status: 'found', pathList: ['/example/info/name'] },
		{ key: 'birth', kind: 'info', status: 'missing', pathList: ['/example/info/birth'] },
		{ key: 'edu', kind: 'info', status: 'deleted', pathList: ['/example/info/edu'] },
		{ key: 'other', kind: 'info', status: 'missing', pathList: ['/real/info/x'] },
	], { name: { '{jp/first/}': { kanji: '太郎' } } });
	const read = cvProfileRead(profile, {}, 'example');
	assert.equal(read.countAll, 1);
	assert.deepEqual(read.problemList, [
		`/example/info/birth: ${cvAssetStatusText('missing')}, its values are not read`,
		`/example/info/edu: ${cvAssetStatusText('deleted')}, its values are not read`,
	]);
	assert.equal(cvQueryResolve(read.info, 'name/first/jp').value, '太郎');
});

test('a profile is any object whose type holds the kind cv.profile.info, read by the name it holds it under', () => {
	// a type saying nothing of its kinds holds anything: the name of a cv.profile
	assert.equal(cvKindNameOf({}, CV_KIND_ID_INFO, 'info'), 'info');
	// another type holding the kind under a name of its own: read, and written, under that name
	const other = profileOf([
		{ key: 'fact-1', kind: 'fact', status: 'found', pathList: ['/example/info/name'] },
		{ key: 'note-1', kind: 'note', status: 'found', pathList: ['/example/info/x'] },
	], { 'fact-1': { '{jp/first/}': { kanji: '花子' } }, 'note-1': { first: 'not information' } });
	other.kindList = [{ id: 'fact', kindId: CV_KIND_ID_INFO }, { id: 'note', kindId: 'other.box.note' }];
	other.object = { typeId: 'other.box' };
	assert.equal(cvKindNameOf(other, CV_KIND_ID_INFO, 'info'), 'fact');
	assert.equal(cvProfileHoldProblemGet(other), '');
	assert.equal(cvQueryResolve(cvProfileRead(other, {}, 'example').info, 'name/first/jp').value, '花子');
	assert.equal(cvInfoCreateInput('example', { pathNew: '/info/birth' }, {}, cvKindNameOf(other, CV_KIND_ID_INFO, 'info')).kind, 'fact');
	// a type holding no such kind: nothing is read, and why
	const cvObject = profileOf([{ key: 'instance-1', kind: 'instance', status: 'found', pathList: ['/example/instance/a'] }], {});
	cvObject.kindList = [{ id: 'template', kindId: 'cv.jp.template' }, { id: 'instance', kindId: 'cv.jp.instance' }];
	cvObject.object = { typeId: 'cv.jp' };
	assert.equal(cvProfileHoldProblemGet(cvObject), 'holds no item of the kind cv.profile.info (its type cv.jp holds template, instance)');
	assert.equal(cvProfileRead(cvObject, {}, 'example').countAll, 0);
});
