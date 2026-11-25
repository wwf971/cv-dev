import { useEffect, useRef, useState } from 'react';
import { reaction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { BookOpen, ChevronRight, CircleHelp, FileText, Folder, Pencil, X } from 'lucide-react';
import { ObjectFrontendMode } from '@wwf971/react-doc';
import { FolderView } from '@wwf971/react-comp-misc';
import { CV_ARCHIVE_ROOT, cvArchiveDrawerGet } from '../archive/CvArchiveModel.js';
import { useCvArchive } from '../archive/CvArchiveStore.js';
import { CV_ROOM_EYE_HEIGHT, cvRoomFindGet, cvRoomLayoutBuild, cvRoomLayoutKeyGet, cvRoomPositionClamp, cvRoomStandGet } from './CvRoomLayout.js';
import { CvRoomScene } from './CvRoomScene.js';
import { CvRoomStore } from './CvRoomStore.js';
import './CvPortalRoom.css';

// The portal Archive room (doc/cv-portal.md#the-archive-room): the archive as a room one walks in.
// A file cabinet stands at the back wall for every cabinet of the archive (a partition of the
// data), its drawers are the sorts of paper kept, and the folders hanging in a drawer are the
// papers. It draws the same state as the desk (archive/CvArchiveStore.js): the place of the
// address is the drawer that is out and the folder that is lifted, and acting on the furniture
// writes the address.
//
//   walk     W A S D or the arrows (← → turn); the wheel steps forward and back
//   look     drag with the mouse
//   act      a click on a cabinet, a drawer or a folder (Enter or E: on what is in the middle of
//            the view): a cabinet is gone to, a drawer comes out, a folder is taken out and its
//            paper is laid beside the room, on its sheet (the mode "sheet" of the papers object)
//   back     Esc or Backspace: the folder back, the drawer shut, the cabinet left
//
// A folder of the reader's filing (doc/cv-portal.md#folders) hangs in its drawer as a darker,
// thicker folder in the order of the drawer; taken out, what it holds is listed beside the room,
// and a paper of it is laid there as any other, the folder still lifted.
//
// A window that cannot draw 3D (no WebGL) still has the archive: its places as a list.
//
// Nothing of React runs while the reader moves: the pose, the keys held and the pointer are plain
// values of the loop (liveRef), what the pointer is on is asked once a frame (never on every
// pointer event), and the line beside the pointer is moved by its element. React draws again only
// when the thing pointed at changes. What a frame costs is the scene's (CvRoomScene.js: drawn only
// when something changed, at the density the GPU keeps up with).
const SPEED_WALK = 2.6;
const SPEED_TURN = 1.9;
const TWEEN_SECONDS = 0.75;
// the wheel: meters a pixel of it walks, and how fast the walk it asks for is made (per second, of
// what remains): a notch of a mouse wheel is a glide over a few frames, never a jump
const WHEEL_METERS_PER_PIXEL = 0.0022;
const WHEEL_GLIDE_RATE = 10;

export const CvPortalRoom = observer(function CvPortalRoom({ config = {} }) {
	const store = useCvArchive(config);
	const [room] = useState(() => new CvRoomStore());
	const stageRef = useRef(null);
	// the line beside the pointer: moved by its element, never by a render
	const hoverRef = useRef(null);
	// the scene and what moves every frame: the pose of the reader, the keys held, a walk to a place
	const liveRef = useRef(null);
	const portal = config.portal;
	const service = config.objectFrontend;

	useEffect(() => {
		const stage = stageRef.current;
		if (!stage || !store.service) return undefined;
		let scene;
		try {
			scene = new CvRoomScene(stage);
		} catch (error) {
			room.problemSet(`This window cannot draw the room (${String(error?.message ?? error)}).`);
			return undefined;
		}
		room.rendererSet({ name: scene.rendererName, isSoftware: scene.isSoftware });
		const layoutGet = () => cvRoomLayoutBuild(store.archive);
		// pointer: where the pointer is over the stage, and whether it moved since what is under it was asked
		// glide: the meters the wheel asked to walk and not walked yet
		const live = { scene, layout: layoutGet(), pose: undefined, keySet: new Set(), tween: undefined, drag: undefined, pointer: undefined, glide: 0 };
		liveRef.current = live;
		live.pose = cvRoomStandGet(live.layout, store.placeShown?.path ?? CV_ARCHIVE_ROOT);
		// the folder lifted: the paper's own, or the folder hanging in the drawer that the place is in
		const stateSync = () => {
			const place = store.placeShown;
			const isLifted = place?.level === 'file' || place?.level === 'folder';
			scene.stateSet({ drawerOpenPath: store.drawer?.path ?? '', fileOpenPath: isLifted ? cvRoomFindGet(live.layout, place.path).file?.path ?? '' : '' });
		};
		// the furniture follows the archive: built again only when what is drawn of it changed
		const disposeLayout = reaction(() => cvRoomLayoutKeyGet(layoutGet()), () => {
			live.layout = layoutGet();
			scene.layoutSet(live.layout);
			stateSync();
		}, { fireImmediately: true });
		// the place of the address: the drawer out, the folder lifted, and the reader walked there
		const disposePlace = reaction(() => store.placeShown?.path ?? CV_ARCHIVE_ROOT, (path) => {
			stateSync();
			live.tween = { from: { ...live.pose }, to: cvRoomStandGet(live.layout, path), time: 0 };
		});
		scene.poseSet(live.pose);

		let frameId = 0;
		let timeLast = performance.now();
		const frame = (time) => {
			const frameMs = time - timeLast;
			const dt = Math.min(0.05, frameMs / 1000);
			timeLast = time;
			poseStep(live, dt);
			const isMoving = scene.poseSet(live.pose);
			// what is under the pointer, asked once a frame, when the pointer or the view moved
			if (live.pointer && !live.drag && (live.pointer.isMoved || isMoving)) {
				live.pointer.isMoved = false;
				hoverRead(live, room);
			}
			scene.frame(dt, { frameMs, isMoving });
			frameId = requestAnimationFrame(frame);
		};
		frameId = requestAnimationFrame(frame);
		const observer = new ResizeObserver(() => scene.resize());
		observer.observe(stage);
		// for a test, and for looking into it: what the room holds now
		stage.cvRoom = live;
		live.hoverElementGet = () => hoverRef.current;
		return () => {
			cancelAnimationFrame(frameId);
			observer.disconnect();
			disposeLayout();
			disposePlace();
			scene.dispose();
			liveRef.current = null;
			delete stage.cvRoom;
		};
		// one scene for the life of the component: the store is the same object throughout
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [store, room, Boolean(store.service)]);

	if (!portal || !service) return <p className="doc-error">CvPortalRoom is the component of a portal of a papers object.</p>;

	// what a click or Enter does to a thing of the room
	const act = (target) => {
		if (!target) return;
		// the drawer that is out, acted on again, is shut
		if (target.level === 'drawer' && store.drawer?.path === target.path && !store.file) store.up();
		else store.go(target.path);
	};
	const targetAtGet = (clientX, clientY) => liveRef.current?.scene.pick(clientX, clientY);
	const targetMiddleGet = () => {
		const rect = stageRef.current?.getBoundingClientRect();
		return rect ? targetAtGet(rect.left + rect.width / 2, rect.top + rect.height / 2) : undefined;
	};

	const pointerDownHandle = (event) => {
		const live = liveRef.current;
		if (!live || event.button !== 0) return;
		stageRef.current.focus({ preventScroll: true });
		live.drag = { x: event.clientX, y: event.clientY, xLast: event.clientX, yLast: event.clientY, isMoved: false };
		event.currentTarget.setPointerCapture?.(event.pointerId);
	};
	const pointerMoveHandle = (event) => {
		const live = liveRef.current;
		if (!live) return;
		// where the pointer is: the loop asks what is there once a frame, and the line beside it follows
		live.pointer = { clientX: event.clientX, clientY: event.clientY, isMoved: true };
		hoverPlace(hoverRef.current, live.pointer);
		const { drag } = live;
		if (!drag) return;
		if (!drag.isMoved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4) {
			drag.isMoved = true;
			room.hoverSet(undefined);
			live.scene.stateSet({ hoverPath: '' });
		}
		if (drag.isMoved) {
			// the reader looks around: a walk to a place under way is given up
			live.tween = undefined;
			live.pose.yaw -= (event.clientX - drag.xLast) * 0.0042;
			live.pose.pitch = Math.max(-1.15, Math.min(0.9, live.pose.pitch - (event.clientY - drag.yLast) * 0.0036));
		}
		drag.xLast = event.clientX;
		drag.yLast = event.clientY;
	};
	const pointerUpHandle = (event) => {
		const live = liveRef.current;
		if (!live?.drag) return;
		const { drag } = live;
		live.drag = undefined;
		event.currentTarget.releasePointerCapture?.(event.pointerId);
		if (!drag.isMoved) act(targetAtGet(event.clientX, event.clientY));
	};
	const keyDownHandle = (event) => {
		const live = liveRef.current;
		if (!live || event.metaKey || event.ctrlKey || event.altKey) return;
		const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
		if (KEY_WALK_LIST.includes(key)) {
			event.preventDefault();
			live.keySet.add(key);
			live.tween = undefined;
			return;
		}
		if (key === 'Enter' || key === 'e' || key === ' ') {
			event.preventDefault();
			act(room.hover ?? targetMiddleGet());
		} else if (key === 'Escape' || key === 'Backspace') {
			event.preventDefault();
			store.up();
		} else if (key === 'h' || key === '?') {
			room.helpToggle();
		}
	};
	const keyUpHandle = (event) => {
		liveRef.current?.keySet.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
	};
	// the wheel asks for a walk, which the loop makes over the next frames
	const wheelHandle = (event) => {
		const live = liveRef.current;
		if (!live) return;
		live.tween = undefined;
		const pixels = event.deltaMode === 1 ? event.deltaY * 40 : event.deltaMode === 2 ? event.deltaY * 800 : event.deltaY;
		live.glide += -pixels * WHEEL_METERS_PER_PIXEL;
	};

	const file = store.file;
	const folder = store.place?.level === 'folder' ? store.place : undefined;
	return (
		<div className="cv-room not-prose" data-device={portal.device} data-file-open={file || folder ? '' : undefined}>
			<div
				ref={stageRef}
				className="cv-room-stage"
				tabIndex={0}
				role="application"
				aria-label="The archive room: walk with W A S D, look by dragging, click a cabinet, a drawer or a folder"
				data-focused={room.isFocused ? '' : undefined}
				onPointerDown={pointerDownHandle}
				onPointerMove={pointerMoveHandle}
				onPointerUp={pointerUpHandle}
				onPointerLeave={() => {
					if (liveRef.current) liveRef.current.pointer = undefined;
					room.hoverSet(undefined);
					liveRef.current?.scene.stateSet({ hoverPath: '' });
				}}
				onKeyDown={keyDownHandle}
				onKeyUp={keyUpHandle}
				onWheel={wheelHandle}
				onFocus={() => room.focusedSet(true)}
				onBlur={() => { room.focusedSet(false); liveRef.current?.keySet.clear(); }}
			/>
			{room.problem ? <RoomFallback store={store} problem={room.problem} /> : null}
			<RoomPath store={store} />
			<div className="cv-room-tools">
				<button type="button" className="cv-room-button" aria-pressed={store.isEditing} disabled={!service.isWritable} title={service.isWritable ? 'Whether a paper taken out can be changed: cells typed, rows moved, parts added' : service.writeUnavailableReason} onClick={() => portal.editSet(!store.isEditing)}>
					<Pencil size={13} aria-hidden="true" /><span>{store.isEditing ? 'Editing' : 'Edit'}</span>
				</button>
				<button type="button" className="cv-room-button" title="The documents of this doc page" onClick={() => portal.docOpen()}>
					<BookOpen size={13} aria-hidden="true" /><span>Documents</span>
				</button>
				<button type="button" className="cv-room-button" aria-pressed={room.isHelpShown} title="The keys of the room (H)" onClick={() => room.helpToggle()}>
					<CircleHelp size={13} aria-hidden="true" />
				</button>
			</div>
			{/* always there, shown while something is pointed at: the loop moves it, React only says what it reads */}
			<div ref={hoverRef} className="cv-room-hover" hidden={!room.hover || Boolean(room.problem)}>
				<strong>{room.hover?.label}</strong>
				{room.hover?.detail ? <span>{room.hover.detail}</span> : null}
			</div>
			{room.isHelpShown && !room.problem ? (
				<div className="cv-room-help">
					<span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk</span>
					<span><kbd>←</kbd><kbd>→</kbd> turn</span>
					<span>drag: look</span>
					<span>click or <kbd>Enter</kbd>: open</span>
					<span><kbd>Esc</kbd> back</span>
					{room.renderer?.isSoftware ? (
						<span className="cv-room-help-warn" title={room.renderer.name}>drawn without the GPU: turn on the browser's graphics acceleration</span>
					) : room.renderer?.name ? <span className="cv-room-help-quiet" title={room.renderer.name}>{rendererShortGet(room.renderer.name)}</span> : null}
				</div>
			) : null}
			{file ? <RoomFile store={store} file={file} /> : null}
			{folder ? <RoomFolder store={store} folder={folder} /> : null}
		</div>
	);
});

const KEY_WALK_LIST = ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

// the GPU named short: "ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)" -> "Apple M4"
function rendererShortGet(name) {
	const inner = /^ANGLE \((.*)\)$/.exec(name)?.[1] ?? name;
	const partList = inner.split(',').map((part) => part.trim());
	const device = (partList[1] ?? partList[0]).replace(/^ANGLE \w+ Renderer:\s*/, '').replace(/\s*\(0x[0-9A-Fa-f]+\)/, '');
	return device.length > 40 ? `${device.slice(0, 39)}…` : device;
}

// what is under the pointer, asked of the scene: the room's state only when it is another thing
function hoverRead(live, room) {
	const target = live.scene.pick(live.pointer.clientX, live.pointer.clientY);
	room.hoverSet(target);
	live.scene.stateSet({ hoverPath: target?.path ?? '' });
}

// the line beside the pointer, moved where the pointer is
function hoverPlace(element, pointer) {
	if (!element || !pointer) return;
	element.style.transform = `translate(${Math.round(pointer.clientX + 14)}px, ${Math.round(pointer.clientY + 16)}px)`;
}

// the reader moved by a frame: along a walk to a place while one is under way, else by the keys held
function poseStep(live, dt) {
	if (live.tween) {
		const tween = live.tween;
		tween.time = Math.min(1, tween.time + dt / TWEEN_SECONDS);
		const ease = tween.time < 0.5 ? 2 * tween.time * tween.time : 1 - ((-2 * tween.time + 2) ** 2) / 2;
		// the shorter way round
		const yawDelta = Math.atan2(Math.sin(tween.to.yaw - tween.from.yaw), Math.cos(tween.to.yaw - tween.from.yaw));
		live.pose = {
			x: tween.from.x + (tween.to.x - tween.from.x) * ease,
			y: tween.from.y + (tween.to.y - tween.from.y) * ease,
			z: tween.from.z + (tween.to.z - tween.from.z) * ease,
			yaw: tween.from.yaw + yawDelta * ease,
			pitch: tween.from.pitch + (tween.to.pitch - tween.from.pitch) * ease,
		};
		if (tween.time >= 1) live.tween = undefined;
		return;
	}
	// the walk the wheel asked for: a part of what remains each frame; at a wall it ends
	if (live.glide !== 0) {
		const step = Math.abs(live.glide) < 0.002 ? live.glide : live.glide * (1 - Math.exp(-dt * WHEEL_GLIDE_RATE));
		const { x, z } = live.pose;
		poseMove(live, step, 0);
		live.glide = live.pose.x === x && live.pose.z === z ? 0 : live.glide - step;
	}
	const { keySet } = live;
	if (keySet.size === 0) return;
	const forward = (keySet.has('w') || keySet.has('ArrowUp') ? 1 : 0) - (keySet.has('s') || keySet.has('ArrowDown') ? 1 : 0);
	const side = (keySet.has('d') ? 1 : 0) - (keySet.has('a') ? 1 : 0);
	const turn = (keySet.has('ArrowLeft') ? 1 : 0) - (keySet.has('ArrowRight') ? 1 : 0);
	live.pose.yaw += turn * SPEED_TURN * dt;
	// walking, the reader stands up again from a drawer they bent over
	live.pose.y += (CV_ROOM_EYE_HEIGHT - live.pose.y) * (1 - Math.exp(-dt * 6));
	poseMove(live, forward * SPEED_WALK * dt, side * SPEED_WALK * dt);
}

// a step forward and to the side of where the reader looks, kept inside the room
function poseMove(live, forward, side) {
	const { yaw } = live.pose;
	const x = live.pose.x - Math.sin(yaw) * forward + Math.cos(yaw) * side;
	const z = live.pose.z - Math.cos(yaw) * forward - Math.sin(yaw) * side;
	Object.assign(live.pose, cvRoomPositionClamp(live.layout, x, z));
}

// the way down to the place, at the top of the room: every step a click away, with or without 3D
const RoomPath = observer(function RoomPath({ store }) {
	const ancestorList = store.ancestorList;
	return (
		<nav className="cv-room-path" aria-label="Where this is in the archive">
			{ancestorList.map((place, index) => (
				<span key={place.path} className="cv-room-path-step">
					{index > 0 ? <ChevronRight size={12} aria-hidden="true" /> : null}
					<button type="button" aria-current={index === ancestorList.length - 1 ? 'page' : undefined} onClick={() => store.go(place.path)}>{place.label}</button>
				</span>
			))}
		</nav>
	);
});

// a folder taken out: its paper laid beside the room, on its sheet; the profile at its values
const RoomFile = observer(function RoomFile({ store, file }) {
	const { portal, service } = store;
	const drawer = cvArchiveDrawerGet(file.drawerId);
	const isPaper = file.drawerId === 'cv' || file.drawerId === 'we';
	return (
		<aside className="cv-room-file" aria-label={file.label}>
			<header className="cv-room-file-head">
				<span className="cv-room-file-kind">{drawer?.labelNative}</span>
				<strong>{file.label}</strong>
				<span className="cv-room-file-path">{file.path}</span>
				<button type="button" className="cv-room-button" title="Put the folder back (Esc)" aria-label="Put the folder back" onClick={() => store.up()}><X size={14} aria-hidden="true" /></button>
			</header>
			<div className="cv-room-file-body">
				{isPaper ? (
					<ObjectFrontendMode object={service.ref} mode="sheet" param={{ instance: file.path, isPaperChoiceHidden: true }} docState={portal.docState} instanceKey={`room:${portal.id}`} />
				) : file.drawerId === 'profile' ? (
					<ObjectFrontendMode object={file.meta.profileRef} mode="info" param={{ partition: file.partition, heightMax: 520 }} docState={portal.docState} instanceKey={`room:${portal.id}:${file.partition}`} />
				) : (
					<p className="cv-room-file-note">A template of a {file.meta.form === 'we' ? 'work experience' : 'CV'}: {file.meta.sectionCount} part{file.meta.sectionCount === 1 ? '' : 's'}. It says what a paper of it looks like; a paper is where it is drawn.</p>
				)}
			</div>
		</aside>
	);
});

// a folder taken out: what it holds, in its order, each a click away (FolderView of react-comp-misc)
const ROOM_FOLDER_COLUMN_LIST = [{ id: 'name', label: 'Name', width: 240 }, { id: 'detail', label: 'What it says', width: 220 }];
const RoomFolder = observer(function RoomFolder({ store, folder }) {
	const childList = store.archive.childListGet(folder.path);
	const rowById = new Map(childList.map((place) => [place.path, place]));
	const folderData = {
		columns: Object.fromEntries(ROOM_FOLDER_COLUMN_LIST.map((column) => [column.id, { data: column.label }])),
		colsOrder: ROOM_FOLDER_COLUMN_LIST.map((column) => column.id),
		rows: childList.map((place) => ({ id: place.path, data: {} })),
		rowIdsSelected: [],
		getRowData: (rowId) => rowById.get(rowId),
	};
	const folderConfig = {
		colSizeById: Object.fromEntries(ROOM_FOLDER_COLUMN_LIST.map((column) => [column.id, { width: column.width, minWidth: 80, resizable: false }])),
		colWidthById: Object.fromEntries(ROOM_FOLDER_COLUMN_LIST.map((column) => [column.id, column.width])),
		isLastColFilled: true,
		isListOnly: true,
		isStatusBarVisible: false,
		selectionMode: 'none',
		isContextMenuBuiltInDisabled: true,
		compBodyByColId: roomFolderCellCompGet,
	};
	return (
		<aside className="cv-room-file" aria-label={folder.label}>
			<header className="cv-room-file-head">
				<span className="cv-room-file-kind">folder</span>
				<strong className={folder.meta.isNameDefault ? 'cv-room-name-default' : undefined}>{folder.label}</strong>
				<span className="cv-room-file-path">{store.archive.countGet(folder.path)} paper{store.archive.countGet(folder.path) === 1 ? '' : 's'}</span>
				<button type="button" className="cv-room-button" title="Put the folder back (Esc)" aria-label="Put the folder back" onClick={() => store.up()}><X size={14} aria-hidden="true" /></button>
			</header>
			<div className="cv-room-file-body">
				{childList.length === 0
					? <p className="cv-room-file-note">This folder is empty. Papers are filed in it at the desk.</p>
					: (
						<div className="cv-room-folder-table">
							<FolderView data={folderData} config={folderConfig} onEvent={async (eventType, eventData) => { if (eventType === 'rowClick' && rowById.has(eventData?.rowId)) store.go(eventData.rowId); return { code: 0 }; }} />
						</div>
					)}
			</div>
		</aside>
	);
});

function RoomFolderCell({ data: place, colId }) {
	if (!place) return null;
	if (colId === 'name') {
		const Icon = place.level === 'folder' ? Folder : FileText;
		return <span className="cv-room-folder-name"><Icon size={14} aria-hidden="true" data-folder={place.level === 'folder' ? '' : undefined} /><span className={place.meta?.isNameDefault ? 'cv-room-name-default' : undefined}>{place.label}</span></span>;
	}
	return <span className="cv-room-folder-detail">{place.detail}</span>;
}
const roomFolderCellCompGet = () => RoomFolderCell;

// a window without 3D: the places of the archive as a list, level by level
const RoomFallback = observer(function RoomFallback({ store, problem }) {
	const place = store.placeShown;
	const childList = place && place.level !== 'file' ? store.archive.childListGet(place.path) : [];
	return (
		<div className="cv-room-fallback">
			<p>{problem} The archive is listed instead.</p>
			<ul>
				{childList.map((child) => (
					<li key={child.path}><button type="button" className="cv-room-button" onClick={() => store.go(child.path)}>{child.label}</button> <span>{child.detail}</span></li>
				))}
			</ul>
		</div>
	);
});
