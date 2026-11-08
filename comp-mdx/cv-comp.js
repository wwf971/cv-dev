import { compDefine } from '@wwf971/react-doc';
import { CvJpList } from './jp/CvJpList.jsx';
import { CvJpSheet } from './jp/CvJpSheet.jsx';
import { CvProfileInfo } from './profile/CvProfileInfo.jsx';

// modes of a frontend object, never written as blocks themselves (doc/README.md)
const modeDefine = (label, description) => ({ placementList: ['objectFrontend'], expose: { meta: { label, description, isNotInDoc: true } } });

export const CvProfileInfoDefine = compDefine(CvProfileInfo, modeDefine('CV: personal information', 'The information of a profile, its query paths, edited in place'));
export const CvJpSheetDefine = compDefine(CvJpSheet, modeDefine('CV: Japanese style', 'One CV drawn in Japanese style, edited in place'));
export const CvJpListDefine = compDefine(CvJpList, modeDefine('CV: the CVs and templates', 'The CVs of the object, and a new one from a template'));
