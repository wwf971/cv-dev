import assert from 'node:assert/strict';
import test from 'node:test';
import { cvPaperIsUnder, cvPaperTreeBuild } from './CvJpPaperTree.js';

const assetOf = (key, kind, path, name) => ({ key, kind, name, pathList: [path] });
const tree = cvPaperTreeBuild({
	// the order the object lists them: a template before the papers, a work experience before a CV
	templateList: [assetOf('t1', 'template', '/example/template/cv-jp-standard', '履歴書 標準様式')],
	paperList: [
		assetOf('w1', 'we', '/example/we/general', '職務経歴書（汎用）'),
		assetOf('c1', 'cv', '/example/cv/general', '履歴書（汎用）'),
		assetOf('c2', 'cv', '/playground/cv/try', ''),
	],
	// a part template of the partition example, and one lying where no partition shows
	partList: [assetOf('p1', 'part', '/example/part/wish', ''), assetOf('p2', 'part', '/real/part/x', '')],
	partDataGet: (asset) => ({ p1: { name: '本人希望記入欄', section: { type: 'text', title: '本人希望記入欄', text: '' } }, p2: { section: { type: 'text' } } })[asset.key],
	partitionList: [{ id: 'example', label: 'Example' }, { id: 'real', label: 'Real' }, { id: 'playground', label: 'Playground' }],
});
const pathListOf = (list) => list.map((one) => one.path);

test('the top holds the partitions that hold something, in their own order', () => {
	assert.deepEqual(pathListOf(tree.childListGet('/')), ['/example', '/playground'], 'real holds nothing: no place');
	assert.equal(tree.labelGet('/'), 'Every paper and template');
	assert.equal(tree.labelGet('/example'), 'Example');
	assert.equal(tree.childListGet('/')[0].description, '3 items');
});

test('a partition holds the folders of the forms in their order, then the templates, then its parts', () => {
	assert.deepEqual(pathListOf(tree.childListGet('/example')), ['/example/cv', '/example/we', '/example/template', '/example/part']);
	assert.deepEqual(['/example/cv', '/example/we', '/example/template', '/example/part'].map(tree.labelGet), ['CVs', 'Work experiences', 'Templates', 'Parts']);
});

test('the parts: a gallery of each partition, a place for every part of a form and every part template', () => {
	assert.equal(tree.placeGet('/example/part').kind, 'parts');
	const partList = tree.childListGet('/example/part');
	assert.ok(partList.some((one) => one.path === '/example/part/cv-jp:basic-no-photo' && one.description === 'a part of a CV'));
	assert.ok(partList.some((one) => one.path === '/example/part/we-jp:education'));
	const wish = tree.placeGet('/example/part/wish');
	assert.deepEqual([wish.kind, wish.label, wish.part.source, wish.part.form, wish.part.section.type], ['part', '本人希望記入欄', 'object', 'cv', 'text']);
	assert.equal(tree.isFound('/real/part/x'), false, 'a partition not shown has no parts here');
	const basic = tree.placeGet('/playground/part/cv-jp:basic');
	assert.deepEqual([basic.part.source, basic.part.section], ['form', { type: 'basic' }]);
	assert.match(tree.childListGet('/example').at(-1).description, /^\d+ parts$/);
});

test('a paper is a place named by its name; a template is none', () => {
	assert.equal(tree.placeGet('/example/cv/general').kind, 'paper');
	assert.equal(tree.labelGet('/example/cv/general'), '履歴書（汎用）');
	assert.equal(tree.labelGet('/playground/cv/try'), 'try', 'no name: its last segment');
	assert.equal(tree.isFound('/example/template/cv-jp-standard'), false);
	assert.deepEqual(tree.childListGet('/example/template'), []);
	assert.equal(tree.childListGet('/example/cv')[0].description, '/example/cv/general', 'a paper says its path in a menu');
});

test('what lies under a place', () => {
	assert.equal(cvPaperIsUnder('/example/cv/general', '/'), true);
	assert.equal(cvPaperIsUnder('/example/cv/general', '/example'), true);
	assert.equal(cvPaperIsUnder('/example/cv/general', '/example/cv/general'), true);
	assert.equal(cvPaperIsUnder('/example-2/cv/a', '/example'), false, 'a folder, not a prefix of words');
	assert.equal(cvPaperIsUnder('', '/'), false);
});
