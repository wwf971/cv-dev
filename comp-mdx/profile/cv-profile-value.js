import {
	cvDataRemove, cvLeafPlaceGet, cvLeafValueBuild, cvQueryParse, cvValueDataSet, cvValueVersionHeadSet, cvValueVersionNoteSet, cvValueVersionRemove, cvVersionedIs,
} from '../query/CvQuery.js';
import { CV_KIND_ID_INFO, CV_KIND_INFO, cvInfoCreateInput, cvKindNameOf } from '../query/CvProfile.js';

// One value of a profile written where its path names it (doc/cv-query.md#how-the-information-is-stored),
// for whatever changes it in place: the card of a value (CvProfileValuePanel.jsx), from a cell of a
// paper or from any token naming it.
//
//   profile     the api of the profile object (a mode's service, or otherGet's)
//   info        what the profile holds in the partition (cvProfileRead(...).info)
//   query       the path of the value: written at its leaf, added at the place the path names when
//               nothing holds it (an item of the partition made when none of the path's subject is).
//               a version it names (pr/jp@2) is the version written, unless option.versionId says one
//   text        what it says now; emptied, a value written plainly is taken out (one kept with
//               versions keeps them: its version says nothing then)
//   partition   the partition an item is made in
// option, how it is written (doc/cv-query.md#versions-of-a-value):
//   mode        'inPlace' (default): the version named, else the head, says the text from now on
//               'newVersion': a new version holds it
//   versionId   the version written in place
//   isHeadMoved a new version becomes the head (default true; false for a place pinned to a
//               version, whose new version is its own and leaves the head where it is)
//   time, note  of a new version: when it was made (react-doc's time text), what it is for
//   isList      the value is a list: a line an entry
//   isNumber    a whole number typed is kept as a number (the year and the month of a date)
// A whole number typed for a value that is a number stays one too; any other text is kept as typed
// (a phone number keeps its leading zero). Answers { code, message, data: { versionId } }: the
// version written.
export async function cvProfileValueWrite(profile, info, query, textInput, partition, { isList = false, isNumber = false, mode = 'inPlace', versionId, isHeadMoved = true, time = '', note = '' } = {}) {
	const text = String(textInput ?? '');
	const parsed = cvQueryParse(query);
	const path = parsed.segmentList.join('/');
	const place = cvLeafPlaceGet(info, path);
	if (!place) return { code: -1, message: `${path} names no place of the profile` };
	const isEmpty = text.trim() === '';
	const isWhole = /^-?\d+$/.test(text.trim());
	if (!place.assetKey) {
		if (isEmpty) return { code: 0, message: '', data: { versionId: 1 } };
		const value = isNumber && isWhole ? Number(text.trim()) : cvLeafValueBuild(text, isList);
		const data = place.keyPath.length > 0 ? cvValueDataSet({}, place.keyPath, value).data : value;
		return resultWithVersion(await profile.assetCreate(cvInfoCreateInput(partition, place, data, cvKindNameOf(profile, CV_KIND_ID_INFO, CV_KIND_INFO))), 1);
	}
	const data = profile.assetDataGet(place.assetKey).data;
	const valueBefore = cvValueAtGet(data, place.keyPath);
	const isVersioned = cvVersionedIs(valueBefore);
	const value = (isNumber || typeof valueBefore === 'number') && isWhole ? Number(text.trim()) : cvLeafValueBuild(text, isList);
	// a plain value emptied in place is taken out, as it always was
	if (isEmpty && !isVersioned && mode !== 'newVersion') return resultWithVersion(await profile.assetWrite(place.assetKey, cvDataRemove(data, place.keyPath), path), 1);
	const versionTarget = versionId ?? (parsed.version || undefined);
	const written = cvValueDataSet(data, place.keyPath, value, { mode, versionId: versionTarget, isHeadMoved, time, note });
	if (written.message) return { code: -1, message: `${path}: ${written.message}` };
	const what = mode === 'newVersion' ? `${path}: version ${written.versionId}` : isVersioned ? `${path}: version ${written.versionId} rewritten` : path;
	return resultWithVersion(await profile.assetWrite(place.assetKey, written.data, what), written.versionId);
}

// a change of the versions of a value, none of its texts (doc/cv-query.md#versions-of-a-value):
//   { type: 'headSet', versionId }        that version is the head: what every query naming none reads
//   { type: 'remove', versionId }         that version is taken out (never the head)
//   { type: 'noteSet', versionId, note }  what that version is for, said beside it
// leaf: the value (a leaf of cvProfileRead(...).info). Answers { code, message }.
export async function cvProfileValueVersionChange(profile, leaf, change) {
	if (!leaf?.assetKey) return { code: -1, message: 'the value is kept in no item of the profile' };
	const data = profile.assetDataGet(leaf.assetKey).data;
	const changed = change.type === 'headSet' ? cvValueVersionHeadSet(data, leaf.keyPath, change.versionId)
		: change.type === 'remove' ? cvValueVersionRemove(data, leaf.keyPath, change.versionId)
			: change.type === 'noteSet' ? cvValueVersionNoteSet(data, leaf.keyPath, change.versionId, change.note)
				: { message: `no change of versions is called ${change.type}` };
	if (changed.message) return { code: -1, message: `${leaf.path}: ${changed.message}` };
	if (changed.data === data) return { code: 0, message: '' };
	const what = change.type === 'headSet' ? `${leaf.path}: version ${change.versionId} is the head`
		: change.type === 'remove' ? `${leaf.path}: version ${change.versionId} removed` : `${leaf.path}: the note of version ${change.versionId}`;
	return profile.assetWrite(leaf.assetKey, changed.data, what);
}

function resultWithVersion(result, versionId) {
	const isDone = result?.code === 0 || result?.code === undefined;
	return isDone ? { code: 0, message: '', ...(result ?? {}), data: { ...(result?.data ?? {}), versionId } } : result;
}

function cvValueAtGet(data, keyPath) {
	return keyPath.reduce((value, key) => (value !== null && typeof value === 'object' ? value[key] : undefined), data);
}

// the common values of a value of the profile, offered as buttons in its card (CvProfileValuePanel):
// the status of an education, edu/{…}/status (doc/cv-query.md#an-education). A value may say
// anything else, typed
export const CV_EDUCATION_STATUS_LIST = ['卒業', '卒業見込み', '修了', '修了見込み', '中退', '在学中', '単位取得満期退学'];

export function cvProfileValueChoiceListGet(query) {
	const { segmentList } = cvQueryParse(query);
	if (segmentList[0] === 'edu' && segmentList.length > 2 && segmentList[segmentList.length - 1] === 'status') return CV_EDUCATION_STATUS_LIST;
	return [];
}
