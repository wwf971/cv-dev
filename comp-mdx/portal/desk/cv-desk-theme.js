import { createTheme } from '@mui/material/styles';

// The Material UI theme of the portal Desk (doc/cv-portal.md#the-desk): the look of the desktop
// apps built on react-doc (db-migration-tool: its theme.js): the neutral colors of the page,
// its font, dense controls of one height, thin outlines, no elevation. Light and dark follow the
// page: its theme switch sets the class "dark" on the root element, and the desk takes the theme
// of that mode (it never sets a mode itself: the page's switch is the one switch).
export const CV_DESK_CONTROL_HEIGHT = 32;

const FONT = "'Geist Variable', -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Yu Gothic UI', 'Noto Sans JP', sans-serif";

const PALETTE_BY_MODE = {
	light: {
		mode: 'light',
		primary: { main: '#171717', contrastText: '#fafafa' },
		background: { default: '#f5f5f5', paper: '#fcfcfc' },
		text: { primary: '#0a0a0a', secondary: '#737373' },
		divider: 'rgba(204, 204, 204, 0.6)',
		info: { main: '#2b7fff' },
		success: { main: '#00a63e' },
		warning: { main: '#e17100' },
		error: { main: '#e7000b' },
	},
	dark: {
		mode: 'dark',
		primary: { main: '#fafafa', contrastText: '#171717' },
		background: { default: '#121212', paper: '#181818' },
		text: { primary: '#ebebeb', secondary: 'rgba(179, 179, 179, 0.85)' },
		divider: 'rgba(102, 102, 102, 0.3)',
	},
};

const themeByMode = new Map();

// the theme of a mode ('light' | 'dark'), made once
export function cvDeskThemeGet(mode) {
	const modeKept = mode === 'dark' ? 'dark' : 'light';
	if (!themeByMode.has(modeKept)) themeByMode.set(modeKept, themeBuild(modeKept));
	return themeByMode.get(modeKept);
}

// whether the page is drawn dark now: the class its theme switch sets on the root element
export function cvDeskPageModeGet() {
	return typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

const themeBuild = (mode) => createTheme({
	palette: PALETTE_BY_MODE[mode],
	typography: {
		fontFamily: FONT,
		fontSize: 13,
		h5: { fontSize: '1.35rem', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.3 },
		h6: { fontSize: '1.05rem', fontWeight: 600 },
		subtitle2: { fontWeight: 600 },
		button: { textTransform: 'none', fontWeight: 500 },
	},
	shape: { borderRadius: 6 },
	components: {
		// a field and a button have one height, so they stand on one line wherever they meet
		MuiButton: { defaultProps: { size: 'small', variant: 'outlined', disableElevation: true }, styleOverrides: { root: { whiteSpace: 'nowrap' }, sizeSmall: { height: CV_DESK_CONTROL_HEIGHT, paddingTop: 0, paddingBottom: 0 } } },
		MuiTextField: { defaultProps: { size: 'small' } },
		MuiOutlinedInput: { styleOverrides: {
			root: ({ ownerState }) => (ownerState.size === 'small' && !ownerState.multiline ? { minHeight: CV_DESK_CONTROL_HEIGHT, fontSize: 13.5 } : {}),
			input: ({ ownerState }) => (ownerState.size === 'small' && !ownerState.multiline ? { boxSizing: 'border-box', height: CV_DESK_CONTROL_HEIGHT, padding: ownerState.startAdornment ? '0 12px 0 0' : '0 12px' } : {}),
		} },
		MuiToggleButton: { styleOverrides: { sizeSmall: { height: CV_DESK_CONTROL_HEIGHT, padding: '0 12px', textTransform: 'none' } } },
		MuiSelect: { styleOverrides: { select: { display: 'flex', alignItems: 'center' } } },
		MuiChip: { defaultProps: { size: 'small', variant: 'outlined' }, styleOverrides: { root: { fontWeight: 500 } } },
		MuiCard: { defaultProps: { variant: 'outlined' } },
		MuiCardContent: { styleOverrides: { root: { padding: '12px 16px 14px', '&:last-child': { paddingBottom: 14 } } } },
		MuiListItemButton: { styleOverrides: { root: { borderRadius: 6 } } },
		MuiListItemIcon: { styleOverrides: { root: { minWidth: 28 } } },
		MuiAlert: { defaultProps: { variant: 'outlined' } },
		MuiDialog: { styleOverrides: { paper: { outline: 'none' } } },
		MuiDialogTitle: { styleOverrides: { root: { fontSize: '1.05rem', fontWeight: 600 } } },
		MuiTooltip: { defaultProps: { arrow: true, enterDelay: 400 } },
	},
});
