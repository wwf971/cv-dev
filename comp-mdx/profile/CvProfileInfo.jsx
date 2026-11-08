import { useId, useState } from 'react';
import { makeAutoObservable } from 'mobx';
import { observer } from 'mobx-react-lite';
import { Plus, Trash2 } from 'lucide-react';
import { EditValueInline } from '@wwf971/react-doc';
import { CV_PARTITION_EXAMPLE, cvInfoCreateInput, cvLeafPatternGet, cvLeafQueryGet, cvPartitionListGet, cvPartitionTitleGet, cvPathSplit, cvProfileRead, CV_KIND_INFO } from '../query/CvProfile.js';
import { cvDataRemove, cvDataSet, cvLeafPlaceGet, cvLeafValueBuild, cvQueryComplete, cvQueryResolve } from '../query/CvQuery.js';
import '../jp/CvJp.css';

// The personal information of a profile, a mode of its frontend object (doc/cv-query.md): every
// value with its path pattern, edited in place; a query to try, with completion; a new
// value at the place a path names. Its data items are of the kind "info", one per subject, in
// partitions (doc/README.md#partitions): one is shown at a time, param.partition first, and a new
// value goes into it, as the form says.
class CvProfileStore {
	partition = null;
	query = 'name/first/jp/katakana';
	pathNew = '';
	valueNew = '';
	status = 'idle';
	message = '';

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true });
	}

	partitionSet(partition) {
		this.partition = partition;
	}

	querySet(text) {
		this.query = text;
	}

	pathNewSet(text) {
		this.pathNew = text;
		this.message = '';
	}

	valueNewSet(text) {
		this.valueNew = text;
	}

	async writeRun(write) {
		this.status = 'submitting';
		const result = await write();
		this.status = result?.code === 0 ? 'idle' : 'error';
		this.message = result?.code === 0 ? '' : result?.message ?? 'the write failed';
		return result?.code === 0;
	}

	leafSet(service, leaf, text) {
		const data = service.assetDataGet(leaf.assetKey).data;
		return this.writeRun(() => service.assetWrite(leaf.assetKey, cvDataSet(data, leaf.keyPath, cvLeafValueBuild(text, leaf.isList)), cvLeafQueryGet(leaf)));
	}

	leafRemove(service, leaf) {
		const data = service.assetDataGet(leaf.assetKey).data;
		return this.writeRun(() => service.assetWrite(leaf.assetKey, cvDataRemove(data, leaf.keyPath), `${cvLeafQueryGet(leaf)} removed`));
	}

	async leafAdd(service, info, partition) {
		const place = cvLeafPlaceGet(info, this.pathNew);
		if (!place) {
			this.status = 'error';
			this.message = 'Name a path, name/jp/first.';
			return;
		}
		const value = this.valueNew;
		const isDone = await this.writeRun(() => {
			if (place.assetKey) {
				const data = service.assetDataGet(place.assetKey).data;
				return service.assetWrite(place.assetKey, cvDataSet(data, place.keyPath, value), this.pathNew);
			}
			return service.assetCreate(cvInfoCreateInput(partition, place, place.keyPath.length > 0 ? cvDataSet({}, place.keyPath, value) : value));
		});
		if (isDone) {
			this.pathNew = '';
			this.valueNew = '';
		}
	}
}

export const CvProfileInfo = observer(function CvProfileInfo({ data = {}, config = {} }) {
	const service = config.objectFrontend;
	const [store] = useState(() => new CvProfileStore());
	const partitionSelectId = useId();
	if (!service) return <p className="doc-error">CvProfileInfo is a mode of a frontend object (ObjectFrontend).</p>;
	const infoAssetList = service.assetList(CV_KIND_INFO);
	const partitionList = cvPartitionListGet(service, infoAssetList);
	const partitionFound = infoAssetList.map((asset) => cvPathSplit(asset.pathList?.[0]).partition);
	const partitionId = store.partition ?? data.param?.partition ?? (partitionFound.includes(CV_PARTITION_EXAMPLE) ? CV_PARTITION_EXAMPLE : partitionFound[0] ?? CV_PARTITION_EXAMPLE);
	const partition = partitionList.find((one) => one.id === partitionId);
	const read = cvProfileRead(service, {}, partitionId);
	if (read.countLoading > 0) return <p className="doc-note">Reading the information ({read.countAll - read.countLoading} of {read.countAll})…</p>;
	const { info } = read;
	const resolved = cvQueryResolve(info, store.query);
	const complete = cvQueryComplete(info, store.query, 8);
	// values are edited, removed and added while the document is edited; in reading mode they
	// read as text (react-doc: main/doc_page_impl_obj_frontend.md#reading-and-editing)
	const isEditShown = service.docState?.isEditing === true;
	const isLocked = !service.isEditable;
	const isImage = (value) => value.startsWith('data:image/');
	return (
		<div className="doc-cv-list not-prose">
			<div className="doc-cv-list-form">
				<label className="doc-cv-list-muted" htmlFor={partitionSelectId}>Partition</label>
				<select id={partitionSelectId} value={partitionId} onChange={(event) => store.partitionSet(event.target.value)}>
					{partitionList.map((one) => <option key={one.id} value={one.id}>{one.label}</option>)}
				</select>
				<span className="doc-cv-list-muted">{cvPartitionTitleGet(partition, 'Its data lies')}</span>
			</div>
			<h4>Try a query</h4>
			<div className="doc-cv-list-form">
				<input aria-label="A query path" value={store.query} placeholder="name/jp/first" onChange={(event) => store.querySet(event.target.value)} />
			</div>
			<div className="doc-cv-jp-editor-tag-list">
				{complete.segmentList.map(({ segment }) => (
					<button key={segment} type="button" className="doc-badge-outline doc-cv-jp-editor-tag" onClick={() => {
						const segmentList = store.query.split('/');
						segmentList[segmentList.length - 1] = segment;
						store.querySet(`${segmentList.join('/')}/`);
					}}>{segment}</button>
				))}
			</div>
			<p className="doc-cv-list-result" data-status={resolved.status}>
				{resolved.status === 'found'
					? <>{isImage(resolved.value) ? '(image)' : resolved.value} <span className="doc-cv-list-muted">· {resolved.by}{resolved.alternativeList.length > 0 ? ` · also: ${resolved.alternativeList.map((leaf) => cvLeafQueryGet(leaf)).join(', ')}` : ''}</span></>
					: <span className="doc-cv-list-muted">{resolved.message}</span>}
			</p>
			<h4>The information ({info.leafList.length})</h4>
			{(read.problemList).map((problem) => <p key={problem} className="doc-error">{problem}</p>)}
			<table>
				<thead><tr><th title="The path pattern of the value: the members of a group {…} come in any order">path</th><th>value</th><th aria-label="Actions" /></tr></thead>
				<tbody>
					{info.leafList.map((leaf) => (
						<tr key={`${leaf.assetKey}:${leaf.keyPath.join('.')}`}>
							<td className="doc-cv-list-path">{cvLeafPatternGet(leaf)}</td>
							<td className="doc-cv-list-value">
								{isImage(leaf.value)
									? <img className="doc-cv-list-thumb" src={leaf.value} alt="" />
									: !isEditShown ? <span className="doc-cv-list-text">{leaf.value}</span>
									: <EditValueInline value={leaf.value} placeholder="(empty)" isLocked={isLocked} title={isLocked ? service.editUnavailableReason : undefined} newlineAs={leaf.isList || leaf.value.includes('\n') ? '\n' : ' '} onCommit={(value) => store.leafSet(service, leaf, value)} />}
							</td>
							<td>
								{!isEditShown ? null : <button type="button" className="doc-button" title={isLocked ? service.editUnavailableReason : 'Remove this value'} aria-label="Remove this value" disabled={isLocked} onClick={() => store.leafRemove(service, leaf)}><Trash2 size={12} aria-hidden="true" /></button>}
							</td>
						</tr>
					))}
				</tbody>
			</table>
			{!isEditShown ? null : (
				<div className="doc-cv-list-form">
					<input aria-label="The path of a new value" placeholder="A path: address/jp/postal" value={store.pathNew} onChange={(event) => store.pathNewSet(event.target.value)} />
					<input aria-label="The new value" placeholder="Its value" value={store.valueNew} onChange={(event) => store.valueNewSet(event.target.value)} />
					<button type="button" className="doc-button" disabled={store.status === 'submitting' || isLocked} title={isLocked ? service.editUnavailableReason : 'Add the value'} onClick={() => store.leafAdd(service, info, partitionId)}><Plus size={12} aria-hidden="true" /><span>Add</span></button>
					{store.message ? <span className="doc-error" role="alert">{store.message}</span> : null}
				</div>
			)}
		</div>
	);
});
