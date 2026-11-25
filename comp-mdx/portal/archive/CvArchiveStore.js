import { useState } from 'react';
import { makeAutoObservable, observable } from 'mobx';
import { CV_KIND_TEMPLATE, cvJpFormGet, cvJpIdNew } from '../../jp/CvJpData.js';
import { CV_KIND_ID_INFO, CV_KIND_INFO, cvKindNameOf, cvPartitionListGet, cvPathInPartition, cvPathSplit, cvProfileHoldProblemGet, cvProfileRead } from '../../query/CvProfile.js';
import {
	CV_ARCHIVE_ROOT, CV_KIND_ARRANGE, cvArchiveArrangeDataBuild, cvArchiveArrangeFolderCreate, cvArchiveArrangeFolderRemove, cvArchiveArrangeFolderRename,
	cvArchiveArrangeMove, cvArchiveArrangePartitionOf, cvArchiveArrangePathGet, cvArchiveArrangeRead, cvArchiveBuild, cvArchiveDrawerGet, cvArchiveFolderPathBuild,
	cvArchiveMoveProblemGet, cvArchivePaperPathBuild, cvArchivePathNormalize, cvArchiveSearch,
} from './CvArchiveModel.js';

// The state of a portal of the archive (doc/cv-portal.md#the-state): where the reader is, what
// is found, what is being made. One class for every look: the desk and the archive room hold an
// instance each and draw it, so what a look adds of its own (a camera, a column width) is the
// only state it keeps itself.
//
//   the truth of                 is
//   what the archive holds       the objects (the papers object providing the portal, the profile
//                                it names), read through their apis: archive
//   where the reader is          the address of the portal (config.portal.at): path. go(path)
//                                writes it there, so a place is a link and Back is the browser's
//   whether things are changed   the portal's own edit mode (config.portal.isEditing)
//   the folders                  the item arrange of each partition (doc/cv-portal.md#folders),
//                                written by folderCreate, folderRename, folderRemove, move; what is
//                                written is shown at once and until the write is answered
//   the rest                     this store: the words finding a file, the paper being named, the
//                                folder named in place, what a filing could not do
//
//   service   the api of the papers object (config.objectFrontend of the portal's component)
//   portal    the portal and the page around it (config.portal)
export class CvArchiveStore {
	service = undefined;
	portal = undefined;
	// the words finding a file
	find = '';
	// a paper being made: { drawerId, partition, name, status: idle | submitting | error, message }, or null
	paperNew = null;
	// the api of the profile, by its reference: one object while the reference is the same
	profileServiceByRef = new Map();
	// the folders of a partition as last written here, until the write is answered: { arrange, token }
	arrangePendingByPartition = new Map();
	arrangeToken = 0;
	// what a filing could not do, said until the next one
	arrangeMessage = '';
	// the path of the folder named in place ('' none): a folder just made is
	folderNamingPath = '';
	// what is being dragged (paths of papers and folders), for the places it can be dropped on; and
	// the place under the pointer that takes it
	dragPathList = [];
	dropOverPath = '';

	constructor() {
		makeAutoObservable(this, { service: observable.ref, portal: observable.ref, profileServiceByRef: false, arrangeToken: false });
	}

	// what the portal's component was handed in this render
	bind(service, portal) {
		if (this.service !== service) this.service = service;
		if (this.portal !== portal) this.portal = portal;
	}

	// ---------- what the archive holds ----------

	// the profile the papers read: named by the object (metadata.profile); '' when it names none
	get profileRef() {
		return String(this.service?.object?.metadata?.profile ?? '');
	}

	get profileService() {
		const ref = this.profileRef;
		if (!ref || !this.service) return undefined;
		if (!this.profileServiceByRef.has(ref)) this.profileServiceByRef.set(ref, this.service.otherGet(ref));
		return this.profileServiceByRef.get(ref);
	}

	// why the profile cannot be read ('' when it can, or none is named)
	get profileProblem() {
		const profile = this.profileService;
		if (!profile) return '';
		const object = profile.object;
		if (object.status === 'loading') return '';
		if (object.status !== 'found') return `The profile ${this.profileRef}: ${object.message}`;
		const holdProblem = cvProfileHoldProblemGet(profile);
		return holdProblem ? `The profile ${object.name || object.id} ${holdProblem}.` : '';
	}

	get partitionList() {
		const service = this.service;
		if (!service) return [];
		const profileAssetList = this.profileService && !this.profileProblem ? this.profileService.assetList() : [];
		return cvPartitionListGet(service, [...service.assetList(), ...profileAssetList]).map((one) => ({
			...one,
			description: (service.partitionList ?? []).find((partition) => partition.id === one.id)?.description ?? '',
		}));
	}

	// the subjects of the profile, by partition: the first segment of the path of each value, with
	// how many values it holds
	get profileSubjectList() {
		const profile = this.profileService;
		if (!profile || this.profileProblem || profile.object.status !== 'found') return [];
		const kindName = cvKindNameOf(profile, CV_KIND_ID_INFO, CV_KIND_INFO);
		const assetList = kindName ? profile.assetList(kindName) : [];
		const partitionIdList = [...new Set(assetList.map((asset) => cvPathSplit(asset.pathList?.[0]).partition))];
		const subjectList = [];
		for (const partition of partitionIdList) {
			const read = cvProfileRead(profile, {}, partition);
			const countBySubject = new Map();
			for (const leaf of read.info.leafList) {
				const subject = String(leaf.path).split('/')[0];
				if (subject) countBySubject.set(subject, (countBySubject.get(subject) ?? 0) + 1);
			}
			for (const [subject, valueCount] of countBySubject) subjectList.push({ partition, subject, valueCount, path: cvPathInPartition(partition, `/info/${subject}`) });
		}
		return subjectList;
	}

	get archive() {
		const service = this.service;
		if (!service) return cvArchiveBuild();
		const profile = this.profileService;
		return cvArchiveBuild({
			partitionList: this.partitionList,
			itemList: service.assetList(),
			dataGet: (item) => {
				const read = service.assetDataGet(item.key);
				return read.status === 'done' ? read.data : undefined;
			},
			profile: profile && !this.profileProblem && profile.object.status === 'found'
				? { ref: this.profileRef, label: profile.object.name || 'Profile', subjectList: this.profileSubjectList }
				: undefined,
			arrangeByPartition: this.arrangeByPartition,
		});
	}

	// the item arrange of each partition, by the partition: the first at its path
	get arrangeAssetByPartition() {
		const byPartition = new Map();
		for (const asset of this.service?.assetList(CV_KIND_ARRANGE) ?? []) {
			const partition = cvArchiveArrangePartitionOf(asset.pathList?.[0]);
			if (partition !== undefined && !byPartition.has(partition)) byPartition.set(partition, asset);
		}
		return byPartition;
	}

	// the folders of each partition: what was written here and is not answered yet, else what the item says
	get arrangeByPartition() {
		const byPartition = {};
		for (const [partition, asset] of this.arrangeAssetByPartition) {
			const read = this.service.assetDataGet(asset.key);
			byPartition[partition] = cvArchiveArrangeRead(read.status === 'done' ? read.data : undefined);
		}
		for (const [partition, pending] of this.arrangePendingByPartition) byPartition[partition] = pending.arrange;
		return byPartition;
	}

	// ---------- where the reader is ----------

	// the place the address names
	get path() {
		return cvArchivePathNormalize(this.portal?.at ?? '');
	}

	// the place there, undefined when nothing is (a paper gone, a path mistyped)
	get place() {
		return this.archive.placeGet(this.path);
	}

	// the nearest place that is: the place itself, else the last of the way to it
	get placeShown() {
		return this.place ?? this.ancestorList[this.ancestorList.length - 1];
	}

	get ancestorList() {
		return this.archive.ancestorListGet(this.path);
	}

	// the cabinet, the drawer and the file the reader is in (each undefined above its level)
	get cabinet() {
		return this.ancestorList.find((place) => place.level === 'cabinet');
	}

	get drawer() {
		return this.ancestorList.find((place) => place.level === 'drawer');
	}

	get file() {
		return this.place?.level === 'file' ? this.place : undefined;
	}

	// a place gone to: written into the address, a step of the history (or in place of the last one)
	go(path, { historyMode = 'push' } = {}) {
		this.portal?.atSet(cvArchivePathNormalize(path) === CV_ARCHIVE_ROOT ? '' : cvArchivePathNormalize(path), { historyMode });
	}

	// the place above: a file closed, a folder left, a drawer shut, the cabinet left
	up() {
		const parent = this.archive.parentPathGet(this.placeShown?.path ?? this.path);
		if (parent !== undefined) this.go(parent);
	}

	get isEditing() {
		return this.portal?.isEditing === true;
	}

	// ---------- finding ----------

	findSet(text) {
		this.find = String(text ?? '');
	}

	get findList() {
		return cvArchiveSearch(this.archive, this.find);
	}

	// ---------- folders (doc/cv-portal.md#folders) ----------

	// why the papers cannot be filed here, '' when they can: the page writes, the folders are read
	arrangeProblemGet(partition) {
		const service = this.service;
		if (!service) return 'no papers object';
		if (service.isWritable === false) return service.writeUnavailableReason || 'this page does not write';
		const asset = this.arrangeAssetByPartition.get(partition);
		if (asset && !this.arrangePendingByPartition.has(partition) && service.assetDataGet(asset.key).status !== 'done') return 'the folders are still being read';
		return '';
	}

	// whether things can be put in a place ('' when they can): what a drop target asks while dragging
	moveProblemGet(pathList, parentPath) {
		return cvArchiveMoveProblemGet(this.archive, pathList, parentPath);
	}

	dragSet(pathList) {
		this.dragPathList = [...(pathList ?? [])];
		if (this.dragPathList.length === 0) this.dropOverPath = '';
	}

	dropOverSet(path) {
		if (this.dropOverPath !== path) this.dropOverPath = path;
	}

	// whether what is dragged would go into a place dropped on: a drawer or a folder of its own
	dropIsTaken(parentPath) {
		return this.dragPathList.length > 0 && !this.dragPathList.includes(parentPath) && this.moveProblemGet(this.dragPathList, parentPath) === '';
	}

	// what is dragged dropped on a place: at its end
	async dropOn(parentPath) {
		const pathList = this.dragPathList;
		this.dragSet([]);
		if (pathList.length === 0) return { code: 0 };
		return this.move(pathList, { parentPath });
	}

	// a folder made first in a drawer or a folder (the place shown when not said), named in place
	async folderCreate(parentPath = this.placeShown?.path) {
		const id = cvJpIdNew();
		const place = this.archive.placeGet(parentPath);
		const result = await this.arrangeWrite(place?.partition ?? '', (archive, arrange) => cvArchiveArrangeFolderCreate(archive, arrange, { parentPath, id }), 'a folder made');
		if (result.code === 0 && place) this.folderNamingSet(cvArchiveFolderPathBuild(place.partition, place.drawerId, id));
		return result;
	}

	folderNamingSet(path) {
		this.folderNamingPath = String(path ?? '');
	}

	async folderRename(folderPath, name) {
		const folder = this.archive.placeGet(folderPath);
		this.folderNamingSet('');
		if (!folder || folder.level !== 'folder') return { code: -1, message: 'the folder is gone' };
		if (String(name ?? '').trim() === (folder.meta.isNameDefault ? '' : folder.label)) return { code: 0 };
		return this.arrangeWrite(folder.partition, (archive, arrange) => cvArchiveArrangeFolderRename(arrange, folder.folderId, name), 'a folder renamed');
	}

	// a folder taken away, what it holds left where it stood; the place shown, when it was in it, is its parent
	async folderRemove(folderPath) {
		const folder = this.archive.placeGet(folderPath);
		if (!folder || folder.level !== 'folder') return { code: -1, message: 'the folder is gone' };
		const isShownInside = this.ancestorList.some((place) => place.path === folder.path) && this.place?.level !== 'file';
		const result = await this.arrangeWrite(folder.partition, (archive, arrange) => cvArchiveArrangeFolderRemove(archive, arrange, folder.path), 'a folder taken away');
		if (result.code === 0 && isShownInside) this.go(folder.parentPath, { historyMode: 'replace' });
		return result;
	}

	// papers and folders put in a drawer or a folder, at an index of what it holds without them (its end when not said)
	async move(pathList, { parentPath, index } = {}) {
		const target = this.archive.placeGet(parentPath);
		if (!target) return { code: -1, message: 'the place is gone' };
		return this.arrangeWrite(target.partition, (archive, arrange) => cvArchiveArrangeMove(archive, arrange, pathList, { parentPath, index }), pathList.length === 1 ? 'a paper filed' : 'papers filed');
	}

	// a change of the folders of a partition: shown at once, written to its item (made when there is none)
	async arrangeWrite(partition, change, what) {
		const problem = this.arrangeProblemGet(partition);
		if (problem) return this.arrangeFailed(`Not filed: ${problem}.`);
		const archive = this.archive;
		const result = change(archive, this.arrangeByPartition[partition] ?? cvArchiveArrangeRead(undefined));
		if (result.code !== 0) return this.arrangeFailed(result.message);
		const keyList = archive.fileList.filter((file) => file.partition === partition && file.item).map((file) => file.item.key);
		const data = cvArchiveArrangeDataBuild(result.data, { keyList });
		this.arrangeToken += 1;
		const token = this.arrangeToken;
		this.arrangePendingByPartition.set(partition, { arrange: cvArchiveArrangeRead(data), token });
		this.arrangeMessage = '';
		const service = this.service;
		const asset = this.arrangeAssetByPartition.get(partition);
		const written = asset
			? await service.assetWrite(asset.key, data, `the folders of the archive: ${what}`)
			: await service.assetCreate({ kind: CV_KIND_ARRANGE, name: 'Folders of the archive', pathList: [cvArchiveArrangePathGet(partition)], ...(partition ? { partition } : {}), data });
		this.arrangeWritten(partition, token, written);
		return written?.code === 0 ? { code: 0 } : { code: -1, message: written?.message || 'the folders could not be written' };
	}

	arrangeWritten(partition, token, written) {
		if (this.arrangePendingByPartition.get(partition)?.token === token) this.arrangePendingByPartition.delete(partition);
		if (written?.code !== 0) this.arrangeMessage = `Not filed: ${written?.message || 'the folders could not be written'}`;
	}

	arrangeFailed(message) {
		this.arrangeMessage = message || 'Not filed.';
		return { code: -1, message: this.arrangeMessage };
	}

	arrangeMessageClear() {
		this.arrangeMessage = '';
	}

	// ---------- a new paper ----------

	// the form of a new paper asked for, in a drawer of a cabinet (those of the place shown when not said)
	// folderPath: the folder it is filed in when it is made there (kept while its form and cabinet are those of the folder)
	paperNewOpen({ drawerId, partition, folderPath = '' } = {}) {
		const drawerOf = cvArchiveDrawerGet(drawerId ?? this.drawer?.drawerId);
		this.paperNew = {
			folderPath,
			drawerId: drawerOf?.isCreatable ? drawerOf.id : 'cv',
			partition: partition ?? this.cabinet?.partition ?? this.service?.partitionDefault?.id ?? '',
			name: '',
			status: 'idle',
			message: '',
		};
	}

	paperNewSet(change) {
		if (this.paperNew) this.paperNew = { ...this.paperNew, ...change, status: 'idle', message: '' };
	}

	paperNewClose() {
		this.paperNew = null;
	}

	// where a new paper of the form asked for would lie, and what git does with it: said in the form
	get paperNewPlace() {
		const form = this.paperNew;
		if (!form) return undefined;
		const partition = this.partitionList.find((one) => one.id === form.partition);
		const folder = form.folderPath ? this.archive.placeGet(form.folderPath) : undefined;
		return {
			// the folder it is filed in: while the form and the cabinet are the folder's
			folderLabel: folder && folder.partition === form.partition && folder.drawerId === form.drawerId ? folder.label : '',
			path: cvArchivePaperPathBuild(this.archive, form.partition, form.drawerId, form.name),
			folder: ['item', form.partition, form.drawerId].filter(Boolean).join('/'),
			isGitIgnored: partition?.isGitIgnored === true,
			partitionLabel: partition?.label ?? form.partition,
		};
	}

	// the paper made: it names the template of its form in its partition (written there by the first
	// paper of the form), reads the profile of the object, and is opened
	async paperNewCreate() {
		const form = this.paperNew;
		const service = this.service;
		if (!form || !service || form.status === 'submitting') return;
		const name = form.name.trim();
		const formOfPaper = cvJpFormGet(form.drawerId);
		if (!name) {
			this.paperNew = { ...form, status: 'error', message: `Name the ${formOfPaper.label}.` };
			return;
		}
		this.paperNew = { ...form, status: 'submitting', message: '' };
		const fail = (message) => { this.paperNewFailed(message); };
		const templateList = service.assetList(CV_KIND_TEMPLATE).filter((asset) => String(service.assetDataGet(asset.key).data?.form ?? 'cv') === formOfPaper.kind);
		let templatePath = (templateList.find((asset) => cvPathSplit(asset.pathList?.[0]).partition === form.partition) ?? templateList[0])?.pathList?.[0];
		if (!templatePath) {
			templatePath = cvPathInPartition(form.partition, formOfPaper.templatePath);
			const made = await service.assetCreate({ kind: CV_KIND_TEMPLATE, name: formOfPaper.templateDefault.name, pathList: [templatePath], ...(form.partition ? { partition: form.partition } : {}), data: formOfPaper.templateDefault });
			if (made.code !== 0) return fail(made.message);
		}
		const path = cvArchivePaperPathBuild(this.archive, form.partition, form.drawerId, name);
		const result = await service.assetCreate({
			kind: formOfPaper.kind,
			name,
			pathList: [path],
			...(form.partition ? { partition: form.partition } : {}),
			data: { name, template: templatePath, ...(this.profileRef ? { profile: this.profileRef } : {}) },
		});
		if (result.code !== 0) return fail(result.message);
		this.paperNewClose();
		// made in a folder: filed there, at its end
		const folder = form.folderPath ? this.archive.placeGet(form.folderPath) : undefined;
		if (folder && folder.partition === form.partition && folder.drawerId === form.drawerId && this.archive.isFound(path)) await this.move([path], { parentPath: folder.path });
		this.go(path);
		return undefined;
	}

	paperNewFailed(message) {
		if (this.paperNew) this.paperNew = { ...this.paperNew, status: 'error', message: message || 'the paper could not be made' };
	}
}

// the store of the portal a component draws: one for the life of its mount, told what the
// component was handed at every render
export function useCvArchive(config = {}) {
	const [store] = useState(() => new CvArchiveStore());
	store.bind(config.objectFrontend, config.portal);
	return store;
}
