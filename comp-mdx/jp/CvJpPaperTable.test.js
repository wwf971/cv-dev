import assert from 'node:assert/strict';
import test from 'node:test';
import {
	CV_PAPER_COLUMN_LIST, cvPaperColumnShownList, cvPaperNameMatches, cvPaperRowListBuild, cvPaperViewColumnMove, cvPaperViewColumnShownSet,
	cvPaperViewDataBuild, cvPaperViewDefaultGet, cvPaperViewIsSame, cvPaperViewRead, cvPaperViewShownOrderSet, cvPaperViewWidthSet,
} from './CvJpPaperTable.js';

const idListOf = (list) => list.map((one) => one.id);

test('the default view: every column but form and partition, wrapped', () => {
	const view = cvPaperViewDefaultGet();
	assert.equal(view.lineMode, 'wrap');
	assert.deepEqual(idListOf(cvPaperColumnShownList(view)), ['name', 'path', 'template', 'profile', 'asOf']);
	assert.deepEqual(cvPaperViewRead(undefined).view, view, 'no item kept: the default');
});

test('a view kept is read defensively', () => {
	const { view, problemList } = cvPaperViewRead({
		lineMode: 'line',
		columnList: [{ id: 'asOf', width: 10 }, { id: 'nowhere' }, 'path', { id: 'path' }, { id: 'name', isHidden: true }, { id: 'form', width: 99.6 }],
	});
	assert.equal(view.lineMode, 'line');
	assert.deepEqual(idListOf(view.columnList), ['asOf', 'path', 'name', 'form', 'template', 'profile', 'partition'], 'its order, then the columns it does not name');
	assert.equal(view.columnList[0].width, 80, 'raised to the least width of its column');
	assert.equal(view.columnList[3].width, 100);
	assert.equal(view.columnList[2].isHidden, undefined, 'name is always shown');
	assert.equal(view.columnList.find((one) => one.id === 'partition').isHidden, true, 'a column it does not name: as by default');
	assert.deepEqual(problemList, ['the column "nowhere" is no column of the table', 'the column path is named twice']);
	assert.equal(cvPaperViewRead({ lineMode: 'tall' }).problemList.length, 1);
	assert.deepEqual(cvPaperViewRead('x').view, cvPaperViewDefaultGet());
});

test('changes of a view', () => {
	const view = cvPaperViewDefaultGet();
	const shown = cvPaperViewColumnShownSet(view, 'partition', true);
	assert.deepEqual(idListOf(cvPaperColumnShownList(shown)).slice(-1), ['partition']);
	assert.equal(cvPaperViewColumnShownSet(view, 'name', false), view, 'name cannot be hidden');
	const moved = cvPaperViewColumnMove(view, 'asOf', -1);
	assert.deepEqual(idListOf(moved.columnList).slice(3, 6), ['template', 'asOf', 'profile']);
	assert.equal(cvPaperViewColumnMove(view, 'name', -1), view, 'nothing before the first');
	// the header dragged: profile before path; form and partition, hidden, keep their places
	const ordered = cvPaperViewShownOrderSet(view, ['name', 'profile', 'path', 'template', 'asOf']);
	assert.deepEqual(idListOf(ordered.columnList), ['name', 'profile', 'form', 'path', 'template', 'asOf', 'partition']);
	const wide = cvPaperViewWidthSet(view, { path: 300.4, name: 5 });
	assert.deepEqual([wide.columnList[0].width, wide.columnList[1].width], [90, 300]);
	assert.equal(cvPaperViewIsSame(view, cvPaperViewRead(cvPaperViewDataBuild(view)).view), true, 'what is written reads back the same');
	assert.equal(cvPaperViewIsSame(view, wide), false);
	assert.equal(CV_PAPER_COLUMN_LIST.length, view.columnList.length);
});

const assetOf = (key, kind, path, name) => ({ key, kind, name, pathList: [path] });
const paperList = [
	assetOf('c1', 'cv', '/example/cv/general', '履歴書（汎用）'),
	assetOf('c2', 'cv', '/example/cv/foreign-affiliated', '履歴書（外資系企業向け）'),
	assetOf('w1', 'we', '/example/we/general', '職務経歴書（汎用）'),
	assetOf('c3', 'cv', '/playground/cv/try', 'Try out'),
];
const templateList = [assetOf('t1', 'template', '/example/template/cv-jp-standard', '履歴書 標準様式')];

test('the rows of a place: a heading row per part, then its items', () => {
	const rowList = cvPaperRowListBuild({ paperList, templateList, place: { kind: 'partition', path: '/example' } });
	assert.deepEqual(idListOf(rowList), ['part:cv', 'asset:c1', 'asset:c2', 'part:we', 'asset:w1', 'part:template', 'asset:t1']);
	assert.deepEqual(rowList[0].part, { id: 'cv', title: 'CVs', count: 2, countAll: 2, emptyText: 'No CV yet.' });
	const playground = cvPaperRowListBuild({ paperList, templateList, place: { kind: 'partition', path: '/playground' } });
	assert.deepEqual(idListOf(playground), ['part:cv', 'asset:c3', 'part:we', 'empty:we', 'part:template', 'empty:template'], 'a partition shows every part, an empty one saying so');
	const folder = cvPaperRowListBuild({ paperList, templateList, place: { kind: 'folder', path: '/example/we' } });
	assert.deepEqual(idListOf(folder), ['part:we', 'asset:w1'], 'a folder only what it holds');
});

test('finding by name: every word in the name; only the parts holding a match', () => {
	assert.equal(cvPaperNameMatches('履歴書（外資系企業向け）', '外資 履歴書'), true);
	assert.equal(cvPaperNameMatches('Try out', 'TRY'), true);
	assert.equal(cvPaperNameMatches('Try out', 'try in'), false);
	const rowList = cvPaperRowListBuild({ paperList, templateList, place: { kind: 'root', path: '/' }, find: '汎用' });
	assert.deepEqual(idListOf(rowList), ['part:cv', 'asset:c1', 'part:we', 'asset:w1']);
	assert.deepEqual([rowList[0].part.count, rowList[0].part.countAll], [1, 3]);
	assert.deepEqual(cvPaperRowListBuild({ paperList, templateList, place: { kind: 'root', path: '/' }, find: 'nothing' }), []);
});
