import { useState } from 'react';
import { makeAutoObservable } from 'mobx';
import { observer } from 'mobx-react-lite';
import { Plus } from 'lucide-react';
import { CV_JP_TEMPLATE_DEFAULT, CV_KIND_INSTANCE, CV_KIND_TEMPLATE, cvJpInstanceRead } from './CvJpData.js';
import { CV_PARTITION_EXAMPLE, cvPartitionListGet, cvPartitionTitleGet, cvPathInPartition } from '../query/CvProfile.js';
import './CvJp.css';

// The CVs and templates of an object (doc/cv-jp.md): a row opens a CV in the block's mode
// "sheet", the form makes a new CV of a template, reading a profile, in a partition, which it names
// (doc/README.md#partitions).
class CvJpListStore {
	name = '';
	template = '';
	partition = '';
	status = 'idle';
	message = '';

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true });
	}

	nameSet(text) {
		this.name = text;
		this.message = '';
	}

	templateSet(key) {
		this.template = key;
	}

	partitionSet(partition) {
		this.partition = partition;
	}

	// a path of a name: letters, digits and "-" of what it says; what remains is in the item's name
	async create(service, templateAsset, profileRef, partition) {
		const name = this.name.trim();
		if (!name) {
			this.status = 'error';
			this.message = 'Name the CV.';
			return;
		}
		this.status = 'submitting';
		let templatePath = templateAsset?.pathList?.[0];
		if (!templatePath) {
			templatePath = cvPathInPartition(partition, '/template/jp-standard');
			const result = await service.assetCreate({ kind: CV_KIND_TEMPLATE, name: CV_JP_TEMPLATE_DEFAULT.name, pathList: [templatePath], ...(partition ? { partition } : {}), data: CV_JP_TEMPLATE_DEFAULT });
			if (result.code !== 0) {
				this.status = 'error';
				this.message = result.message;
				return;
			}
		}
		const segment = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || String(service.assetList(CV_KIND_INSTANCE).length + 1);
		const path = cvPathInPartition(partition, `/instance/${segment}`);
		const result = await service.assetCreate({
			kind: CV_KIND_INSTANCE,
			name,
			pathList: [path],
			...(partition ? { partition } : {}),
			data: { name, template: templatePath, ...(profileRef ? { profile: profileRef } : {}) },
		});
		if (result.code !== 0) {
			this.status = 'error';
			this.message = result.message;
			return;
		}
		this.name = '';
		this.status = 'idle';
		this.message = '';
		service.blockSet({ mode: 'sheet', param: { instance: path } }, { isSaved: false });
	}
}

export const CvJpList = observer(function CvJpList({ data = {}, config = {} }) {
	const service = config.objectFrontend;
	const [store] = useState(() => new CvJpListStore());
	if (!service) return <p className="doc-error">CvJpList is a mode of a frontend object (ObjectFrontend).</p>;
	const templateList = service.assetList(CV_KIND_TEMPLATE);
	const instanceList = service.assetList(CV_KIND_INSTANCE);
	const templateChosen = templateList.find((asset) => asset.key === store.template) ?? templateList[0];
	const profileDefault = data.param?.profile || service.object.metadata?.profile || '';
	const partitionList = cvPartitionListGet(service, [...instanceList, ...templateList]);
	const partitionChosenId = store.partition || data.param?.partition || CV_PARTITION_EXAMPLE;
	const partitionChosen = partitionList.find((one) => one.id === partitionChosenId);
	return (
		<div className="doc-cv-list not-prose">
			<h4>CVs ({instanceList.length})</h4>
			{instanceList.length > 0 ? (
				<table>
					<thead><tr><th>name</th><th>path</th><th>template</th><th>profile</th><th>as of</th></tr></thead>
					<tbody>
						{instanceList.map((asset) => {
							const read = service.assetDataGet(asset.key);
							const instance = cvJpInstanceRead(read.data);
							return (
								<tr key={asset.key}>
									<td><button type="button" className="doc-cv-list-link" onClick={() => service.blockSet({ mode: 'sheet', param: { instance: asset.pathList?.[0] ?? asset.key } }, { isSaved: false })}>{instance.name || asset.name || asset.key}</button></td>
									<td className="doc-cv-list-muted">{asset.pathList?.[0] ?? ''}</td>
									<td className="doc-cv-list-muted">{instance.template || '(the first)'}</td>
									<td className="doc-cv-list-muted">{instance.profile || profileDefault || '(none)'}</td>
									<td className="doc-cv-list-muted">{instance.asOf || 'today'}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			) : <p className="doc-note">No CV yet.</p>}
			<h4>Templates ({templateList.length})</h4>
			{templateList.length > 0 ? (
				<table>
					<thead><tr><th>name</th><th>path</th></tr></thead>
					<tbody>{templateList.map((asset) => <tr key={asset.key}><td>{asset.name || asset.key}</td><td className="doc-cv-list-muted">{asset.pathList?.[0] ?? ''}</td></tr>)}</tbody>
				</table>
			) : <p className="doc-note">No template yet: the first CV writes the standard one here.</p>}
			{/* a new CV is offered while the document is edited (react-doc:
			    main/doc_page_impl_obj_frontend.md#reading-and-editing) */}
			{service.docState?.isEditing ? (
				<div className="doc-cv-list-form">
					<input aria-label="The name of the new CV" placeholder="The name of a new CV" value={store.name} onChange={(event) => store.nameSet(event.target.value)} />
					{partitionList.length > 1 ? (
						<select aria-label="The partition of the new CV" title={cvPartitionTitleGet(partitionChosen, 'The new CV goes', 'instance')} value={partitionChosenId} onChange={(event) => store.partitionSet(event.target.value)}>
							{partitionList.map((one) => <option key={one.id} value={one.id}>{one.label}</option>)}
						</select>
					) : null}
					{templateList.length > 1 ? (
						<select aria-label="The template" value={templateChosen?.key ?? ''} onChange={(event) => store.templateSet(event.target.value)}>
							{templateList.map((asset) => <option key={asset.key} value={asset.key}>{asset.name || asset.key}</option>)}
						</select>
					) : null}
					<button type="button" className="doc-button" disabled={store.status === 'submitting' || !service.isEditable} title={service.isEditable ? 'A new CV of the template' : service.editUnavailableReason} onClick={() => store.create(service, templateChosen, profileDefault, partitionChosenId)}>
						<Plus size={12} aria-hidden="true" /><span>New CV</span>
					</button>
					{store.message ? <span className="doc-error" role="alert">{store.message}</span> : null}
				</div>
			) : null}
			{service.docState?.isEditing ? (
				<p className="doc-cv-list-muted doc-cv-list-place">{cvPartitionTitleGet(partitionChosen, 'The new CV goes', 'instance')}; it reads the profile of the same partition.</p>
			) : null}
		</div>
	);
});
