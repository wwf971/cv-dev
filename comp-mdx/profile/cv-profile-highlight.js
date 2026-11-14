import { useEffect, useRef } from 'react';

// The words typed to find a value, marked where they stand in the rows of a panel
// (CvProfileInfo.jsx): in a name, a path, a value, also one being edited in place. The marks are
// ranges given to the browser (the CSS Custom Highlight API, ::highlight(cv-profile-find) in
// CvProfile.css), so the rows are drawn as they are without the words: no element is added, a
// value keeps its one text and its editor. A browser without the api marks nothing.
//
//   useFindHighlight(rootRef, wordList)   after every render, the words found in the texts
//                                         below rootRef.current; [] takes the marks away
const HIGHLIGHT_NAME = 'cv-profile-find';
// where a word is looked for: what a row says, not its counts and its buttons
const TEXT_SELECTOR = '.doc-cv-profile-name-text, .doc-cv-profile-found, .doc-cv-profile-group-member, .doc-cv-profile-value';
// one highlight of that name for the page: every panel adds its ranges to it
const rangeListByOwner = new Map();

function highlightApply() {
	const registry = globalThis.CSS?.highlights;
	if (!registry || typeof globalThis.Highlight !== 'function') return;
	const rangeList = [...rangeListByOwner.values()].flat();
	if (rangeList.length === 0) registry.delete(HIGHLIGHT_NAME);
	else registry.set(HIGHLIGHT_NAME, new globalThis.Highlight(...rangeList));
}

// the ranges of every word in the texts of the rows below root, whatever its case
export function findRangeListGet(root, wordList) {
	const rangeList = [];
	if (!root || wordList.length === 0) return rangeList;
	for (const element of root.querySelectorAll(TEXT_SELECTOR)) {
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const text = node.data.toLowerCase();
			for (const word of wordList) {
				for (let at = text.indexOf(word); at >= 0; at = text.indexOf(word, at + word.length)) {
					const range = document.createRange();
					range.setStart(node, at);
					range.setEnd(node, at + word.length);
					rangeList.push(range);
				}
			}
		}
	}
	return rangeList;
}

export function useFindHighlight(rootRef, wordList) {
	const ownerRef = useRef(null);
	if (!ownerRef.current) ownerRef.current = {};
	const wordKey = wordList.join('\n');
	// after every render: the rows are other rows when the data or the folder shown changes
	useEffect(() => {
		const rangeList = findRangeListGet(rootRef.current, wordKey === '' ? [] : wordKey.split('\n'));
		if (rangeList.length === 0 && !rangeListByOwner.has(ownerRef.current)) return;
		if (rangeList.length === 0) rangeListByOwner.delete(ownerRef.current);
		else rangeListByOwner.set(ownerRef.current, rangeList);
		highlightApply();
	});
	useEffect(() => () => {
		if (!rangeListByOwner.delete(ownerRef.current)) return;
		highlightApply();
	}, []);
}
