import { makeAutoObservable } from 'mobx';

// What the archive room keeps of its own (doc/cv-portal.md#the-state): the look's state, beside the
// state of the archive every portal shares (archive/CvArchiveStore.js). Where the reader is in the
// archive is not here: that is the address. Here is only what a room adds to it.
//
//   hover       what the pointer is on: { path, level, label, detail }. where the pointer is, is the loop's
//               (CvPortalRoom.jsx), which moves the line beside it without a render
//   isHelpShown the line of keys at the bottom is shown
//   problem     why the room cannot be drawn ('' when it can): a window without WebGL
//   isFocused   the room takes the keys (it holds the focus): said in its frame
//   renderer    what draws the room: { name, isSoftware } (a GPU, or the CPU when the browser has no
//               GPU for WebGL), said in the line of keys
//
// The pose of the reader (where they stand, where they look) changes every frame while they walk,
// so it is kept out of what React observes: CvPortalRoom holds it in a plain object.
export class CvRoomStore {
	hover = undefined;
	isHelpShown = true;
	problem = '';
	isFocused = false;
	renderer = undefined;

	constructor() {
		makeAutoObservable(this);
	}

	// what is pointed at changed: only then is anything drawn again (where the pointer is, is not here)
	hoverSet(hover) {
		if ((hover?.path ?? '') === (this.hover?.path ?? '')) return;
		this.hover = hover ? { path: hover.path, level: hover.level, label: hover.label, detail: hover.detail } : undefined;
	}

	helpToggle() {
		this.isHelpShown = !this.isHelpShown;
	}

	problemSet(problem) {
		this.problem = String(problem ?? '');
	}

	focusedSet(isFocused) {
		this.isFocused = isFocused === true;
	}

	rendererSet(renderer) {
		this.renderer = renderer ? { name: String(renderer.name ?? ''), isSoftware: renderer.isSoftware === true } : undefined;
	}
}
