import { compDefine } from '@wwf971/react-doc';
import { CvJpList } from './jp/CvJpList.jsx';
import { cvJpPagination } from './jp/CvJpPagination.jsx';
import { CvJpSheet } from './jp/CvJpSheet.jsx';
import { CvProfileInfo } from './profile/CvProfileInfo.jsx';

// modes of a frontend object, never written as blocks themselves (doc/README.md)
const modeDefine = (label, description) => ({ placementList: ['objectFrontend'], expose: { meta: { label, description, isNotInDoc: true } } });

export const CvProfileInfoDefine = compDefine(CvProfileInfo, modeDefine('CV: personal information', 'The information of a profile, its query paths, edited in place'));
// the sheet can be laid out on pages (react-doc: main/doc_page_impl_pagination.md): its flow
// and pieces (jp/CvJpPagination.jsx), which its view Pages hands to PageFlow
const sheetDefine = modeDefine('CV: Japanese style', 'One CV drawn in Japanese style, edited in place, laid out on pages');
export const CvJpSheetDefine = compDefine(CvJpSheet, { ...sheetDefine, expose: { ...sheetDefine.expose, pagination: cvJpPagination } });
export const CvJpListDefine = compDefine(CvJpList, modeDefine('CV: the CVs and templates', 'The CVs of the object, and a new one from a template'));
