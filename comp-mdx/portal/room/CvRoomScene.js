import * as THREE from 'three';
import { CV_ROOM_DRAWER_TRAVEL, CV_ROOM_EYE_HEIGHT, CV_ROOM_FILE_LIFT } from './CvRoomLayout.js';

// The archive room drawn (doc/cv-portal.md#the-archive-room): three.js meshes built from a layout
// (CvRoomLayout.js), and nothing of the archive known here beyond it. The scene has three inputs,
// and what it shows is a function of them:
//
//   layoutSet(layout)   what stands in the room: built again only when the layout is another one
//   stateSet({ drawerOpenPath, fileOpenPath, hoverPath })
//                       which drawer is out, which folder is lifted, what the pointer is on: the
//                       drawer and the folder move toward that state a little every frame
//   poseSet({ x, z, yaw, pitch })   where the reader stands and looks
//
// and one question: pick(clientX, clientY) -> what of the archive is under a point of the window
// ({ path, level, label, detail }). Walking, keys, the address and the archive are the component's
// (CvPortalRoom.jsx).
//
// What a frame costs (measured on an Apple M4, a window of 1920 x 1080 at density 2): the GPU
// 7.6 ms for the whole room with its shadows at 3840 x 2160 pixels, 2.1 ms at 1920 x 1080, about
// 180 draw calls; the script almost nothing. What made it stutter was never the drawing:
//   a change of the canvas's size   reallocates its buffers (antialiased: several of them): 4 to
//                                 30 ms on the main thread, and a frame dropped. The density is
//                                 therefore one, chosen once, and lowered (a step, never raised
//                                 again) only when frames keep coming slowly in motion: never
//                                 switched between moving and resting
//   a shader compiled at first sight   three.js compiles a material's program the first time it is
//                                 drawn: a drawer's contents seen for the first time stalled
//                                 150 to 250 ms. every program is compiled when the furniture is built
// and the scene draws only when something changed (frame()): the reader moved or looks elsewhere,
// a drawer or a folder is still moving, the pointer is on another thing, the size changed, the
// furniture was built again; a room nobody moves in costs nothing. The shadow map is drawn again
// only while the furniture moves (a drawer coming out), never because the reader moves.
//
// A browser without a GPU for WebGL (hardware acceleration off, a remote desktop, no driver) draws
// with the CPU (SwiftShader): the same frame took 45 ms at 1920 x 1080, density 1. The room is then
// drawn plainly (isSoftware): no antialiasing (45 -> 33 ms), no shadows (-> 17 ms), and a density
// that may go down to PIXEL_RATIO_MIN_SOFTWARE; its materials stay (Lambert in their place saved
// 1 ms and drew the room flat). Whether it is, is asked before the renderer is made (antialiasing
// is chosen when its context is), of a context made for the question and let go at once.
const COLOR_BY_CABINET = [0x5d7a6c, 0x4e6a8a, 0xa58a5c, 0x7a5d6c, 0x5c7f86];
const COLOR_FOLDER_BY_KIND = { cv: 0xe2c58a, we: 0x9db7d6, template: 0xa9c9a0, profile: 0xf1ece0 };
// a folder of the reader's filing: kraft board, its tab dark with light words, so it reads apart from a paper
const COLOR_FOLDER_FILING = 0xa8743a;
const TAB_FILING = { background: '#3b2c1c', color: '#f6e6c4' };
const COLOR_HOVER = 0x3b2a08;
// the density of the canvas (canvas pixels per css pixel): the screen's own up to the most; a step
// lower when the median of PIXEL_RATIO_FRAME_COUNT frames drawn one after another in motion is
// slower than PIXEL_RATIO_FRAME_SLOW_MS (under 40 a second), down to the least
const PIXEL_RATIO_MAX = 2;
const PIXEL_RATIO_MIN = 0.75;
const PIXEL_RATIO_MIN_SOFTWARE = 0.5;
// the names of renderers drawing with the CPU
const RENDERER_SOFTWARE_PATTERN = /swiftshader|llvmpipe|software|basic render/i;
const PIXEL_RATIO_STEP = 0.25;
const PIXEL_RATIO_FRAME_SLOW_MS = 25;
const PIXEL_RATIO_FRAME_COUNT = 20;

export class CvRoomScene {
	constructor(container) {
		this.container = container;
		// drawn by the GPU, or plainly by the CPU (see above)
		const probe = rendererProbe();
		this.isSoftware = probe.isSoftware;
		this.renderer = new THREE.WebGLRenderer({ antialias: !this.isSoftware, powerPreference: 'high-performance' });
		this.rendererName = rendererNameGet(this.renderer.getContext()) || probe.name;
		this.isSoftware = this.isSoftware || RENDERER_SOFTWARE_PATTERN.test(this.rendererName);
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.05;
		this.renderer.shadowMap.enabled = !this.isSoftware;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		// drawn when the furniture moves (shadowDirty), never because the reader does
		this.renderer.shadowMap.autoUpdate = false;
		this.renderer.shadowMap.needsUpdate = true;
		// the density: one, lowered only when the GPU does not keep up (pixelRatioLearn); drawn by the
		// CPU, one canvas pixel per css pixel at most from the start
		this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.isSoftware ? 1 : PIXEL_RATIO_MAX);
		this.pixelRatioMin = this.isSoftware ? PIXEL_RATIO_MIN_SOFTWARE : PIXEL_RATIO_MIN;
		this.renderer.setPixelRatio(this.pixelRatio);
		// what frame() decides from: a frame is owed, the frame times measured in motion
		this.isDirty = true;
		this.frameMsList = [];
		this.isRenderedLast = false;
		this.poseLast = undefined;
		this.renderer.domElement.className = 'cv-room-canvas';
		container.appendChild(this.renderer.domElement);
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0x1d1a16);
		this.scene.fog = new THREE.Fog(0x1d1a16, 9, 22);
		this.camera = new THREE.PerspectiveCamera(62, 1, 0.05, 60);
		this.camera.rotation.order = 'YXZ';
		this.raycaster = new THREE.Raycaster();
		// what is made for one layout, and thrown away with it
		this.furniture = new THREE.Group();
		this.scene.add(this.furniture);
		this.roomGroup = new THREE.Group();
		this.scene.add(this.roomGroup);
		this.disposableList = [];
		this.roomDisposableList = [];
		this.pickList = [];
		this.drawerByPath = new Map();
		this.fileByPath = new Map();
		this.state = { drawerOpenPath: '', fileOpenPath: '', hoverPath: '' };
		this.hoverMaterialList = [];
		this.resize();
	}

	// ---------- what stands in the room ----------

	layoutSet(layout) {
		this.layout = layout;
		this.groupClear(this.furniture, this.disposableList);
		this.groupClear(this.roomGroup, this.roomDisposableList);
		this.pickList = [];
		this.drawerByPath = new Map();
		this.fileByPath = new Map();
		this.roomBuild(layout.room);
		layout.cabinetList.forEach((cabinet, index) => this.cabinetBuild(cabinet, COLOR_BY_CABINET[index % COLOR_BY_CABINET.length]));
		this.stateApply(true);
		// every program now, not at the first sight of what uses it (a stall in the middle of a look)
		this.renderer.compile(this.scene, this.camera);
		this.renderer.shadowMap.needsUpdate = true;
		this.isDirty = true;
	}

groupClear(group, disposableList) {
		group.clear();
		for (const one of disposableList.splice(0)) one.dispose();
	}

	// a thing to dispose of with the layout it was made for
	keep(thing, list = this.disposableList) {
		list.push(thing);
		return thing;
	}

	roomBuild(room) {
		const keep = (thing) => this.keep(thing, this.roomDisposableList);
		const { width, depth, height, zBack } = room;
		const floorTexture = keep(woodTextureMake());
		floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
		floorTexture.repeat.set(width / 2.4, depth / 2.4);
		const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(width, depth)), keep(new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.78, metalness: 0.02 })));
		floor.rotation.x = -Math.PI / 2;
		floor.receiveShadow = true;
		this.roomGroup.add(floor);
		const wallMaterial = keep(new THREE.MeshStandardMaterial({ color: 0xd9d2c3, roughness: 0.95 }));
		const wallAdd = (w, h, x, y, z, rotationY) => {
			const wall = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, h)), wallMaterial);
			wall.position.set(x, y, z);
			wall.rotation.y = rotationY;
			wall.receiveShadow = true;
			this.roomGroup.add(wall);
		};
		wallAdd(width, height, 0, height / 2, zBack, 0);
		wallAdd(width, height, 0, height / 2, zBack + depth, Math.PI);
		wallAdd(depth, height, -width / 2, height / 2, 0, Math.PI / 2);
		wallAdd(depth, height, width / 2, height / 2, 0, -Math.PI / 2);
		const ceiling = new THREE.Mesh(keep(new THREE.PlaneGeometry(width, depth)), keep(new THREE.MeshStandardMaterial({ color: 0xece7dc, roughness: 1 })));
		ceiling.rotation.x = Math.PI / 2;
		ceiling.position.y = height;
		this.roomGroup.add(ceiling);
		// a dark skirting board along the back wall, and a wainscot line above the cabinets
		const trimMaterial = keep(new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.7 }));
		const skirting = new THREE.Mesh(keep(new THREE.BoxGeometry(width, 0.12, 0.03)), trimMaterial);
		skirting.position.set(0, 0.06, zBack + 0.015);
		this.roomGroup.add(skirting);
		// a rug in front of the cabinets
		const rug = new THREE.Mesh(keep(new THREE.PlaneGeometry(Math.min(width - 2.4, 6.4), 2.6)), keep(new THREE.MeshStandardMaterial({ color: 0x6c2f2a, roughness: 1 })));
		rug.rotation.x = -Math.PI / 2;
		rug.position.set(0, 0.004, zBack + 2.6);
		rug.receiveShadow = true;
		this.roomGroup.add(rug);
		// lamps: two long ones on the ceiling, lit
		// two lamps on the ceiling, one light between them: every light is paid for at every pixel
		const lampMaterial = keep(new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffe2a8, emissiveIntensity: 0.9 }));
		for (const z of [zBack + 1.9, zBack + 4.4]) {
			const lamp = new THREE.Mesh(keep(new THREE.BoxGeometry(Math.min(width - 4, 2.6), 0.04, 0.22)), lampMaterial);
			lamp.position.set(0, height - 0.03, z);
			this.roomGroup.add(lamp);
		}
		const light = new THREE.PointLight(0xffe7bd, 40, 13, 1.7);
		light.position.set(0, height - 0.3, zBack + 2.9);
		this.roomGroup.add(light);
		this.roomGroup.add(new THREE.HemisphereLight(0xfff4e0, 0x3b342b, 0.95));
		const sun = new THREE.DirectionalLight(0xffffff, 0.9);
		sun.position.set(2.5, 5, zBack + 6);
		sun.target.position.set(0, 0.8, zBack + 0.5);
		sun.castShadow = true;
		sun.shadow.mapSize.set(1024, 1024);
		sun.shadow.camera.left = -width / 2;
		sun.shadow.camera.right = width / 2;
		sun.shadow.camera.top = 5;
		sun.shadow.camera.bottom = -5;
		sun.shadow.bias = -0.0015;
		this.roomGroup.add(sun, sun.target);
		// a reading table at the side, with a lamp on it: where a paper is read, were it paper
		const tableX = width / 2 - 1.5;
		const tableZ = zBack + 4.6;
		const woodMaterial = keep(new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.6 }));
		const top = new THREE.Mesh(keep(new THREE.BoxGeometry(1.5, 0.05, 0.8)), woodMaterial);
		top.position.set(tableX, 0.74, tableZ);
		top.castShadow = true;
		top.receiveShadow = true;
		this.roomGroup.add(top);
		const legGeometry = keep(new THREE.BoxGeometry(0.06, 0.72, 0.06));
		for (const [dx, dz] of [[-0.68, -0.33], [0.68, -0.33], [-0.68, 0.33], [0.68, 0.33]]) {
			const leg = new THREE.Mesh(legGeometry, woodMaterial);
			leg.position.set(tableX + dx, 0.36, tableZ + dz);
			leg.castShadow = true;
			this.roomGroup.add(leg);
		}
		const shade = new THREE.Mesh(keep(new THREE.ConeGeometry(0.13, 0.16, 20, 1, true)), keep(new THREE.MeshStandardMaterial({ color: 0x2f5d4a, emissive: 0x10261d, side: THREE.DoubleSide, roughness: 0.5 })));
		shade.position.set(tableX + 0.5, 1.12, tableZ - 0.22);
		const stand = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 8)), keep(new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 0.8, roughness: 0.3 })));
		stand.position.set(tableX + 0.5, 0.93, tableZ - 0.22);
		// the lamp lights the table by its glow: a light of its own would be paid for at every pixel of the room
		const glow = new THREE.Mesh(keep(new THREE.CircleGeometry(0.11, 20)), keep(new THREE.MeshBasicMaterial({ color: 0xffe3b0 })));
		glow.rotation.x = Math.PI / 2;
		glow.position.set(tableX + 0.5, 1.045, tableZ - 0.22);
		this.roomGroup.add(shade, stand, glow);
	}

	cabinetBuild(cabinet, color) {
		const { x, z, width, depth, height, zFace } = cabinet;
		const bodyMaterial = this.keep(new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.45 }));
		const insideMaterial = this.keep(new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 1 }));
		const pick = { path: cabinet.path, level: 'cabinet', label: cabinet.label, detail: cabinet.isGitIgnored ? 'kept out of git' : 'tracked by git' };
		const panelAdd = (w, h, d, px, py, pz, material = bodyMaterial) => {
			const panel = new THREE.Mesh(this.keep(new THREE.BoxGeometry(w, h, d)), material);
			panel.position.set(px, py, pz);
			panel.castShadow = true;
			panel.receiveShadow = true;
			panel.userData.pick = pick;
			this.furniture.add(panel);
			this.pickList.push(panel);
			return panel;
		};
		const wall = 0.022;
		// an open-fronted shell: a drawer that comes out leaves its dark place behind
		panelAdd(wall, height, depth, x - width / 2 + wall / 2, height / 2, z);
		panelAdd(wall, height, depth, x + width / 2 - wall / 2, height / 2, z);
		panelAdd(width, wall, depth, x, height - wall / 2, z);
		panelAdd(width, 0.1, depth, x, 0.05, z);
		panelAdd(width - wall * 2, height - 0.1, wall, x, height / 2 + 0.05, z - depth / 2 + wall / 2, insideMaterial);
		// its sign on the wall above it: the name of the cabinet, and whether git keeps it
		const signTexture = this.keep(labelTextureMake({ width: 512, height: 150, background: '#f4efe2', lineList: [
			{ text: cabinet.label, size: 62, weight: 700, color: '#2a241b' },
			{ text: cabinet.isGitIgnored ? 'kept out of git' : 'tracked by git', size: 30, color: '#7a6d58' },
		] }));
		const sign = new THREE.Mesh(this.keep(new THREE.PlaneGeometry(0.86, 0.25)), this.keep(new THREE.MeshStandardMaterial({ map: signTexture, roughness: 0.9 })));
		sign.position.set(x, height + 0.3, z - depth / 2 - 0.035 + 0.01);
		sign.userData.pick = pick;
		this.furniture.add(sign);
		this.pickList.push(sign);
		for (const drawer of cabinet.drawerList) this.drawerBuild(cabinet, drawer, color);
		void zFace;
	}

	drawerBuild(cabinet, drawer, color) {
		const group = new THREE.Group();
		group.position.set(cabinet.x, drawer.y, drawer.zFace);
		this.furniture.add(group);
		const pick = { path: drawer.path, level: 'drawer', label: drawer.label, detail: `${drawer.count} file${drawer.count === 1 ? '' : 's'}` };
		const frontMaterial = this.keep(new THREE.MeshStandardMaterial({ color: new THREE.Color(color).offsetHSL(0, -0.04, 0.07), roughness: 0.5, metalness: 0.45 }));
		const front = new THREE.Mesh(this.keep(new THREE.BoxGeometry(drawer.width, drawer.height - 0.012, 0.024)), frontMaterial);
		front.position.z = 0.012;
		front.castShadow = true;
		front.userData.pick = pick;
		group.add(front);
		this.pickList.push(front);
		const handle = new THREE.Mesh(this.keep(new THREE.BoxGeometry(0.2, 0.022, 0.03)), this.keep(new THREE.MeshStandardMaterial({ color: 0xd8d4cc, metalness: 0.95, roughness: 0.22 })));
		handle.position.set(0, -drawer.height * 0.2, 0.04);
		handle.userData.pick = pick;
		group.add(handle);
		this.pickList.push(handle);
		// its label in its holder: the word on the paper, then the name of the drawer and how many it holds
		const plateTexture = this.keep(labelTextureMake({ width: 512, height: 150, background: '#fbf8f0', lineList: [
			{ text: drawer.labelNative || drawer.label, size: 56, weight: 700, color: '#221d15' },
			{ text: `${drawer.label} · ${drawer.count}`, size: 30, color: '#6f6350' },
		] }));
		const plate = new THREE.Mesh(this.keep(new THREE.PlaneGeometry(0.38, 0.11)), this.keep(new THREE.MeshStandardMaterial({ map: plateTexture, roughness: 0.85 })));
		plate.position.set(0, drawer.height * 0.14, 0.0255);
		plate.userData.pick = pick;
		group.add(plate);
		this.pickList.push(plate);
		// the tray behind the front: a bottom and two sides
		const trayMaterial = this.keep(new THREE.MeshStandardMaterial({ color: 0x8b8f8c, roughness: 0.7, metalness: 0.5 }));
		const trayDepth = drawer.depth - 0.04;
		const bottom = new THREE.Mesh(this.keep(new THREE.BoxGeometry(drawer.width - 0.04, 0.012, trayDepth)), trayMaterial);
		bottom.position.set(0, -drawer.height / 2 + 0.03, -trayDepth / 2);
		group.add(bottom);
		for (const side of [-1, 1]) {
			const wall = new THREE.Mesh(this.keep(new THREE.BoxGeometry(0.012, drawer.height * 0.62, trayDepth)), trayMaterial);
			wall.position.set(side * (drawer.width / 2 - 0.026), -drawer.height * 0.16, -trayDepth / 2);
			group.add(wall);
		}
		const fileEntryList = [];
		const folderWidth = drawer.width - 0.1;
		for (const file of drawer.fileList) {
			const fileGroup = new THREE.Group();
			const yBase = -drawer.height / 2 + 0.05 + this.layout.fileHeight / 2;
			fileGroup.position.set(0, yBase, -file.zOffset);
			const filePick = { path: file.path, level: 'file', isFolder: file.isFolder, label: file.label, detail: file.detail };
			const material = this.keep(new THREE.MeshStandardMaterial({ color: file.isFolder ? COLOR_FOLDER_FILING : COLOR_FOLDER_BY_KIND[file.kind] ?? COLOR_FOLDER_BY_KIND.cv, roughness: 0.82 }));
			// a folder of the filing is thicker: it holds papers
			const body = new THREE.Mesh(this.keep(new THREE.BoxGeometry(folderWidth, this.layout.fileHeight, file.isFolder ? 0.018 : 0.008)), material);
			body.userData.pick = filePick;
			fileGroup.add(body);
			// its tab, in one of three places across it, its name on it
			const tabWidth = folderWidth / 3 - 0.012;
			const tabText = file.isFolder ? `${textCut(file.label, 10)} · ${file.count}` : textCut(file.label, 13);
			const tabTexture = this.keep(labelTextureMake({ width: 384, height: 96, background: file.isFolder ? TAB_FILING.background : '#fffdf6', lineList: [{ text: tabText, size: 46, weight: 600, color: file.isFolder ? TAB_FILING.color : '#2a241b' }] }));
			const tabMaterialList = [material, material, material, material, this.keep(new THREE.MeshStandardMaterial({ map: tabTexture, roughness: 0.85 })), material];
			const tab = new THREE.Mesh(this.keep(new THREE.BoxGeometry(tabWidth, 0.062, 0.008)), tabMaterialList);
			tab.position.set(-folderWidth / 2 + tabWidth / 2 + file.tabSlot * (tabWidth + 0.018), this.layout.fileHeight / 2 + 0.028, 0);
			tab.userData.pick = filePick;
			fileGroup.add(tab);
			group.add(fileGroup);
			this.pickList.push(body, tab);
			const entry = { path: file.path, group: fileGroup, tab, yBase, lift: 0, material };
			fileEntryList.push(entry);
			this.fileByPath.set(file.path, entry);
		}
		this.drawerByPath.set(drawer.path, { path: drawer.path, group, zBase: drawer.zFace, open: 0, frontMaterial, fileEntryList });
	}

	// ---------- its state ----------

	stateSet(change) {
		const isSame = Object.entries(change).every(([key, value]) => this.state[key] === value);
		if (isSame) return;
		this.state = { ...this.state, ...change };
		this.hoverApply();
		this.isDirty = true;
	}

	// the drawers and folders moved toward the state, by how far a frame of dt seconds takes them
	// (isAtOnce: all the way, when the layout was just built). answers whether anything is still
	// on its way: a frame is owed then, and the shadows moved with it
	stateApply(isAtOnce = false, dt = 0.016) {
		const step = isAtOnce ? 1 : 1 - Math.exp(-dt * 9);
		const fileOpen = this.fileByPath.get(this.state.fileOpenPath);
		let isMoving = false;
		// a value at its target: set there exactly, so that it stops moving
		const toward = (value, target) => {
			const next = value + (target - value) * step;
			if (Math.abs(target - next) < 0.002) return target;
			isMoving = true;
			return next;
		};
		for (const drawer of this.drawerByPath.values()) {
			const isOpen = drawer.path === this.state.drawerOpenPath || drawer.fileEntryList.includes(fileOpen);
			const open = toward(drawer.open, isOpen ? 1 : 0);
			if (open !== drawer.open || isAtOnce) {
				drawer.open = open;
				drawer.group.position.z = drawer.zBase + open * CV_ROOM_DRAWER_TRAVEL;
			}
			for (const file of drawer.fileEntryList) {
				const lift = toward(file.lift, file === fileOpen ? 1 : 0);
				if (lift === file.lift && !isAtOnce) continue;
				file.lift = lift;
				file.group.position.y = file.yBase + lift * CV_ROOM_FILE_LIFT;
				file.group.rotation.x = -lift * 0.22;
			}
		}
		return isMoving;
	}

	// what the pointer is on glows a little; nothing else does
	hoverApply() {
		for (const material of this.hoverMaterialList) material.emissive?.setHex(0x000000);
		this.hoverMaterialList = [];
		const path = this.state.hoverPath;
		if (!path) return;
		const drawer = this.drawerByPath.get(path);
		const file = this.fileByPath.get(path);
		const material = drawer?.frontMaterial ?? file?.material;
		if (!material) return;
		material.emissive.setHex(COLOR_HOVER);
		this.hoverMaterialList.push(material);
	}

	// where the reader is: answers whether that is another place than the frame before
	poseSet(pose) {
		const y = pose.y ?? CV_ROOM_EYE_HEIGHT;
		const last = this.poseLast;
		if (last && last.x === pose.x && last.y === y && last.z === pose.z && last.yaw === pose.yaw && last.pitch === pose.pitch) return false;
		this.poseLast = { x: pose.x, y, z: pose.z, yaw: pose.yaw, pitch: pose.pitch };
		this.camera.position.set(pose.x, y, pose.z);
		this.camera.rotation.set(pose.pitch, pose.yaw, 0);
		this.isDirty = true;
		return true;
	}

	// what of the archive is under a point of the window: the nearest thing that can be acted on.
	// a folder counts only while its drawer is out: a closed drawer hides what is in it
	pick(clientX, clientY) {
		const rect = this.renderer.domElement.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return undefined;
		const point = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
		this.raycaster.setFromCamera(point, this.camera);
		for (const hit of this.raycaster.intersectObjects(this.pickList, false)) {
			const pick = hit.object.userData.pick;
			if (!pick) continue;
			if (pick.level === 'file') {
				const drawer = [...this.drawerByPath.values()].find((one) => one.fileEntryList.some((file) => file.path === pick.path));
				if (!drawer || drawer.open < 0.5) continue;
			}
			return pick;
		}
		return undefined;
	}

	// where a place of the archive is on the window now (the middle of a drawer's front, of a folder's
	// tab: what is seen of it in its drawer), for a test or a mark
	screenPointGet(path) {
		const drawer = this.drawerByPath.get(path);
		const file = this.fileByPath.get(path);
		const object = drawer?.group ?? file?.tab;
		if (!object) return undefined;
		const point = new THREE.Vector3();
		object.getWorldPosition(point);
		point.project(this.camera);
		const rect = this.renderer.domElement.getBoundingClientRect();
		return { clientX: rect.left + ((point.x + 1) / 2) * rect.width, clientY: rect.top + ((1 - point.y) / 2) * rect.height };
	}

	// one turn of the loop: dt the seconds since the last turn (for motion), frameMs the time since
	// it as it was (for the density), isMoving whether the reader moved in it. draws only when a
	// frame is owed; answers whether it drew
	frame(dt, { frameMs = dt * 1000, isMoving = false } = {}) {
		const isAnimating = this.stateApply(false, dt);
		if (isAnimating) this.renderer.shadowMap.needsUpdate = true;
		const isActive = isMoving || isAnimating;
		if (!this.isDirty && !isActive) {
			this.isRenderedLast = false;
			return false;
		}
		this.renderer.render(this.scene, this.camera);
		this.isDirty = false;
		// the time between two frames drawn one after the other, in motion: what the GPU keeps up with
		if (isActive && this.isRenderedLast) this.pixelRatioLearn(frameMs);
		this.isRenderedLast = isActive;
		return true;
	}

	// the density from the frame times measured in motion: a step lower while frames keep coming
	// slowly (a GPU that does not keep up, a very large window), never raised again: every change of
	// it is a change of the canvas's size, which costs a frame
	pixelRatioLearn(frameMs) {
		this.frameMsList.push(frameMs);
		if (this.frameMsList.length < PIXEL_RATIO_FRAME_COUNT) return;
		const sorted = [...this.frameMsList].sort((a, b) => a - b);
		const median = sorted[Math.floor(sorted.length / 2)];
		this.frameMsList = [];
		if (median <= PIXEL_RATIO_FRAME_SLOW_MS || this.pixelRatio <= this.pixelRatioMin) return;
		// as far down as the pixels must be fewer (their count goes with the square of the density),
		// in one change: a step at least
		const ratioFit = this.pixelRatio * Math.sqrt(PIXEL_RATIO_FRAME_SLOW_MS / median);
		this.pixelRatio = Math.max(this.pixelRatioMin, Math.min(this.pixelRatio - PIXEL_RATIO_STEP, Math.floor(ratioFit / PIXEL_RATIO_STEP) * PIXEL_RATIO_STEP));
		this.renderer.setPixelRatio(this.pixelRatio);
		this.resize();
	}

	// what the canvas draws at now, for a test or a look into it
	get quality() {
		return { pixelRatio: this.pixelRatio, pixelRatioMax: Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_MAX) };
	}

	resize() {
		const width = Math.max(1, this.container.clientWidth);
		const height = Math.max(1, this.container.clientHeight);
		this.renderer.setSize(width, height, false);
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		this.isDirty = true;
	}

	dispose() {
		this.groupClear(this.furniture, this.disposableList);
		this.groupClear(this.roomGroup, this.roomDisposableList);
		this.renderer.dispose();
		this.renderer.domElement.remove();
	}
}

function textCut(text, lengthMax) {
	const value = String(text ?? '');
	return [...value].length > lengthMax ? `${[...value].slice(0, lengthMax - 1).join('')}…` : value;
}

// words drawn on a canvas, as a texture: a label of a drawer, a sign, the tab of a folder.
// what draws WebGL in this browser, asked of a context made for the question and let go at once:
// { name, isSoftware }
function rendererProbe() {
	try {
		const canvas = document.createElement('canvas');
		const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
		if (!gl) return { name: '', isSoftware: false };
		const name = rendererNameGet(gl);
		gl.getExtension('WEBGL_lose_context')?.loseContext();
		return { name, isSoftware: RENDERER_SOFTWARE_PATTERN.test(name) };
	} catch {
		return { name: '', isSoftware: false };
	}
}

// the name of what draws a WebGL context (the GPU, or a software renderer), '' when it is not said
function rendererNameGet(gl) {
	try {
		const extension = gl.getExtension('WEBGL_debug_renderer_info');
		return String(gl.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
	} catch {
		return '';
	}
}

// lineList: [{ text, size, weight?, color }], centered, one under another
function labelTextureMake({ width, height, background, lineList }) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d');
	context.fillStyle = background;
	context.fillRect(0, 0, width, height);
	context.strokeStyle = 'rgba(0, 0, 0, 0.18)';
	context.lineWidth = 4;
	context.strokeRect(2, 2, width - 4, height - 4);
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	const heightAll = lineList.reduce((sum, line) => sum + line.size * 1.25, 0);
	let y = (height - heightAll) / 2;
	for (const line of lineList) {
		context.font = `${line.weight ?? 500} ${line.size}px "Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", system-ui, sans-serif`;
		context.fillStyle = line.color;
		// a line too long for its plate is drawn narrower, never cut
		const widthText = context.measureText(line.text).width;
		const scale = Math.min(1, (width - 28) / Math.max(1, widthText));
		context.save();
		context.translate(width / 2, y + line.size * 0.62);
		context.scale(scale, 1);
		context.fillText(line.text, 0, 0);
		context.restore();
		y += line.size * 1.25;
	}
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.anisotropy = 8;
	return texture;
}

// planks of wood drawn on a canvas, for the floor
function woodTextureMake() {
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = 512;
	const context = canvas.getContext('2d');
	const plankCount = 6;
	const plankHeight = canvas.height / plankCount;
	let seed = 7;
	const random = () => {
		seed = (seed * 16807) % 2147483647;
		return seed / 2147483647;
	};
	for (let row = 0; row < plankCount; row += 1) {
		const light = 0.86 + random() * 0.22;
		context.fillStyle = `rgb(${Math.round(134 * light)}, ${Math.round(96 * light)}, ${Math.round(62 * light)})`;
		context.fillRect(0, row * plankHeight, canvas.width, plankHeight);
		for (let grain = 0; grain < 26; grain += 1) {
			context.strokeStyle = `rgba(60, 38, 20, ${0.05 + random() * 0.09})`;
			context.lineWidth = 0.6 + random() * 1.4;
			const y = row * plankHeight + random() * plankHeight;
			context.beginPath();
			context.moveTo(0, y);
			context.bezierCurveTo(canvas.width * 0.3, y + (random() - 0.5) * 7, canvas.width * 0.7, y + (random() - 0.5) * 7, canvas.width, y + (random() - 0.5) * 4);
			context.stroke();
		}
		context.fillStyle = 'rgba(30, 18, 8, 0.55)';
		context.fillRect(0, row * plankHeight, canvas.width, 2);
		const joint = Math.round(random() * canvas.width);
		context.fillRect(joint, row * plankHeight, 2, plankHeight);
	}
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.anisotropy = 8;
	return texture;
}
