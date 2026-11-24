import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useCell } from '@wwf971/react-doc';
import { cvBadgeRead } from '../query/CvBadge.js';
import { cvProfileRead } from '../query/CvProfile.js';
import { cvInfoBuild } from '../query/CvQuery.js';
import { CV_JP_FORM_LIST, cvJpDateVirtualBuild, cvJpFormGet, cvJpInstanceRead, cvJpSheetBuild, cvJpTemplateRead } from './CvJpData.js';
import { CV_JP_STORE_READ, CvJpEditContext } from './CvJpSection.jsx';
import { CvJpSectionBody } from './CvJpSectionBody.jsx';
import { cvBadgeToken } from './cv-badge-cell.jsx';
import { cvEraToken } from './cv-era-cell.jsx';
import { cvPeriodToken } from './cv-period-cell.jsx';
import { cvQueryToken } from './cv-query-cell.js';
import './CvJp.css';

// The parts a paper may be made of, in the mode Papers (doc/cv-sheet.md#the-gallery-of-parts):
//
//   /{partition}/part             the gallery: a tile per part, the part itself drawn small, grouped
//                                 by where it comes from (the parts of a CV, of a work experience, the
//                                 part templates of the partition); a click opens it
//   /{partition}/part/{…}         one part at the top of a page, as a paper starting with it draws it
//
// A part is drawn from the profile of the partition, today, as a paper of that partition reads it,
// and only read: it is chosen here, and added to a paper from the paper (its + or a right click).

const CV_JP_PART_SOURCE_LABEL = { form: 'a part of the form', object: 'a part template' };

// what parts are drawn from: the profile of the partition read as a paper of it reads it, and a cell
// with the sheet's token kinds over it (a query, a badge, a year with its era, a period)
function useCvJpPartRead(service, config, partition, profileRef) {
	const [profileAccess] = useState(() => ({}));
	const [date] = useState(() => new Date());
	const profileOther = profileRef && service ? service.otherGet(profileRef) : undefined;
	const profile = profileOther?.object?.status === 'found' ? profileOther : undefined;
	const profileRead = profile ? cvProfileRead(profile, cvJpDateVirtualBuild(date), partition) : undefined;
	const info = profileRead?.info ?? cvInfoBuild([], cvJpDateVirtualBuild(date));
	const badgeRead = profile ? cvBadgeRead(profile, partition) : undefined;
	const reason = 'a part is shown here, and changed in a paper';
	profileAccess.profile = profile;
	profileAccess.partition = partition;
	profileAccess.isEditable = false;
	profileAccess.editUnavailableReason = reason;
	const cell = useCell({
		tokenList: [cvQueryToken, cvBadgeToken, cvEraToken, cvPeriodToken],
		context: {
			info, dateNow: date, profileAccess, isEra: true, badge: badgeRead, isEditing: false, isProfileEditable: false, profileUnavailableReason: reason,
			badgeCreate: () => {}, badgeWrite: () => {}, writeProblem: '',
		},
		config,
	});
	const isLoading = profileOther?.object?.status === 'loading' || (profileRead?.countLoading ?? 0) > 0 || (badgeRead?.countLoading ?? 0) > 0;
	return { cell, info, date, isLoading, isProfile: Boolean(profile) };
}

// a part on a paper of its form: a paper whose template is that part alone, holding nothing of its own
const CvJpPartPaper = observer(function CvJpPartPaper({ part, read, isPage = false }) {
	const form = cvJpFormGet(part.form);
	const template = cvJpTemplateRead({ form: form.kind, sectionList: [{ ...part.section, id: 'part' }] }, form);
	const sheet = cvJpSheetBuild({ template, instance: cvJpInstanceRead({}), info: read.info, context: { dateNow: read.date, cellTextGet: read.cell.textGet } });
	return (
		<CvJpEditContext.Provider value={{ cell: read.cell, keyPrefix: `part:${part.key}` }}>
			<div className={`doc-cv-jp-paper doc-cv-jp-form-${form.kind} doc-cv-part-paper`} data-page={isPage ? '' : undefined}>
				{sheet.sectionList.map((section) => (
					<div key={section.id} className="doc-cv-jp-section" data-section-type={section.type}>
						<CvJpSectionBody section={section} sheet={sheet} store={CV_JP_STORE_READ} />
					</div>
				))}
			</div>
		</CvJpEditContext.Provider>
	);
});

function partSubtitleGet(place) {
	const form = CV_JP_FORM_LIST.find((one) => one.kind === place.part.form);
	return `${CV_JP_PART_SOURCE_LABEL[place.part.source] ?? ''} of a ${form?.label ?? 'paper'}${place.part.source === 'object' ? ` · ${place.path}` : ''}`;
}

// the gallery of the parts of a partition
//   tree, place    the places of the mode Papers (CvJpPaperTree.js) and the gallery's
//   profileRef     the profile the papers of the object read (param.profile, else metadata.profile)
export const CvJpPartGallery = observer(function CvJpPartGallery({ service, config, tree, place, nav, profileRef, partitionLabel }) {
	const read = useCvJpPartRead(service, config, place.partition, profileRef);
	const partPlaceList = tree.childListGet(place.path).map((one) => tree.placeGet(one.path)).filter((one) => one?.kind === 'part');
	const groupList = [
		...CV_JP_FORM_LIST.map((form) => ({ id: form.kind, label: `Parts of a ${form.label}`, placeList: partPlaceList.filter((one) => one.part.source === 'form' && one.part.form === form.kind) })),
		{ id: 'object', label: 'Part templates of this partition', placeList: partPlaceList.filter((one) => one.part.source === 'object') },
	].filter((group) => group.placeList.length > 0);
	return (
		<div className="doc-cv-part-gallery">
			<p className="doc-cv-list-muted doc-cv-part-gallery-note">
				The parts a paper may be made of, drawn from the profile of {partitionLabel || place.partition}{read.isProfile ? '' : ' (no profile is read: the values stay empty)'}. Open one to see it at the top of a page; a paper adds one by + beside a part, or a right click on it.
			</p>
			{read.isLoading ? <p className="doc-note">Reading the profile…</p> : groupList.map((group) => (
				<section key={group.id} className="doc-cv-part-gallery-group">
					<h3 className="doc-cv-part-gallery-heading">{group.label} <span className="doc-cv-list-muted">({group.placeList.length})</span></h3>
					<div className="doc-cv-part-gallery-grid">
						{group.placeList.map((one) => (
							// a tile, not a button: what the part draws may hold a link, which no button holds
							<div
								key={one.path}
								role="button"
								tabIndex={0}
								className="doc-cv-part-tile"
								title={`${one.label}: open it at the top of a page`}
								onClick={() => nav.pathSet(one.path)}
								onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); nav.pathSet(one.path); } }}
							>
								<span className="doc-cv-part-tile-preview" aria-hidden="true"><CvJpPartPaper part={one.part} read={read} /></span>
								<span className="doc-cv-part-tile-label">{one.label}</span>
								<span className="doc-cv-list-muted doc-cv-part-tile-sub">{partSubtitleGet(one)}</span>
							</div>
						))}
					</div>
				</section>
			))}
		</div>
	);
});

// one part at the top of a page: as a paper starting with it draws it, the rest of the page empty
export const CvJpPartPage = observer(function CvJpPartPage({ service, config, place, profileRef, partitionLabel }) {
	const read = useCvJpPartRead(service, config, place.partition, profileRef);
	return (
		<div className="doc-cv-part-page">
			<div className="doc-cv-part-page-bar">
				<span className="doc-cv-part-tile-label">{place.label}</span>
				<span className="doc-cv-list-muted">{partSubtitleGet(place)} · drawn from the profile of {partitionLabel || place.partition}, as of today</span>
			</div>
			{read.isLoading ? <p className="doc-note">Reading the profile…</p> : (
				<div className="doc-cv-jp-scroll">
					<CvJpPartPaper part={place.part} read={read} isPage />
				</div>
			)}
		</div>
	);
});
