import assert from 'node:assert/strict';
import test from 'node:test';
import { cvArchiveArrangeRead, cvArchiveBuild } from '../archive/CvArchiveModel.js';
import { CV_ROOM_DRAWER_TRAVEL, cvRoomFindGet, cvRoomLayoutBuild, cvRoomLayoutKeyGet, cvRoomPositionClamp, cvRoomStandGet } from './CvRoomLayout.js';

// The archive room as geometry (doc/cv-portal.md#the-archive-room): no canvas is needed to say
// where a cabinet stands and where a reader looks from.

const itemListOf = (count) => Array.from({ length: count }, (_, index) => ({ key: `cv-${index}`, kind: 'cv', name: `CV ${index}`, pathList: [`/example/cv/paper-${index}`] }));
const archive = cvArchiveBuild({
	partitionList: [{ id: 'example', label: 'Example' }, { id: 'real', label: 'My data', isGitIgnored: true }],
	itemList: [...itemListOf(3), { key: 'we-1', kind: 'we', name: 'WE', pathList: ['/example/we/general'] }, { key: 'cv-r', kind: 'cv', name: '2026', pathList: ['/real/cv/2026'] }],
});
const layout = cvRoomLayoutBuild(archive);

test('a cabinet per cabinet of the archive, side by side at the back wall, about the middle', () => {
	assert.deepEqual(layout.cabinetList.map((one) => one.path), ['/example', '/real']);
	const [first, second] = layout.cabinetList;
	assert.ok(first.x < 0 && second.x > 0);
	assert.ok(Math.abs(first.x + second.x) < 1e-9);
	// they do not touch, and stand against the back wall, facing the reader
	assert.ok(second.x - first.x > first.width);
	assert.ok(first.z - first.depth / 2 > layout.room.zBack);
	assert.equal(first.zFace, first.z + first.depth / 2);
	assert.equal(second.isGitIgnored, true);
	assert.ok(layout.room.width >= 8);
});

test('the drawers of a cabinet are stacked, the first on top, and reach neither floor nor top', () => {
	const [cabinet] = layout.cabinetList;
	assert.deepEqual(cabinet.drawerList.map((one) => one.drawerId), ['cv', 'we', 'template']);
	const yList = cabinet.drawerList.map((one) => one.y);
	assert.ok(yList[0] > yList[1] && yList[1] > yList[2]);
	assert.ok(yList[2] - cabinet.drawerList[2].height / 2 > 0);
	assert.ok(yList[0] + cabinet.drawerList[0].height / 2 < cabinet.height);
	assert.equal(cabinet.drawerList[0].count, 3);
});

test('the folders of a drawer hang one behind another; what has no room is counted', () => {
	const drawer = layout.cabinetList[0].drawerList[0];
	assert.deepEqual(drawer.fileList.map((one) => one.path), ['/example/cv/paper-0', '/example/cv/paper-1', '/example/cv/paper-2']);
	assert.ok(drawer.fileList[1].zOffset > drawer.fileList[0].zOffset);
	assert.deepEqual(drawer.fileList.map((one) => one.tabSlot), [0, 1, 2]);
	assert.equal(drawer.countHidden, 0);
	const many = cvRoomLayoutBuild(cvArchiveBuild({ partitionList: [{ id: 'example', label: 'Example' }], itemList: itemListOf(40) }));
	const drawerMany = many.cabinetList[0].drawerList[0];
	assert.equal(drawerMany.count, 40);
	assert.equal(drawerMany.fileList.length + drawerMany.countHidden, 40);
	// the last folder still hangs inside the drawer
	assert.ok(drawerMany.fileList.at(-1).zOffset < drawerMany.depth);
});

test('a path names its furniture', () => {
	assert.deepEqual(Object.keys(cvRoomFindGet(layout, '/')), []);
	assert.equal(cvRoomFindGet(layout, '/real').cabinet.path, '/real');
	assert.equal(cvRoomFindGet(layout, '/example/we').drawer.drawerId, 'we');
	const found = cvRoomFindGet(layout, '/example/cv/paper-1');
	assert.equal(found.file.index, 1);
	assert.equal(found.drawer.path, '/example/cv');
	// a file the drawer has no folder for names its drawer
	assert.equal(cvRoomFindGet(layout, '/example/cv/gone').file, undefined);
	assert.equal(cvRoomFindGet(layout, '/example/cv/gone').drawer.path, '/example/cv');
});

test('a reader stands nearer the deeper the place, and looks at it', () => {
	const room = cvRoomStandGet(layout, '/');
	const cabinet = cvRoomStandGet(layout, '/real');
	const drawer = cvRoomStandGet(layout, '/real/cv');
	const file = cvRoomStandGet(layout, '/real/cv/2026');
	const zFace = layout.cabinetList[1].zFace;
	assert.equal(room.x, 0);
	assert.ok(Math.abs(room.yaw) < 1e-9);
	assert.equal(cabinet.x, layout.cabinetList[1].x);
	assert.ok(room.z > cabinet.z && cabinet.z > drawer.z && drawer.z > file.z);
	// never inside the drawer that came out
	assert.ok(file.z > zFace + CV_ROOM_DRAWER_TRAVEL);
	// a drawer and what hangs in it are looked down into, a cabinet less so, the room nearly level
	assert.ok(drawer.pitch < -0.5 && file.pitch < -0.5 && cabinet.pitch > drawer.pitch && room.pitch > cabinet.pitch);
	// bent over a drawer, the eye is above its top; standing elsewhere
	const drawerTop = layout.cabinetList[1].drawerList[0].y + layout.cabinetList[1].drawerList[0].height / 2;
	assert.ok(drawer.y > drawerTop + 0.4);
	assert.equal(room.y, cabinet.y);
	// straight in front of it: no turn
	assert.ok(Math.abs(drawer.yaw) < 1e-9);
});

test('a reader stays inside the walls and out of the cabinets', () => {
	const zFace = layout.cabinetList[0].zFace;
	assert.ok(cvRoomPositionClamp(layout, 0, -100).z > zFace);
	assert.ok(cvRoomPositionClamp(layout, 0, 100).z < layout.room.zFront);
	assert.ok(cvRoomPositionClamp(layout, 100, 0).x < layout.room.width / 2);
	assert.deepEqual(cvRoomPositionClamp(layout, 0.5, 1), { x: 0.5, z: 1 });
});

test('the key of a layout changes with what is drawn, not with what is read', () => {
	const key = cvRoomLayoutKeyGet(layout);
	assert.equal(cvRoomLayoutKeyGet(cvRoomLayoutBuild(archive)), key);
	const renamed = cvArchiveBuild({ partitionList: [{ id: 'example', label: 'Example' }], itemList: [{ key: 'cv-0', kind: 'cv', name: 'Another name', pathList: ['/example/cv/paper-0'] }] });
	assert.notEqual(cvRoomLayoutKeyGet(cvRoomLayoutBuild(renamed)), key);
});

test('a folder of the filing hangs in its drawer in its order; what is filed in it, however deep, lifts it', () => {
	const archiveFiled = cvArchiveBuild({
		partitionList: [{ id: 'example', label: 'Example' }],
		itemList: itemListOf(3),
		arrangeByPartition: {
			example: cvArchiveArrangeRead({
				folderList: [{ id: 'f1', name: 'Applied', drawer: 'cv', rank: 'i' }, { id: 'f2', name: 'Inner', drawer: 'cv', parent: 'f1' }],
				placeByKey: { 'cv-0': { rank: 'c' }, 'cv-1': { folder: 'f2' } },
			}),
		},
	});
	const layoutFiled = cvRoomLayoutBuild(archiveFiled);
	const drawer = layoutFiled.cabinetList[0].drawerList.find((one) => one.drawerId === 'cv');
	assert.deepEqual(drawer.fileList.map((file) => [file.path, file.isFolder, file.count]), [['/example/cv/paper-0', false, 1], ['/example/cv/folder:f1', true, 1], ['/example/cv/paper-2', false, 1]]);
	assert.equal(drawer.count, 3);
	assert.deepEqual(drawer.fileList[1].memberPathList, ['/example/cv/folder:f2', '/example/cv/paper-1']);
	// a paper two folders deep, and the folder inside, name the folder hanging in the drawer
	assert.equal(cvRoomFindGet(layoutFiled, '/example/cv/paper-1').file.path, '/example/cv/folder:f1');
	assert.equal(cvRoomFindGet(layoutFiled, '/example/cv/folder:f2').file.path, '/example/cv/folder:f1');
	assert.equal(cvRoomFindGet(layoutFiled, '/example/cv/paper-0').file.path, '/example/cv/paper-0');
	// the filing changed, the furniture is built again
	assert.notEqual(cvRoomLayoutKeyGet(layoutFiled), cvRoomLayoutKeyGet(cvRoomLayoutBuild(cvArchiveBuild({ partitionList: [{ id: 'example', label: 'Example' }], itemList: itemListOf(3) }))));
});
