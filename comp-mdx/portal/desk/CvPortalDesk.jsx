import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
	Archive, ArrowRight, ArrowUpLeft, BookOpen, Briefcase, ChevronRight, Ellipsis, FileText, FileUser, Folder, FolderClosed, FolderPlus, GitBranch, LayoutTemplate, Lock, Pencil,
	Plus, Search, Trash2, UserRound, X,
} from 'lucide-react';
import {
	Alert, Box, Breadcrumbs, Button, Card, CardActionArea, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, InputAdornment,
	Link, List, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, ScopedCssBaseline, Snackbar, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { EditValueInline, ObjectFrontendMode, PortalSwitcher, timeTextDisplay } from '@wwf971/react-doc';
import { FolderView } from '@wwf971/react-comp-misc';
import { CV_ARCHIVE_DRAWER_LIST, CV_ARCHIVE_ROOT, cvArchiveDrawerGet, cvArchiveDrawerIsArranged } from '../archive/CvArchiveModel.js';
import { useCvArchive } from '../archive/CvArchiveStore.js';
import { cvJpDateGet } from '../../jp/CvJpData.js';
import { cvDeskPageModeGet, cvDeskThemeGet } from './cv-desk-theme.js';
import './CvPortalDesk.css';

// The portal Desk (doc/cv-portal.md#the-desk): the archive as a desktop app in Material UI, in the
// look of the desktop apps built on react-doc (db-migration-tool). It draws the state of the
// archive (archive/CvArchiveStore.js: the places, where the reader is, what is found, the paper
// being named) and nothing of its own beside the widths of its panes:
//
//   ┌ [▣ Desk ⌃⌄] │ Papers · 7 files   [⌕ find a file      ]        [Edit] [+ New paper] [Documents] ┐
//   ├──────────────┬─────────────────────────────────────────────────────────────────────────────────┤
//   │ CABINETS     │ Archive › Example › CVs                                                          │
//   │ ▾ Example  6 │ ┌──────────────────────────────────────────────────────────────────────────────┐ │
//   │    CVs     2 │ │ what the place is: cards of cabinets or drawers, the table of a drawer's     │ │
//   │    Work …  1 │ │ files (FolderView), a paper on its sheet (the mode "sheet" of the object,    │ │
//   │    Templa… 2 │ │ edited in place while Edit is on), the profile's own panel                   │ │
//   │    Profile 9 │ └──────────────────────────────────────────────────────────────────────────────┘ │
//   └──────────────┴─────────────────────────────────────────────────────────────────────────────────┘
//
// A click enters: a cabinet, a drawer, a folder, a file. The place is the address of the portal, so
// Back and Forward are the browser's, and a place is a link.
//
// Folders (doc/cv-portal.md#folders): a drawer of papers holds folders, a folder more folders and
// papers, each in the order it is put in. New folder makes one first in the place shown, named in
// place; a right click on a row renames, takes away, moves out. A row is dragged to another place
// in the list, onto a folder row to go inside it, or onto a step of the path above or a drawer or
// folder at the left to go there. Filing is the reader's own arranging, so it is offered wherever
// the page writes, the switch Edit (which changes what the papers say) aside, as New paper is.
const DRAWER_ICON_BY_ID = { cv: FileUser, we: Briefcase, template: LayoutTemplate, profile: UserRound };

export const CvPortalDesk = observer(function CvPortalDesk({ config = {} }) {
	const store = useCvArchive(config);
	const portal = config.portal;
	const service = config.objectFrontend;
	const mode = usePageMode();
	if (!portal || !service) return <p className="doc-error">CvPortalDesk is the component of a portal of a papers object.</p>;
	return (
		<ThemeProvider theme={cvDeskThemeGet(mode)}>
			<ScopedCssBaseline className="cv-desk not-prose" data-device={portal.device}>
				<DeskBar store={store} />
				<div className="cv-desk-body">
					<DeskSide store={store} />
					<main className="cv-desk-main">
						{store.find.trim() ? <DeskFound store={store} /> : <DeskPlace store={store} />}
					</main>
				</div>
				<DeskPaperNew store={store} />
					<Snackbar open={Boolean(store.arrangeMessage)} autoHideDuration={6000} onClose={() => store.arrangeMessageClear()} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
						<Alert severity="warning" onClose={() => store.arrangeMessageClear()}>{store.arrangeMessage}</Alert>
					</Snackbar>
				</ScopedCssBaseline>
		</ThemeProvider>
	);
});

// light or dark as the page is, followed when its theme switch is used
function usePageMode() {
	const [mode, modeSet] = useState(cvDeskPageModeGet);
	useEffect(() => {
		const observer = new MutationObserver(() => modeSet(cvDeskPageModeGet()));
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		return () => observer.disconnect();
	}, []);
	return mode;
}

// ---------- the bar ----------

const DeskBar = observer(function DeskBar({ store }) {
	const { portal, service } = store;
	const isWritable = service.isWritable;
	return (
		<header className="cv-desk-bar">
			<PortalSwitcher />
			<Divider orientation="vertical" flexItem sx={{ my: 1 }} />
			<Typography variant="subtitle2" noWrap>{service.object.name || 'Papers'}</Typography>
			<Typography variant="body2" color="text.secondary" noWrap>{store.archive.fileList.length} files</Typography>
			<TextField
				className="cv-desk-find"
				placeholder="Find a file"
				value={store.find}
				onChange={(event) => store.findSet(event.target.value)}
				slotProps={{
					htmlInput: { 'aria-label': 'Find a file by its name, its drawer or its cabinet' },
					input: {
						startAdornment: <InputAdornment position="start"><Search size={14} /></InputAdornment>,
						endAdornment: store.find ? <InputAdornment position="end"><IconButton size="small" aria-label="Clear" onClick={() => store.findSet('')}><X size={13} /></IconButton></InputAdornment> : null,
					},
				}}
			/>
			<span className="cv-desk-space" />
			<Tooltip title={isWritable ? 'Whether the papers can be changed here: cells typed, rows moved, parts added' : service.writeUnavailableReason}>
				<span>
					<ToggleButton size="small" value="edit" selected={store.isEditing} disabled={!isWritable} onChange={() => portal.editSet(!store.isEditing)}>
						<Pencil size={13} /><Box component="span" sx={{ ml: 0.75 }}>{store.isEditing ? 'Editing' : 'Edit'}</Box>
					</ToggleButton>
				</span>
			</Tooltip>
			<Tooltip title={isWritable ? 'A new CV or work experience' : service.writeUnavailableReason}>
				<span>
					<Button variant="contained" disabled={!isWritable} startIcon={<Plus size={14} />} onClick={() => store.paperNewOpen()}>New paper</Button>
				</span>
			</Tooltip>
			<Button variant="text" startIcon={<BookOpen size={14} />} onClick={() => portal.docOpen()}>Documents</Button>
		</header>
	);
});

// ---------- the side: the cabinets and their drawers ----------

// a drawer or a folder of the left, or a step of the path, as the place things dragged are dropped on:
// what it takes is said by the store (same partition, same drawer, a folder never in itself)
function dropPropsGet(store, path) {
	if (store.dragPathList.length === 0) return {};
	return {
		'data-drop-over': store.dropOverPath === path && store.dropIsTaken(path) ? '' : undefined,
		onDragOver: (event) => {
			if (!store.dropIsTaken(path)) return;
			event.preventDefault();
			event.dataTransfer.dropEffect = 'move';
			store.dropOverSet(path);
		},
		onDragLeave: (event) => {
			if (!event.currentTarget.contains(event.relatedTarget) && store.dropOverPath === path) store.dropOverSet('');
		},
		onDrop: (event) => {
			event.preventDefault();
			void store.dropOn(path);
		},
	};
}

// the folders of a drawer or a folder at the left, each under the one it lies in
const DeskSideFolderList = observer(function DeskSideFolderList({ store, parentPath, depth, pathSelected }) {
	const folderList = store.archive.childListGet(parentPath).filter((place) => place.level === 'folder');
	if (folderList.length === 0) return null;
	return folderList.map((folder) => (
		<Box key={folder.path}>
			<ListItemButton className="cv-desk-drop" sx={{ pl: 4 + depth * 1.5 }} selected={pathSelected === folder.path} onClick={() => store.go(folder.path)} {...dropPropsGet(store, folder.path)}>
				<ListItemIcon><Folder size={14} className="cv-desk-folder-icon" /></ListItemIcon>
				<ListItemText primary={folder.label} slotProps={{ primary: { className: folder.meta.isNameDefault ? 'cv-desk-name-default' : undefined } }} />
				<span className="cv-desk-count">{store.archive.countGet(folder.path)}</span>
			</ListItemButton>
			<DeskSideFolderList store={store} parentPath={folder.path} depth={depth + 1} pathSelected={pathSelected} />
		</Box>
	));
});

const DeskSide = observer(function DeskSide({ store }) {
	const { archive } = store;
	const pathShown = store.placeShown?.path ?? CV_ARCHIVE_ROOT;
	// the drawer or folder lit at the left: the place shown, or for a file the place it lies in
	const pathSelected = store.placeShown?.level === 'file' ? store.placeShown.parentPath : pathShown;
	return (
		<nav className="cv-desk-side" aria-label="Cabinets and drawers">
			<List dense disablePadding>
				<ListItemButton selected={pathShown === CV_ARCHIVE_ROOT} onClick={() => store.go(CV_ARCHIVE_ROOT)}>
					<ListItemIcon><Archive size={15} /></ListItemIcon>
					<ListItemText primary="Archive" />
					<span className="cv-desk-count">{archive.fileList.length}</span>
				</ListItemButton>
			</List>
			<Typography className="cv-desk-side-title" variant="caption" color="text.secondary">Cabinets</Typography>
			<List dense disablePadding>
				{archive.cabinetList.map((cabinet) => (
					<Box key={cabinet.path}>
						<ListItemButton selected={pathShown === cabinet.path} onClick={() => store.go(cabinet.path)}>
							<ListItemIcon>{cabinet.meta.isGitIgnored ? <Lock size={15} /> : <FolderClosed size={15} />}</ListItemIcon>
							<ListItemText primary={cabinet.label} secondary={cabinet.meta.isGitIgnored ? 'kept out of git' : undefined} slotProps={{ secondary: { sx: { fontSize: 11 } } }} />
							<span className="cv-desk-count">{archive.countGet(cabinet.path)}</span>
						</ListItemButton>
						<List dense disablePadding>
							{archive.childListGet(cabinet.path).map((drawer) => {
								const Icon = DRAWER_ICON_BY_ID[drawer.drawerId] ?? FileText;
								return (
									<Box key={drawer.path}>
										<ListItemButton className="cv-desk-drop" sx={{ pl: 4 }} selected={pathSelected === drawer.path} onClick={() => store.go(drawer.path)} {...dropPropsGet(store, drawer.path)}>
											<ListItemIcon><Icon size={14} /></ListItemIcon>
											<ListItemText primary={drawer.label} />
											<span className="cv-desk-count">{archive.countGet(drawer.path)}</span>
										</ListItemButton>
										<DeskSideFolderList store={store} parentPath={drawer.path} depth={1} pathSelected={pathSelected} />
									</Box>
								);
							})}
						</List>
					</Box>
				))}
			</List>
			{archive.cabinetList.length === 0 ? <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>Nothing is kept yet.</Typography> : null}
			{store.profileProblem ? <Alert severity="warning" sx={{ m: 1, fontSize: 12 }}>{store.profileProblem}</Alert> : null}
		</nav>
	);
});

// ---------- the place shown ----------

const DeskPlace = observer(function DeskPlace({ store }) {
	const place = store.place;
	return (
		<>
			<DeskPath store={store} />
			{!place ? (
				<Alert severity="warning" action={<Button color="inherit" variant="text" onClick={() => store.go(store.placeShown?.path ?? CV_ARCHIVE_ROOT)}>Go to {store.placeShown?.label ?? 'the archive'}</Button>}>
					Nothing of the archive is at {store.path}.
				</Alert>
			) : place.level === 'archive' ? <DeskArchive store={store} />
				: place.level === 'cabinet' ? <DeskCabinet store={store} cabinet={place} />
					: place.level === 'drawer' || place.level === 'folder' ? <DeskDrawer store={store} place={place} />
						: <DeskFile store={store} file={place} />}
		</>
	);
});

// the way down to the place: every step a click away
const DeskPath = observer(function DeskPath({ store }) {
	const ancestorList = store.ancestorList;
	return (
		<Breadcrumbs className="cv-desk-path" separator={<ChevronRight size={13} />} aria-label="Where this is in the archive">
			{ancestorList.map((place, index) => (index === ancestorList.length - 1
				? <Typography key={place.path} variant="body2" color="text.primary" sx={{ fontWeight: 600 }}>{place.label}</Typography>
				: <Link key={place.path} className="cv-desk-drop" component="button" type="button" variant="body2" underline="hover" color="text.secondary" onClick={() => store.go(place.path)} {...dropPropsGet(store, place.path)}>{place.label}</Link>))}
		</Breadcrumbs>
	);
});

const DeskArchive = observer(function DeskArchive({ store }) {
	const { archive } = store;
	return (
		<>
			<Typography variant="h5">Archive</Typography>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
				Every paper kept, by where it comes from: a cabinet for each partition of the data, a drawer for each sort of paper.
			</Typography>
			<div className="cv-desk-card-grid">
				{archive.cabinetList.map((cabinet) => (
					<Card key={cabinet.path}>
						<CardActionArea onClick={() => store.go(cabinet.path)}>
							<CardContent>
								<Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
									{cabinet.meta.isGitIgnored ? <Lock size={16} /> : <FolderClosed size={16} />}
									<Typography variant="h6" noWrap>{cabinet.label}</Typography>
									<span className="cv-desk-space" />
									<DeskGitChip isGitIgnored={cabinet.meta.isGitIgnored} />
								</Stack>
								<Typography variant="body2" color="text.secondary" sx={{ minHeight: '2.6em' }}>{cabinet.detail || `the partition ${cabinet.partition || '(none)'}`}</Typography>
								<Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', mt: 1 }}>
									{archive.childListGet(cabinet.path).map((drawer) => <Chip key={drawer.path} label={`${drawer.label} ${archive.countGet(drawer.path)}`} />)}
								</Stack>
							</CardContent>
						</CardActionArea>
					</Card>
				))}
			</div>
			<Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>Every file</Typography>
			<DeskFileTable store={store} fileList={archive.fileList} isPlaceShown />
		</>
	);
});

const DeskCabinet = observer(function DeskCabinet({ store, cabinet }) {
	const { archive } = store;
	return (
		<>
			<Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
				<Typography variant="h5">{cabinet.label}</Typography>
				<DeskGitChip isGitIgnored={cabinet.meta.isGitIgnored} />
			</Stack>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{cabinet.detail || `the partition ${cabinet.partition || '(none)'}`}</Typography>
			<div className="cv-desk-card-grid">
				{archive.childListGet(cabinet.path).map((drawer) => {
					const Icon = DRAWER_ICON_BY_ID[drawer.drawerId] ?? FileText;
					const fileList = archive.childListGet(drawer.path);
					return (
						<Card key={drawer.path}>
							<CardActionArea onClick={() => store.go(drawer.path)}>
								<CardContent>
									<Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
										<Icon size={16} />
										<Typography variant="h6" noWrap>{drawer.label}</Typography>
										<Typography variant="body2" color="text.secondary">{drawer.labelNative}</Typography>
										<span className="cv-desk-space" />
										<span className="cv-desk-count">{archive.countGet(drawer.path)}</span>
									</Stack>
									<Typography className="cv-desk-card-list" variant="body2" color="text.secondary">
										{fileList.length === 0 ? 'Empty.' : fileList.slice(0, 3).map((file) => file.label).join(' · ')}{fileList.length > 3 ? ` · +${fileList.length - 3}` : ''}
									</Typography>
								</CardContent>
							</CardActionArea>
						</Card>
					);
				})}
			</div>
		</>
	);
});

// a drawer or a folder: what it holds, in its order, filed by dragging
const DeskDrawer = observer(function DeskDrawer({ store, place }) {
	const [menuPoint, menuPointSet] = useState(null);
	const fileList = store.archive.childListGet(place.path);
	const drawerOf = cvArchiveDrawerGet(place.drawerId);
	const isFolder = place.level === 'folder';
	const isCreatable = drawerOf?.isCreatable === true;
	const isArranged = cvArchiveDrawerIsArranged(place.drawerId);
	const isWritable = store.service.isWritable;
	const isNaming = store.folderNamingPath === place.path;
	return (
		<>
			<Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
				{isFolder ? <Folder size={20} className="cv-desk-folder-icon" aria-hidden="true" /> : null}
				{isNaming ? (
					<Typography variant="h5" component="div"><DeskFolderName store={store} folder={place} /></Typography>
				) : (
					<Typography variant="h5" className={isFolder && place.meta.isNameDefault ? 'cv-desk-name-default' : undefined} onContextMenu={isFolder ? (event) => { event.preventDefault(); menuPointSet({ x: event.clientX, y: event.clientY }); } : undefined}>{place.label}</Typography>
				)}
				{isFolder ? (
					<IconButton size="small" aria-label="What can be done with this folder" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); menuPointSet({ x: rect.left, y: rect.bottom + 4 }); }}><Ellipsis size={15} /></IconButton>
				) : <Typography variant="body1" color="text.secondary">{place.labelNative}</Typography>}
				<span className="cv-desk-space" />
				{isArranged ? (
					<Tooltip title={isWritable ? `A folder ${isFolder ? 'in this folder' : 'in this drawer'}, to keep papers together` : store.service.writeUnavailableReason}>
						<span><Button disabled={!isWritable} startIcon={<FolderPlus size={14} />} onClick={() => void store.folderCreate(place.path)}>New folder</Button></span>
					</Tooltip>
				) : null}
				{isCreatable ? (
					<Tooltip title={isWritable ? `A new ${drawerOf.labelOne} in this ${isFolder ? 'folder' : 'drawer'}` : store.service.writeUnavailableReason}>
						<span><Button disabled={!isWritable} startIcon={<Plus size={14} />} onClick={() => store.paperNewOpen({ drawerId: place.drawerId, partition: place.partition, folderPath: isFolder ? place.path : '' })}>New</Button></span>
					</Tooltip>
				) : null}
			</Stack>
			{place.drawerId === 'profile' ? (
				<Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
					What is known of the person, by subject: every paper of this cabinet reads it from {place.meta.profileLabel}. A click opens the profile at its values.
				</Typography>
			) : null}
			{fileList.length === 0
				? <Alert severity="info">{isFolder ? 'This folder is empty: drag papers onto it, here or at the left.' : `This drawer is empty${isCreatable ? ': New makes its first paper.' : '.'}`}</Alert>
				: <DeskFileTable store={store} fileList={fileList} parentPath={isArranged ? place.path : ''} />}
			{isFolder ? <DeskEntryMenu store={store} place={place} point={menuPoint} onClose={() => menuPointSet(null)} isOpenHidden /> : null}
		</>
	);
});

// the name of a folder typed where it is shown: Enter or leaving keeps it, Escape keeps the one it had
const DeskFolderName = observer(function DeskFolderName({ store, folder }) {
	const ref = useRef(null);
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;
		element.focus();
		// the whole name chosen, so typing replaces it
		const range = document.createRange();
		range.selectNodeContents(element);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
	}, []);
	return (
		<span
			className="cv-desk-name-edit"
			onClick={(event) => event.stopPropagation()}
			onMouseDown={(event) => event.stopPropagation()}
			onDoubleClick={(event) => event.stopPropagation()}
		>
			<EditValueInline
				ref={ref}
				value={folder.meta.isNameDefault ? '' : folder.label}
				placeholder={folder.meta.isNameDefault ? folder.label : 'Name of the folder'}
				aria-label="Name of the folder"
				onCommit={(name) => void store.folderRename(folder.path, name)}
				onKeyDown={(event) => { if (event.key === 'Escape') store.folderNamingSet(''); }}
				onBlur={() => { if (store.folderNamingPath === folder.path) store.folderNamingSet(''); }}
			/>
		</span>
	);
});

// what can be done with a thing of a drawer, from a right click or its ⋯: open it, name a folder,
// take a folder away (what it holds stays), move a thing out of its folder
const DeskEntryMenu = observer(function DeskEntryMenu({ store, place, point, onClose, isOpenHidden = false }) {
	if (!point || !place) return null;
	const isWritable = store.service.isWritable;
	const parent = store.archive.placeGet(place.parentPath);
	const isInFolder = parent?.level === 'folder';
	const choose = (action) => {
		onClose();
		action();
	};
	return (
		<Menu open anchorReference="anchorPosition" anchorPosition={{ top: point.y, left: point.x }} onClose={onClose} disablePortal slotProps={{ paper: { className: 'cv-desk-menu' } }}>
			{isOpenHidden ? null : <MenuItem onClick={() => choose(() => store.go(place.path))}><ListItemIcon><ArrowRight size={14} /></ListItemIcon>Open</MenuItem>}
			{place.level === 'folder' ? <MenuItem disabled={!isWritable} onClick={() => choose(() => store.folderNamingSet(place.path))}><ListItemIcon><Pencil size={14} /></ListItemIcon>Rename</MenuItem> : null}
			{isInFolder ? <MenuItem disabled={!isWritable} onClick={() => choose(() => void store.move([place.path], { parentPath: parent.parentPath }))}><ListItemIcon><ArrowUpLeft size={14} /></ListItemIcon>Move out of {parent.label}</MenuItem> : null}
			{place.level === 'folder' ? <Divider /> : null}
			{place.level === 'folder' ? (
				<MenuItem disabled={!isWritable} onClick={() => choose(() => void store.folderRemove(place.path))} sx={{ color: 'error.main' }}>
					<ListItemIcon sx={{ color: 'inherit' }}><Trash2 size={14} /></ListItemIcon>
					<ListItemText primary="Delete folder" secondary={place.meta.childCount > 0 ? 'what it holds stays here' : undefined} slotProps={{ secondary: { sx: { fontSize: 11 } } }} />
				</MenuItem>
			) : null}
		</Menu>
	);
});

// what a file is: a paper on its sheet, the profile at its values, a template by its facts
const DeskFile = observer(function DeskFile({ store, file }) {
	const { portal, service } = store;
	const drawer = cvArchiveDrawerGet(file.drawerId);
	const isPaper = file.drawerId === 'cv' || file.drawerId === 'we';
	return (
		<>
			<Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 1.5 }}>
				<Typography variant="h5" sx={{ mr: 0.5 }}>{file.label}</Typography>
				<Chip label={drawer?.labelNative ?? drawer?.labelOne} />
				{isPaper && file.meta.asOf ? <Chip label={`as of ${timeTextDisplay(cvJpDateGet(file.meta.asOf), { part: 'date' })}`} /> : null}
				{isPaper && file.meta.template ? (
					<Tooltip title={`Its template: ${file.meta.template}`}>
						<Chip icon={<LayoutTemplate size={12} />} label={store.archive.placeGet(file.meta.template)?.label ?? file.meta.template} onClick={() => store.go(file.meta.template)} />
					</Tooltip>
				) : null}
				<Typography className="cv-desk-file-path" variant="body2" color="text.secondary">{file.path}</Typography>
			</Stack>
			{isPaper ? (
				<div className="cv-desk-sheet">
					<ObjectFrontendMode object={service.ref} mode="sheet" param={{ instance: file.path, isPaperChoiceHidden: true }} docState={portal.docState} instanceKey={`desk:${portal.id}`} />
				</div>
			) : file.drawerId === 'profile' ? (
				<div className="cv-desk-profile">
					<ObjectFrontendMode object={file.meta.profileRef} mode="info" param={{ partition: file.partition, heightMax: 520 }} docState={portal.docState} instanceKey={`desk:${portal.id}:${file.partition}`} />
				</div>
			) : (
				<DeskTemplate store={store} file={file} />
			)}
		</>
	);
});

// a template: nothing draws one alone, so its facts, and the papers made of it
const DeskTemplate = observer(function DeskTemplate({ store, file }) {
	const paperList = store.archive.fileList.filter((one) => one.meta.template === file.path);
	return (
		<Card>
			<CardContent>
				<Typography variant="body2" color="text.secondary">
					A template of a {file.meta.form === 'we' ? 'work experience' : 'CV'}: {file.meta.sectionCount} part{file.meta.sectionCount === 1 ? '' : 's'}. It says what a paper of it looks like; a paper is where it is drawn.
				</Typography>
				<Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>{paperList.length === 0 ? 'No paper is made of it yet.' : `Papers made of it (${paperList.length})`}</Typography>
				{paperList.length > 0 ? <DeskFileTable store={store} fileList={paperList} isPlaceShown /> : null}
			</CardContent>
		</Card>
	);
});

const DeskFound = observer(function DeskFound({ store }) {
	const fileList = store.findList;
	return (
		<>
			<Typography variant="h5">Found</Typography>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
				{fileList.length === 0 ? `No file holds “${store.find.trim()}”.` : `${fileList.length} file${fileList.length === 1 ? '' : 's'} holding “${store.find.trim()}”`}
			</Typography>
			{fileList.length > 0 ? <DeskFileTable store={store} fileList={fileList} isPlaceShown onChoose={() => store.findSet('')} /> : null}
		</>
	);
});

function DeskGitChip({ isGitIgnored }) {
	return <Chip icon={isGitIgnored ? <Lock size={11} /> : <GitBranch size={11} />} label={isGitIgnored ? 'kept out of git' : 'tracked by git'} />;
}

// ---------- the table of files: FolderView of react-comp-misc in the look of the desk ----------

const TABLE_COLUMN_LIST = [
	{ id: 'name', label: 'Name', width: 280 },
	{ id: 'place', label: 'Where', width: 200 },
	{ id: 'detail', label: 'What it says', width: 260 },
	{ id: 'path', label: 'Path', width: 260 },
];
const TABLE_ROW_HEIGHT = 36;
const TABLE_ROW_COUNT_MAX = 14;

// isPlaceShown: the files come from several drawers, so each says its cabinet and its drawer.
// a click on a row enters the file or the folder (onChoose: what else the click does).
// parentPath: the drawer or folder the rows are what of: they are filed by dragging (to another
// place in the list, onto a folder row to go in it), and a right click offers what the menu does
const DeskFileTable = observer(function DeskFileTable({ store, fileList, isPlaceShown = false, onChoose, parentPath = '' }) {
	const [widthById, widthByIdSet] = useState({});
	const [menu, menuSet] = useState(null);
	const isArranged = Boolean(parentPath) && store.service.isWritable && !store.folderNamingPath;
	const columnList = TABLE_COLUMN_LIST.filter((column) => isPlaceShown || column.id !== 'place');
	const rowById = new Map(fileList.map((file) => [file.path, file]));
	const context = { archive: store.archive, store };
	const folderData = {
		columns: Object.fromEntries(columnList.map((column) => [column.id, { data: column.label }])),
		colsOrder: columnList.map((column) => column.id),
		rows: fileList.map((file) => ({ id: file.path, data: {} })),
		rowIdsSelected: [],
		getRowData: (rowId) => ({ row: rowById.get(rowId), context }),
	};
	const folderConfig = {
		colSizeById: Object.fromEntries(columnList.map((column) => [column.id, { width: widthById[column.id] ?? column.width, minWidth: 80, resizable: true }])),
		colWidthById: Object.fromEntries(columnList.map((column) => [column.id, widthById[column.id] ?? column.width])),
		isLastColFilled: true,
		isListOnly: true,
		isStatusBarVisible: false,
		selectionMode: 'none',
		// one height for the rows it has, scrolling inside past a screenful
		bodyHeight: (Math.min(fileList.length, TABLE_ROW_COUNT_MAX) + 1) * TABLE_ROW_HEIGHT + 2,
		compBodyByColId: deskCellCompGet,
		colResizeDragMode: 'preview',
		isContextMenuBuiltInDisabled: true,
		isRowReorderAllowed: isArranged,
		// onto the middle of a folder row: into it
		rowDropIntoCheck: isArranged ? (rowId, rowIdList) => rowById.get(rowId)?.level === 'folder' && store.moveProblemGet(rowIdList, rowId) === '' : undefined,
	};
	const onEvent = async (eventType, eventData) => {
		if (eventType === 'colResize' && eventData?.colWidthByIdNext) widthByIdSet({ ...widthById, ...eventData.colWidthByIdNext });
		else if (eventType === 'rowClick' && rowById.has(eventData?.rowId)) {
			if (store.folderNamingPath === eventData.rowId) return { code: 0 };
			onChoose?.();
			store.go(eventData.rowId);
		} else if (eventType === 'rowContextMenu' && rowById.has(eventData?.rowId)) {
			eventData.event?.preventDefault?.();
			menuSet({ path: eventData.rowId, point: { x: eventData.event.clientX, y: eventData.event.clientY } });
		} else if (eventType === 'rowDragStart') store.dragSet(eventData.rowIds);
		else if (eventType === 'rowDragEnd') store.dragSet([]);
		else if (eventType === 'rowDropInto') return store.move(eventData.rowIds, { parentPath: eventData.targetRowId });
		else if (eventType === 'rowReorder' || eventType === 'rowReorderMultiple') {
			const rowIdList = eventType === 'rowReorder' ? [eventData.rowId] : eventData.rowIds;
			return store.move(rowIdList, { parentPath, index: eventData.rowsOrderNext.indexOf(rowIdList[0]) });
		}
		return { code: 0 };
	};
	return (
		<div className="cv-desk-table">
			<FolderView data={folderData} config={folderConfig} onEvent={onEvent} />
			<DeskEntryMenu store={store} place={menu ? rowById.get(menu.path) : undefined} point={menu?.point} onClose={() => menuSet(null)} />
		</div>
	);
});

const DeskCell = observer(function DeskCell({ data, colId }) {
	const { row, context } = data ?? {};
	if (!row) return null;
	if (colId === 'name') {
		if (row.level === 'folder') {
			return (
				<span className="cv-desk-cell-name">
					<Folder size={14} className="cv-desk-folder-icon" aria-hidden="true" />
					{context.store.folderNamingPath === row.path
						? <DeskFolderName store={context.store} folder={row} />
						: <span className={row.meta.isNameDefault ? 'cv-desk-name-default' : undefined}>{row.label}</span>}
				</span>
			);
		}
		const Icon = DRAWER_ICON_BY_ID[row.drawerId] ?? FileText;
		return <span className="cv-desk-cell-name"><Icon size={14} aria-hidden="true" /><span>{row.label}</span></span>;
	}
	if (colId === 'place') {
		// its cabinet, its drawer, the folders it lies in
		const wayList = context.archive.ancestorListGet(row.path).filter((place) => place.level === 'cabinet' || place.level === 'drawer' || place.level === 'folder');
		return <span className="cv-desk-cell-muted">{wayList.map((place) => place.label).join(' › ')}</span>;
	}
	if (colId === 'detail') return <span className="cv-desk-cell-muted">{row.detail}</span>;
	// a folder is where the reader files it, at no path of the data
	if (row.level === 'folder') return null;
	return <span className="cv-desk-cell-muted" title={row.path}>{row.path}</span>;
});
const deskCellCompGet = () => DeskCell;

// ---------- a new paper: a dialog asking only what the place does not say ----------

const DeskPaperNew = observer(function DeskPaperNew({ store }) {
	const form = store.paperNew;
	const nameRef = useRef(null);
	useLayoutEffect(() => {
		if (form) nameRef.current?.focus();
		// once, when it opens
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [Boolean(form)]);
	if (!form) return null;
	const place = store.paperNewPlace;
	const drawerOf = cvArchiveDrawerGet(form.drawerId);
	const isSubmitting = form.status === 'submitting';
	// the name used when none is typed: said in the field in grey
	const nameDefault = `${drawerOf.labelNative} ${store.archive.countGet(`${form.partition ? `/${form.partition}` : '/-'}/${form.drawerId}`) + 1}`;
	const create = () => {
		if (!form.name.trim()) store.paperNewSet({ name: nameDefault });
		void store.paperNewCreate();
	};
	return (
		<Dialog open onClose={() => store.paperNewClose()} maxWidth="xs" fullWidth disablePortal>
			<DialogTitle>New paper</DialogTitle>
			<DialogContent>
				<Stack spacing={2} sx={{ pt: 0.5 }}>
					<ToggleButtonGroup exclusive size="small" value={form.drawerId} onChange={(_event, value) => { if (value) store.paperNewSet({ drawerId: value }); }} aria-label="Its form">
						{CV_ARCHIVE_DRAWER_LIST.filter((drawer) => drawer.isCreatable).map((drawer) => <ToggleButton key={drawer.id} value={drawer.id}>{drawer.labelNative} · {drawer.labelOne}</ToggleButton>)}
					</ToggleButtonGroup>
					<TextField
						inputRef={nameRef}
						fullWidth
						label="Name"
						placeholder={nameDefault}
						value={form.name}
						onChange={(event) => store.paperNewSet({ name: event.target.value })}
						onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) create(); }}
						slotProps={{ inputLabel: { shrink: true } }}
					/>
					{store.partitionList.length > 1 ? (
						<TextField select fullWidth label="Cabinet" value={form.partition} onChange={(event) => store.paperNewSet({ partition: event.target.value })}>
							{store.partitionList.filter((one) => one.id).map((one) => <MenuItem key={one.id} value={one.id}>{one.label}{one.isGitIgnored ? ' · kept out of git' : ''}</MenuItem>)}
						</TextField>
					) : null}
					<Typography variant="body2" color="text.secondary">
						Goes to {place.folder}/, {place.isGitIgnored ? 'kept out of git' : 'tracked by git'}, at {place.path}{place.folderLabel ? `, filed in the folder ${place.folderLabel}` : ''}.
					</Typography>
					{form.status === 'error' ? <Alert severity="error">{form.message}</Alert> : null}
				</Stack>
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2 }}>
				<Button variant="text" onClick={() => store.paperNewClose()}>Cancel</Button>
				<Button variant="contained" disabled={isSubmitting} onClick={create}>Create</Button>
			</DialogActions>
		</Dialog>
	);
});
