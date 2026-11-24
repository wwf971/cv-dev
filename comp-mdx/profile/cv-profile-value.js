import { cvDataRemove, cvDataSet, cvLeafPlaceGet, cvLeafValueBuild, cvQueryParse } from '../query/CvQuery.js';
import { CV_KIND_ID_INFO, CV_KIND_INFO, cvInfoCreateInput, cvKindNameOf } from '../query/CvProfile.js';

// One value of a profile written where its path names it (doc/cv-query.md#how-the-information-is-stored),
// for whatever changes it in place: the card of a value (CvProfileValuePanel.jsx), from a cell of a
// paper or from any token naming it.
//
//   profile     the api of the profile object (a mode's service, or otherGet's)
//   info        what the profile holds in the partition (cvProfileRead(...).info)
//   query       the path of the value: written at its leaf, added at the place the path names when
//               nothing holds it (an item of the partition made when none of the path's subject is)
//   text        what it says now; emptied, the value is taken out
//   partition   the partition an item is made in
//   isList      the value is a list: a line an entry
//   isNumber    a whole number typed is kept as a number (the year and the month of a date)
// A whole number typed for a value that is a number stays one too; any other text is kept as typed
// (a phone number keeps its leading zero). Answers { code, message }.
export async function cvProfileValueWrite(profile, info, query, textInput, partition, { isList = false, isNumber = false } = {}) {
	const text = String(textInput ?? '');
	const path = cvQueryParse(query).segmentList.join('/');
	const place = cvLeafPlaceGet(info, path);
	if (!place) return { code: -1, message: `${path} names no place of the profile` };
	const isEmpty = text.trim() === '';
	const isWhole = /^-?\d+$/.test(text.trim());
	if (!place.assetKey) {
		if (isEmpty) return { code: 0, message: '' };
		const value = isNumber && isWhole ? Number(text.trim()) : cvLeafValueBuild(text, isList);
		const data = place.keyPath.length > 0 ? cvDataSet({}, place.keyPath, value) : value;
		return profile.assetCreate(cvInfoCreateInput(partition, place, data, cvKindNameOf(profile, CV_KIND_ID_INFO, CV_KIND_INFO)));
	}
	const data = profile.assetDataGet(place.assetKey).data;
	const valueBefore = cvValueAtGet(data, place.keyPath);
	const value = (isNumber || typeof valueBefore === 'number') && isWhole ? Number(text.trim()) : cvLeafValueBuild(text, isList);
	const dataNext = isEmpty ? cvDataRemove(data, place.keyPath) : cvDataSet(data, place.keyPath, value);
	return profile.assetWrite(place.assetKey, dataNext, path);
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
