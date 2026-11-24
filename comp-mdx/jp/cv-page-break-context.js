import { createContext } from 'react';

// the id of the row of a history whose text is drawn inside: a badge there marks itself as a place
// the row may be cut at on pages (cv-page-break.js)
export const CvJpRowBreakContext = createContext('');
