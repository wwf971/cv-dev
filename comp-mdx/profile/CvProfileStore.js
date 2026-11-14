import { makeAutoObservable } from 'mobx';
import { cvInfoCreateInput, cvLeafQueryGet, cvPathInPartition, cvPathSplit, CV_KIND_INFO } from '../query/CvProfile.js';
import { cvDataRemove, cvDataSet, cvLeafPlaceGet, cvLeafValueBuild } from '../query/CvQuery.js';
import { CV_KIND_BADGE, cvBadgeCreateInput, cvBadgePathIsValid, cvBadgePathNormalize } from '../query/CvBadge.js';
import { cvInfoDraftPathGet } from '../query/CvInfoTree.js';

// What the mode Information of a profile shows and what it is doing (CvProfileInfo.jsx): the
// partition, the tab and the view chosen, the path walked, the folders of the tree opened, the
// words typed to find a value, a value or a badge being added, and the writes into the profile.
// It is the block's, not the mount's (useCompStateStore): the document entering or leaving edit
// mode mounts the panel again, and it is found as it was left.
export const CV_PROFILE_TAB_INFO = 'info';
export const CV_PROFILE_TAB_BADGE = 'badge';
// how the values are drawn: walked as a file explorer walks folders, or as a tree
export const CV_PROFILE_VIEW_EXPLORE = 'explorer';
export const CV_PROFILE_VIEW_TREE = 'tree';
export const CV_PROFILE_VIEW_LIST = [
	{ id: CV_PROFILE_VIEW_EXPLORE, label: 'Explorer', title: 'A path and what lies next to it: segments in any order are one item' },
	{ id: CV_PROFILE_VIEW_TREE, label: 'Tree', title: 'Every level under the one above it, by the canonical paths' },
];

export class CvProfileStore {
	partition = null;
	tab = CV_PROFILE_TAB_INFO;
	// the view chosen; null: the one the document names (param.view), else the explorer
	view = null;
	// the words typed to find a value, or a query to try
	find = '';
	// the explorer: the path walked, a segment an element, in the order it was walked
	pathList = [];
	// the tree: the folders opened, { 'name/jp': true }
	isOpenByPath = {};
	// a value being added: { pathParent, name, value }, typed in the first row of its folder
	draft = null;
	// a badge being added: { path }
	badgeDraft = null;
	// how far the list is scrolled: put back when the panel is mounted again
	scrollTop = 0;
	// what was just copied (the id of its row), shown for a moment
	copiedId = '';
	status = 'idle';
	message = '';

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true });
	}

	get isSubmitting() {
		return this.status === 'submitting';
	}

	partitionSet(partition) {
		this.partition = partition;
		this.pathList = [];
		this.draft = null;
		this.badgeDraft = null;
		this.message = '';
	}

	tabSet(tab) {
		this.tab = tab;
		this.message = '';
	}

	findSet(text) {
		this.find = text;
	}

	viewSet(view) {
		this.view = view;
		this.draft = null;
		this.message = '';
	}

	// ---------- the explorer ----------

	// the path walked: forward by a segment or several, back to a folder above, to a value found
	// (which also ends the finding: the folder is shown, not what was found)
	pathSet(segmentList, { isFindEnded = false } = {}) {
		this.pathList = [...segmentList];
		this.draft = null;
		this.message = '';
		if (isFindEnded) this.find = '';
	}

	messageSet(text) {
		this.message = String(text ?? '');
	}

	scrollTopSet(scrollTop) {
		this.scrollTop = scrollTop;
	}

	// ---------- the tree ----------

	folderToggle(path) {
		this.isOpenByPath = { ...this.isOpenByPath, [path]: !this.isOpenByPath[path] };
	}

	// every folder opened, or every one closed
	folderAllSet(pathList, isOpen) {
		this.isOpenByPath = isOpen ? Object.fromEntries(pathList.map((path) => [path, true])) : {};
	}

	// a folder and those above it opened: so that what was just added in it is seen
	folderReveal(path) {
		const segmentList = String(path ?? '').split('/').filter(Boolean);
		const isOpenByPath = { ...this.isOpenByPath };
		for (let at = 1; at <= segmentList.length; at += 1) isOpenByPath[segmentList.slice(0, at).join('/')] = true;
		this.isOpenByPath = isOpenByPath;
	}

	// what was copied, said for a moment where it was copied from
	async copy(id, text) {
		try {
			await navigator.clipboard.writeText(text);
			this.copiedIdSet(id);
			setTimeout(() => {
				if (this.copiedId === id) this.copiedIdSet('');
			}, 1200);
		} catch {
			this.messageSet('The browser did not allow copying.');
		}
	}

	copiedIdSet(id) {
		this.copiedId = id;
	}

	// ---------- a value added ----------

	// pathParent: the folder it is typed in ('' the top)
	draftOpen(pathParent = '') {
		this.draft = { pathParent, name: '', value: '' };
		this.message = '';
	}

	draftSet(change) {
		if (!this.draft) return;
		this.draft = { ...this.draft, ...change };
		this.message = '';
	}

	draftClose() {
		this.draft = null;
		this.message = '';
	}

	async leafAdd(service, info, partition) {
		if (!this.draft) return;
		const path = cvInfoDraftPathGet(this.draft.pathParent, this.draft.name);
		const place = String(this.draft.name).trim() === '' ? undefined : cvLeafPlaceGet(info, path);
		if (!place) {
			this.status = 'error';
			this.message = this.draft.pathParent ? 'Name the value: floor, or several levels, jp/floor.' : 'Name the path of the value: address/jp/postal.';
			return;
		}
		// the path of a value there already: its own row changes it
		if (place.assetKey && info.leafList.some((leaf) => leaf.assetKey === place.assetKey && leaf.keyPath.join('\n') === place.keyPath.join('\n'))) {
			this.status = 'error';
			this.message = `${path} already holds a value: change it in its row.`;
			return;
		}
		const value = this.draft.value;
		const isDone = await this.writeRun(() => {
			if (place.assetKey) {
				const data = service.assetDataGet(place.assetKey).data;
				return service.assetWrite(place.assetKey, cvDataSet(data, place.keyPath, value), path);
			}
			return service.assetCreate(cvInfoCreateInput(partition, place, place.keyPath.length > 0 ? cvDataSet({}, place.keyPath, value) : value));
		});
		if (!isDone) return;
		this.draftClose();
		this.folderReveal(path.split('/').slice(0, -1).join('/'));
	}

	leafSet(service, leaf, text) {
		const data = service.assetDataGet(leaf.assetKey).data;
		return this.writeRun(() => service.assetWrite(leaf.assetKey, cvDataSet(data, leaf.keyPath, cvLeafValueBuild(text, leaf.isList)), cvLeafQueryGet(leaf)));
	}

	leafRemove(service, leaf) {
		const data = service.assetDataGet(leaf.assetKey).data;
		return this.writeRun(() => service.assetWrite(leaf.assetKey, cvDataRemove(data, leaf.keyPath), `${cvLeafQueryGet(leaf)} removed`));
	}

	// ---------- the badges ----------

	badgeDraftOpen() {
		this.badgeDraft = { path: '' };
		this.message = '';
	}

	badgeDraftSet(change) {
		if (!this.badgeDraft) return;
		this.badgeDraft = { ...this.badgeDraft, ...change };
		this.message = '';
	}

	badgeDraftClose() {
		this.badgeDraft = null;
		this.message = '';
	}

	// a badge at the path typed, with the image given, or a stand-in until one is
	async badgeAdd(service, partition, image) {
		const path = cvBadgePathNormalize(this.badgeDraft?.path);
		if (!cvBadgePathIsValid(path)) {
			this.status = 'error';
			this.message = 'Name the path of the badge: aws/saa/v1.';
			return;
		}
		const isDone = await this.writeRun(() => service.assetCreate(cvBadgeCreateInput(partition, path, image ? { image } : {})));
		if (isDone) this.badgeDraftClose();
	}

	badgeWrite(service, badge, change) {
		return this.writeRun(async () => {
			const result = await service.assetWrite(badge.key, { ...badge.data, ...change }, `the badge ${badge.path}`);
			if (result?.code === 0 && change.name !== undefined && change.name !== badge.name) await service.assetMetaSet(badge.key, { name: change.name });
			return result;
		});
	}

	badgeRemove(service, badge) {
		return this.writeRun(() => service.assetRemove(badge.key));
	}

	// ---------- a partition ----------

	// every value and badge of one partition copied into another one that holds nothing yet: how a
	// playground starts from the example. each item keeps its path, under the other partition
	async partitionCopy(service, partitionFrom, partitionTo) {
		const assetList = [...service.assetList(CV_KIND_INFO), ...service.assetList(CV_KIND_BADGE)]
			.filter((asset) => asset.status === 'found' && cvPathSplit(asset.pathList?.[0]).partition === partitionFrom);
		const sourceList = assetList.map((asset) => ({ asset, read: service.assetDataGet(asset.key) }));
		if (sourceList.some((one) => one.read.status !== 'done')) {
			this.status = 'error';
			this.message = 'The partition is still being read; try again in a moment.';
			return;
		}
		await this.writeRun(async () => {
			for (const { asset, read } of sourceList) {
				const result = await service.assetCreate({
					kind: asset.kind,
					...(asset.name ? { name: asset.name } : {}),
					pathList: (asset.pathList ?? []).map((path) => cvPathInPartition(partitionTo, cvPathSplit(path).pathInPartition)),
					partition: partitionTo,
					...(asset.kind === CV_KIND_BADGE ? { groupPath: 'badge' } : {}),
					data: read.data,
				});
				if (result?.code !== 0) return result;
			}
			return { code: 0 };
		});
	}

	async writeRun(write) {
		this.status = 'submitting';
		let result;
		try {
			result = await write();
		} catch (error) {
			result = { code: -1, message: String(error?.message ?? error) };
		}
		this.resultSet(result);
		return result?.code === 0;
	}

	resultSet(result) {
		this.status = result?.code === 0 ? 'idle' : 'error';
		this.message = result?.code === 0 ? '' : result?.message ?? 'the write failed';
	}
}
