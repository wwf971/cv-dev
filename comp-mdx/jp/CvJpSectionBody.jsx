import { observer } from 'mobx-react-lite';
import { CvJpBasic, CvJpClosing, CvJpEducation, CvJpHistory, CvJpText } from './CvJpSection.jsx';
import { WeJpCareer, WeJpHead } from './WeJpSection.jsx';

// What a part (a section) draws, by its type: the one place where a type is matched to what draws
// it, for the sheet (CvJpSheet.jsx), the gallery of parts and a part on a page of its own
// (CvJpPartGallery.jsx). The pages of a paper draw from plain data instead (CvJpPagination.jsx)
export const CvJpSectionBody = observer(function CvJpSectionBody({ section, sheet, store }) {
	if (section.type === 'basic') return <CvJpBasic sheet={sheet} section={section} store={store} />;
	if (section.type === 'head') return <WeJpHead section={section} sheet={sheet} store={store} />;
	if (section.type === 'history') return <CvJpHistory section={section} store={store} />;
	if (section.type === 'career') return <WeJpCareer section={section} store={store} />;
	if (section.type === 'text') return <CvJpText section={section} store={store} />;
	if (section.type === 'closing') return <CvJpClosing section={section} store={store} />;
	if (section.type === 'education') return <CvJpEducation section={section} store={store} />;
	return null;
});
