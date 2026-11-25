// The archive room: where everything of the archive stands (doc/cv-portal.md#the-archive-room).
//
// The room is the archive (archive/CvArchiveModel.js) given a body, level by level:
//
//   archive   the room
//   cabinet   a file cabinet standing at the back wall, a sign above it        (a partition)
//   drawer    a drawer of that cabinet, the first on top, its label on it      (a sort of paper)
//   file      a hanging folder in that drawer, its name on its tab             (a paper)
//   folder    a hanging folder of another color holding the papers filed in it, in the order of the
//             drawer (doc/cv-portal.md#folders): what lies deeper is in it, so a paper of a folder lifts
//             the folder it is in, and the folder's contents are listed beside the room
//
// This module is the geometry only, in meters, with no drawing in it: what the scene builds
// (CvRoomScene.js) and where a reader stands to look at a place are both read off it, and a test
// reads it without a canvas. x runs along the back wall, y up, z from the back wall toward the
// reader (the cabinets face +z).

export const CV_ROOM_EYE_HEIGHT = 1.6;
const ROOM_HEIGHT = 3.1;
const ROOM_DEPTH = 8.4;
const ROOM_WIDTH_MIN = 8;
const CABINET_WIDTH = 0.92;
const CABINET_DEPTH = 0.72;
const CABINET_GAP = 0.56;
const CABINET_BASE = 0.1;
const CABINET_TOP = 0.05;
// low enough that a reader looks down into the top drawer too (the eye is at CV_ROOM_EYE_HEIGHT)
const DRAWER_HEIGHT = 0.33;
// how far a drawer comes out when it is open
export const CV_ROOM_DRAWER_TRAVEL = 0.58;
// the folders of a drawer: from its front toward its back, as many as have room
const FILE_GAP = 0.038;
const FILE_FIRST = 0.07;
// a folder with its tab stays below the top of its drawer's front: nothing shows of a shut drawer
const FILE_HEIGHT = 0.16;
const FILE_COUNT_MAX = 15;
// how far a folder is lifted out of its drawer when it is the file open
export const CV_ROOM_FILE_LIFT = 0.2;

// The room of an archive:
//   { room: { width, depth, height, zBack, zFront },
//     cabinetList: [{ path, label, detail, isGitIgnored, x, z, width, depth, height, zFace,
//       drawerList: [{ path, label, labelNative, drawerId, count, y, height, width, depth, zFace,
//         fileList: [{ path, label, detail, kind, isFolder, count, memberPathList, index, zOffset, tabSlot }], countHidden }] }] }
// x, z of a cabinet: the middle of its footprint; zFace: its front face; y of a drawer: its middle;
// zOffset of a folder: how far behind the front of its drawer it hangs; countHidden: the files of
// a drawer that have no room in it (they are in the archive, and listed by the other portal);
// a folder of the archive: isFolder, the papers in it (count), every place inside it (memberPathList)
export function cvRoomLayoutBuild(archive) {
	const cabinetCount = archive.cabinetList.length;
	const span = cabinetCount * CABINET_WIDTH + Math.max(0, cabinetCount - 1) * CABINET_GAP;
	const width = Math.max(ROOM_WIDTH_MIN, span + 4);
	const zBack = -ROOM_DEPTH / 2;
	const zCabinet = zBack + 0.04 + CABINET_DEPTH / 2;
	const zFace = zCabinet + CABINET_DEPTH / 2;
	const cabinetList = archive.cabinetList.map((cabinet, index) => {
		const x = -span / 2 + CABINET_WIDTH / 2 + index * (CABINET_WIDTH + CABINET_GAP);
		const drawerPlaceList = archive.childListGet(cabinet.path);
		const height = CABINET_BASE + drawerPlaceList.length * DRAWER_HEIGHT + CABINET_TOP;
		const drawerList = drawerPlaceList.map((drawer, drawerIndex) => {
			const filePlaceList = archive.childListGet(drawer.path);
			return {
				path: drawer.path,
				label: drawer.label,
				labelNative: drawer.labelNative ?? '',
				drawerId: drawer.drawerId,
				count: archive.countGet(drawer.path),
				// the first drawer on top
				y: CABINET_BASE + (drawerPlaceList.length - 1 - drawerIndex + 0.5) * DRAWER_HEIGHT,
				height: DRAWER_HEIGHT,
				width: CABINET_WIDTH - 0.06,
				depth: CABINET_DEPTH - 0.06,
				zFace,
				fileList: filePlaceList.slice(0, FILE_COUNT_MAX).map((file, fileIndex) => ({
					path: file.path,
					label: file.label,
					detail: file.detail,
					kind: file.kind,
					isFolder: file.level === 'folder',
					count: file.level === 'folder' ? archive.countGet(file.path) : 1,
					memberPathList: file.level === 'folder' ? memberPathListGet(archive, file.path) : [],
					index: fileIndex,
					zOffset: FILE_FIRST + fileIndex * FILE_GAP,
					// its tab stands in one of three places across the folder, so the tabs of neighbours do not hide each other
					tabSlot: fileIndex % 3,
				})),
				countHidden: Math.max(0, filePlaceList.length - FILE_COUNT_MAX),
			};
		});
		return {
			path: cabinet.path, label: cabinet.label, detail: cabinet.detail, isGitIgnored: cabinet.meta?.isGitIgnored === true,
			x, z: zCabinet, width: CABINET_WIDTH, depth: CABINET_DEPTH, height, zFace, drawerList,
		};
	});
	return { room: { width, depth: ROOM_DEPTH, height: ROOM_HEIGHT, zBack, zFront: ROOM_DEPTH / 2 }, cabinetList, fileHeight: FILE_HEIGHT };
}

// every place inside a folder, deeper folders and what they hold too
function memberPathListGet(archive, path) {
	return archive.childListGet(path).flatMap((child) => [child.path, ...(child.level === 'folder' ? memberPathListGet(archive, child.path) : [])]);
}

// the hanging folder of a drawer a path is: its own, or the folder of the drawer it is filed in
function fileOfDrawerGet(drawer, path) {
	return drawer.fileList.find((file) => file.path === path || file.memberPathList.includes(path));
}

// the furniture a path names: { cabinet?, drawer?, file? }, each undefined above its level or
// where the room has none (a file with no room in its drawer names its drawer); a paper or a folder
// filed in a folder names the folder hanging in the drawer
export function cvRoomFindGet(layout, path) {
	for (const cabinet of layout.cabinetList) {
		if (path === cabinet.path) return { cabinet };
		for (const drawer of cabinet.drawerList) {
			if (path === drawer.path) return { cabinet, drawer };
			if (path.startsWith(`${drawer.path}/`)) return { cabinet, drawer, file: fileOfDrawerGet(drawer, path) };
		}
	}
	// a file of a path that does not lie under its drawer's (a paper filed under no partition)
	for (const cabinet of layout.cabinetList) {
		for (const drawer of cabinet.drawerList) {
			const file = fileOfDrawerGet(drawer, path);
			if (file) return { cabinet, drawer, file };
		}
	}
	return {};
}

// where a reader stands to look at a place, and at what: { x, y, z, yaw, pitch } of the eye (y:
// its height, CV_ROOM_EYE_HEIGHT while standing; yaw 0 looks at the back wall, pitch below 0 looks down).
//   the room      from its middle, the whole wall of cabinets in view
//   a cabinet     in front of it, all of it in view
//   a drawer      at it, bent over it: the eye a little above its top (on tiptoe at a high
//                 drawer, crouched at a low one), looking down at what hangs in it
//   a file        the same, looking at the folder lifted out of it
export function cvRoomStandGet(layout, path) {
	const { cabinet, drawer, file } = cvRoomFindGet(layout, path);
	const eye = CV_ROOM_EYE_HEIGHT;
	if (!cabinet) return lookAtGet({ x: 0, y: eye, z: Math.min(layout.room.zFront - 1.2, layout.room.zBack + 5.4) }, { x: 0, y: eye - 0.2, z: layout.room.zBack });
	if (!drawer) return lookAtGet({ x: cabinet.x, y: eye, z: cabinet.zFace + 2.3 }, { x: cabinet.x, y: cabinet.height / 2 + 0.25, z: cabinet.zFace });
	const zDrawerFront = drawer.zFace + CV_ROOM_DRAWER_TRAVEL;
	const yOver = Math.max(1.02, Math.min(1.86, drawer.y + drawer.height / 2 + 0.62));
	if (!file) return lookAtGet({ x: cabinet.x, y: yOver, z: zDrawerFront + 0.3 }, { x: cabinet.x, y: drawer.y + 0.04, z: zDrawerFront - 0.26 });
	return lookAtGet({ x: cabinet.x, y: yOver, z: zDrawerFront + 0.26 }, { x: cabinet.x, y: drawer.y + 0.2, z: zDrawerFront - file.zOffset });
}

function lookAtGet(eye, target) {
	const dx = target.x - eye.x;
	const dz = target.z - eye.z;
	const dy = target.y - eye.y;
	return { x: eye.x, y: eye.y, z: eye.z, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

// where a reader may stand: inside the walls, and not inside the cabinets (in front of their faces)
export function cvRoomPositionClamp(layout, x, z) {
	const { room } = layout;
	const margin = 0.35;
	const zFaceFront = layout.cabinetList.length > 0 ? layout.cabinetList[0].zFace + 0.42 : room.zBack + margin;
	return {
		x: Math.max(-room.width / 2 + margin, Math.min(room.width / 2 - margin, x)),
		z: Math.max(zFaceFront, Math.min(room.zFront - margin, z)),
	};
}

// what of the layout decides the meshes: built again only when this text is another one
export function cvRoomLayoutKeyGet(layout) {
	return JSON.stringify(layout.cabinetList.map((cabinet) => [cabinet.path, cabinet.label, cabinet.isGitIgnored, cabinet.drawerList.map((drawer) => [drawer.path, drawer.label, drawer.count, drawer.fileList.map((file) => [file.path, file.label, file.count, file.memberPathList])])]));
}
