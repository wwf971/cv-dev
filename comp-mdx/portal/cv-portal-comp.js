import { compDefine, compIconDefine } from '@wwf971/react-doc';
import { createElement, Fragment } from 'react';
import { CvPortalDesk } from './desk/CvPortalDesk.jsx';
import { CvPortalRoom } from './room/CvPortalRoom.jsx';

// The components of the portals of the package cv (doc/cv-portal.md), each exposing "portal":
// what makes a component one that can draw a portal (react-doc:
// main/doc_page_impl_portal.md#the-component-of-a-portal). Both are provided by a papers object
// (type cv.jp, portalList in type.yaml) and draw the same archive (archive/CvArchiveStore.js).
const portalDefine = (label, description, portal, icon) => ({
	placementList: ['portal'],
	expose: { meta: { label, description, isNotInDoc: true }, icon, portal },
});

// a desk: a top and two drawers under it
const CvPortalDeskIcon = compIconDefine(createElement(Fragment, null,
	createElement('path', { d: 'M3 7h18v3H3z' }),
	createElement('path', { d: 'M5 10v9h6v-9' }),
	createElement('path', { d: 'M13 10v9h6v-9' }),
	createElement('path', { d: 'M7 13h2M7 16h2M15 13h2' }),
));

// a file cabinet: three drawers, each with its handle
const CvPortalRoomIcon = compIconDefine(createElement(Fragment, null,
	createElement('rect', { x: 5, y: 3, width: 14, height: 18, rx: 1.5 }),
	createElement('path', { d: 'M5 9h14M5 15h14' }),
	createElement('path', { d: 'M10 6h4M10 12h4M10 18h4' }),
));

// the desk draws the standard switcher in its own bar
export const CvPortalDeskDefine = compDefine(CvPortalDesk, portalDefine(
	'CV: the portal Desk',
	'The papers of a person as a desktop app: cabinets and drawers at the left, a paper on its sheet at the right',
	{ deviceList: ['browser', 'desktop'], switcherPlace: 'own' },
	CvPortalDeskIcon,
));

// the room has no bar: the switcher floats at its top left, drawn by the host
export const CvPortalRoomDefine = compDefine(CvPortalRoom, portalDefine(
	'CV: the portal Archive room',
	'The papers of a person as a room of file cabinets, walked with the keyboard and the mouse',
	{ deviceList: ['browser', 'desktop'], switcherPlace: 'floating' },
	CvPortalRoomIcon,
));
