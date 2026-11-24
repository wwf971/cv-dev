import assert from 'node:assert/strict';
import test from 'node:test';
import { CvEditHistory } from './cv-edit-history.js';

// a stand-in of the api of an object: items by key, their data and their names
function serviceFake(dataByKey) {
	const assetByKey = new Map(Object.entries(dataByKey).map(([key, data]) => [key, { key, name: key, data }]));
	return {
		callList: [],
		get isEditable() { return true; },
		assetGet: (ref) => assetByKey.get(ref),
		assetDataGet: (key) => (assetByKey.has(key) ? { status: 'done', data: assetByKey.get(key).data } : { status: 'error' }),
		async assetWrite(key, data, note) {
			this.callList.push(['write', key, note]);
			assetByKey.get(key).data = structuredClone(data);
			return { code: 0 };
		},
		async assetCreate(input) {
			const key = input.key ?? `new${assetByKey.size}`;
			assetByKey.set(key, { key, name: input.name ?? key, data: input.data });
			return { code: 0, data: { key } };
		},
		async assetRemove(key) {
			assetByKey.delete(key);
			return { code: 0 };
		},
		async assetMetaSet(key, change) {
			Object.assign(assetByKey.get(key), change);
			return { code: 0 };
		},
	};
}

test('a write is taken back and put again; the redo is lost by a new write', async () => {
	const history = new CvEditHistory();
	// frozen, as the api of an object is
	const service = Object.freeze(serviceFake({ paper: { valueByCell: { a: 'one' } } }));
	const recorded = history.wrap(service);
	assert.equal(history.wrap(service), recorded, 'one wrapper per api');
	assert.equal(recorded.isEditable, true, 'what is not written is read from the api');
	await recorded.assetWrite('paper', { valueByCell: { a: 'two' } }, 'the cell a');
	assert.equal(history.undoLabel, 'the cell a');
	assert.deepEqual(await history.undo(), { code: 0, message: 'Undone: the cell a' });
	assert.deepEqual(service.assetDataGet('paper').data, { valueByCell: { a: 'one' } });
	assert.equal(history.redoLabel, 'the cell a');
	await history.redo();
	assert.deepEqual(service.assetDataGet('paper').data, { valueByCell: { a: 'two' } });
	await history.undo();
	await recorded.assetWrite('paper', { valueByCell: { a: 'three' } }, 'the cell a again');
	assert.equal(history.redoLabel, '', 'a new step forgets what was undone');
	assert.equal(await history.redo(), undefined, 'nothing to redo: the page undoes its document');
	assert.equal(service.callList.at(-2)[2], 'undo: the cell a', 'the undo is written through the api as given, not recorded');
});

test('writes made in one run are one step, taken back last first', async () => {
	const history = new CvEditHistory();
	const service = serviceFake({ badge: { image: 'a.png' } });
	const recorded = history.wrap(service);
	await history.stepRun(async () => {
		await recorded.assetWrite('badge', { image: 'a.png', name: 'AWS' }, 'the badge aws');
		await recorded.assetMetaSet('badge', { name: 'AWS' });
	});
	assert.equal(history.undoList.length, 1);
	await history.undo();
	assert.equal(service.assetGet('badge').name, 'badge');
	assert.deepEqual(service.assetDataGet('badge').data, { image: 'a.png' });
});

test('an item made is removed by the undo and made again by the redo', async () => {
	const history = new CvEditHistory();
	const service = serviceFake({});
	const recorded = history.wrap(service);
	await recorded.assetCreate({ name: 'postal', data: { postal: '100-0001' } });
	await history.undo();
	assert.equal(service.assetGet('new0'), undefined);
	await history.redo();
	assert.deepEqual(service.assetDataGet('new0').data, { postal: '100-0001' }, 'under the same key');
});

test('a step whose item was changed since by something else is left alone and dropped', async () => {
	const history = new CvEditHistory();
	const service = serviceFake({ profile: { name: 'A' } });
	await history.wrap(service).assetWrite('profile', { name: 'B' }, 'the name');
	await service.assetWrite('profile', { name: 'C' }, 'the profile page');
	const result = await history.undo();
	assert.equal(result.code, 0, 'answered: the page does not undo its document instead');
	assert.match(result.message, /^Not undone: the name\. profile was changed since/);
	assert.deepEqual(service.assetDataGet('profile').data, { name: 'C' });
	assert.equal(history.undoList.length, 0);
});

test('the order of the keys of a map is no change', async () => {
	const history = new CvEditHistory();
	const service = serviceFake({ paper: { a: 1, b: 2 } });
	await history.wrap(service).assetWrite('paper', { a: 1, b: 3 }, 'b');
	service.assetGet('paper').data = { b: 3, a: 1 };
	assert.deepEqual(await history.undo(), { code: 0, message: 'Undone: b' });
});
