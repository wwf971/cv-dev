import { makeAutoObservable, observable, toJS } from 'mobx';

// Undo and redo of what is changed from a paper (doc/cv-sheet.md#undo-and-redo): its cells, rows,
// sections and name, and the values of the profile written from it. The data of the objects is
// not the text of the document, so the page's history does not hold it; the paper keeps its own,
// and answers the page's undo and redo while the author is at it (react-doc:
// main/doc_page_impl_edit_history.md#a-component-with-changes-of-its-own).
//
//   const history = cvEditHistoryGet(key)    one per key, kept while the page is open: a sheet
//                                            drawn again (another paper and back) keeps its steps
//   history.wrap(service, labelPrefix)       the api of an object (config.objectFrontend, a profile
//                                            from otherGet) whose writes are recorded; labelPrefix
//                                            names what they were made in (a paper) in their label
//   history.stepRun(run)                     what run writes is one step (a badge: its data and its name)
//   await history.undo() / redo()            { code: 0, message }, or undefined: no step to take
//
// A step is its writes, each with the data before and after it. A step is taken back only while
// what it wrote is still there: an item changed since by something else (the profile's own page,
// another tab) is left alone, and the step is dropped with a message. What the undo writes is not
// recorded again: it goes to the api as given, not the recorded one.

const STEP_COUNT_MAX = 200;

const historyByKey = new Map();

export function cvEditHistoryGet(key) {
	let history = historyByKey.get(key);
	if (!history) {
		history = new CvEditHistory();
		historyByKey.set(key, history);
	}
	return history;
}

export class CvEditHistory {
	// the steps, the last one at the end: { label, writeList }
	//   write   { service, op: 'write' | 'create' | 'meta', key, label, before, after, input }
	undoList = [];
	redoList = [];
	// a step being written (stepRun): the writes made meanwhile go into it
	stepOpen = null;
	stepOpenCount = 0;
	// the undo or redo being written, and those asked meanwhile, run one after another
	queue = Promise.resolve();
	// how many steps were taken back or put again: what is open over the data (a cell typed) closes
	appliedCount = 0;
	wrapByService = new WeakMap();

	constructor() {
		makeAutoObservable(this, {
			undoList: observable.shallow,
			redoList: observable.shallow,
			stepOpen: false,
			stepOpenCount: false,
			queue: false,
			wrapByService: false,
		}, { autoBind: true });
	}

	get undoLabel() {
		return this.undoList.at(-1)?.label ?? '';
	}

	get redoLabel() {
		return this.redoList.at(-1)?.label ?? '';
	}

	stepPush(step) {
		this.undoList.push(step);
		if (this.undoList.length > STEP_COUNT_MAX) this.undoList.splice(0, this.undoList.length - STEP_COUNT_MAX);
		this.redoList.splice(0);
	}

	record(write) {
		if (this.stepOpen) {
			this.stepOpen.writeList.push(write);
			return;
		}
		this.stepPush({ label: write.label, writeList: [write] });
	}

	// what run writes is one step; runs overlapping in time share it
	async stepRun(run, label = '') {
		if (this.stepOpenCount === 0) this.stepOpen = { label, writeList: [] };
		this.stepOpenCount += 1;
		try {
			return await run();
		} finally {
			this.stepOpenCount -= 1;
			if (this.stepOpenCount === 0) {
				const step = this.stepOpen;
				this.stepOpen = null;
				if (step.writeList.length > 0) this.stepPush({ label: step.label || step.writeList[0].label, writeList: step.writeList });
			}
		}
	}

	// the same api, its writes recorded (one wrapper per api object and prefix, so that it can be compared)
	wrap(service, labelPrefix = '') {
		if (!service) return service;
		let byPrefix = this.wrapByService.get(service);
		if (!byPrefix) {
			byPrefix = new Map();
			this.wrapByService.set(service, byPrefix);
		}
		const known = byPrefix.get(labelPrefix);
		if (known) return known;
		const history = this;
		const labelOf = (text) => (labelPrefix ? `${labelPrefix}: ${text}` : text);
		const recorded = {
			assetWrite: async (assetRef, textOrData, note) => {
				const key = service.assetGet(assetRef)?.key ?? assetRef;
				const before = dataCopy(dataReadGet(service, key));
				const result = await service.assetWrite(assetRef, textOrData, note);
				if (resultIsDone(result)) {
					history.record({ service, op: 'write', key, label: labelOf(note || key), before, after: dataCopy(dataReadGet(service, key) ?? (typeof textOrData === 'string' ? undefined : textOrData)) });
				}
				return result;
			},
			assetCreate: async (input) => {
				const result = await service.assetCreate(input);
				if (resultIsDone(result) && result?.data?.key) {
					history.record({ service, op: 'create', key: result.data.key, label: labelOf(input.note || input.name || input.pathList?.[0] || 'a new item'), input });
				}
				return result;
			},
			assetMetaSet: async (assetRef, change) => {
				const asset = service.assetGet(assetRef);
				const before = asset ? Object.fromEntries(Object.keys(change).map((field) => [field, asset[field]])) : undefined;
				const result = await service.assetMetaSet(assetRef, change);
				if (resultIsDone(result) && asset) {
					history.record({ service, op: 'meta', key: asset.key, label: labelOf(change.name !== undefined ? `the name ${change.name}` : `how ${asset.name || asset.key} is named`), before, after: { ...change } });
				}
				return result;
			},
		};
		// the api is frozen, so the proxy stands over an empty object and reads everything else from it
		const wrapped = new Proxy({}, {
			get: (target, prop) => (Object.hasOwn(recorded, prop) ? recorded[prop] : Reflect.get(service, prop)),
			has: (target, prop) => prop in service,
		});
		byPrefix.set(labelPrefix, wrapped);
		return wrapped;
	}

	undo() {
		return this.stepQueue('undo');
	}

	redo() {
		return this.stepQueue('redo');
	}

	stepQueue(direction) {
		const run = this.queue.then(() => this.stepApply(direction));
		this.queue = run.catch(() => undefined);
		return run;
	}

	async stepApply(direction) {
		const isUndo = direction === 'undo';
		const list = isUndo ? this.undoList : this.redoList;
		const step = list.at(-1);
		if (!step) return undefined;
		const verb = isUndo ? 'Undone' : 'Redone';
		const writeList = isUndo ? [...step.writeList].reverse() : step.writeList;
		const problem = writeList.map((write) => writeProblemGet(write, direction)).find(Boolean);
		if (problem) {
			this.stepDrop(direction);
			return { code: 0, message: `Not ${verb.toLowerCase()}: ${step.label}. ${problem}` };
		}
		for (const write of writeList) {
			let result;
			try {
				result = await writeApply(write, direction);
			} catch (error) {
				result = { code: -1, message: String(error?.message ?? error) };
			}
			if (!resultIsDone(result)) {
				// a part may be written already: what is there now is not what the step knows
				this.stepDrop(direction);
				return { code: 0, message: `Not ${verb.toLowerCase()}: ${step.label}. ${result?.message ?? 'the write failed'}` };
			}
		}
		this.stepMove(direction, step);
		return { code: 0, message: `${verb}: ${step.label}` };
	}

	stepDrop(direction) {
		(direction === 'undo' ? this.undoList : this.redoList).pop();
	}

	stepMove(direction, step) {
		this.appliedCount += 1;
		if (direction === 'undo') {
			this.undoList.pop();
			this.redoList.push(step);
		} else {
			this.redoList.pop();
			this.undoList.push(step);
		}
	}
}

function resultIsDone(result) {
	return result === undefined || result?.code === 0;
}

// the data of an item as the page holds it now; undefined while it is not read
function dataReadGet(service, key) {
	const read = service.assetDataGet(key);
	return read?.status === 'done' ? read.data : undefined;
}

// a plain copy: what the page holds may be observed (a MobX object), which cannot be cloned as it is
function dataCopy(data) {
	return data === undefined ? undefined : structuredClone(toJS(data));
}

// the same data, whatever the order of the keys of its maps
function dataSameIs(one, other) {
	return textStableGet(one) === textStableGet(other);
}

function textStableGet(value) {
	if (Array.isArray(value)) return `[${value.map(textStableGet).join(',')}]`;
	if (value && typeof value === 'object') return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${textStableGet(value[key])}`).join(',')}}`;
	return JSON.stringify(value ?? null);
}

// why a write of a step cannot be taken back (put again) now: '' when it can
function writeProblemGet(write, direction) {
	const { service, op, key } = write;
	const asset = service.assetGet(key);
	const name = asset?.name || key;
	if (op === 'create') {
		if (direction === 'undo') return asset ? '' : `${name} is not there any more.`;
		return asset ? `${name} is there already.` : '';
	}
	if (!asset) return `${name} is not there any more.`;
	if (op === 'meta') {
		const expected = direction === 'undo' ? write.after : write.before;
		return Object.keys(expected ?? {}).every((field) => dataSameIs(asset[field], expected[field])) ? '' : `${name} was renamed since.`;
	}
	// what it is written back to must be known: an item not read when it was written has nothing to go back to
	if ((direction === 'undo' ? write.before : write.after) === undefined) return `what ${name} held is not known.`;
	const expected = direction === 'undo' ? write.after : write.before;
	if (expected === undefined) return '';
	const now = dataReadGet(service, key);
	if (now === undefined) return `${name} is being read.`;
	return dataSameIs(now, expected) ? '' : `${name} was changed since, elsewhere.`;
}

// one write of a step taken back (put again); what is there after it is what the step knows next
async function writeApply(write, direction) {
	const { service, op, key } = write;
	const isUndo = direction === 'undo';
	const label = `${isUndo ? 'undo' : 'redo'}: ${write.label}`;
	if (op === 'create') {
		if (isUndo) return service.assetRemove(key);
		return service.assetCreate({ ...write.input, key, note: label });
	}
	if (op === 'meta') return service.assetMetaSet(key, isUndo ? write.before : write.after);
	const result = await service.assetWrite(key, (isUndo ? write.before : write.after) ?? {}, label);
	if (resultIsDone(result)) {
		const now = dataCopy(dataReadGet(service, key));
		if (now !== undefined) {
			if (isUndo) write.before = now;
			else write.after = now;
		}
	}
	return result;
}
