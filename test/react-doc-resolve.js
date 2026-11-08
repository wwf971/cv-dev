import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// For the tests of the package (npm test): the modules of the package import react-doc by its
// name, as the page serves them (react-doc: main/doc_page_impl_package.md). In a doc page the
// page's vite resolves it; under node, without an install, this hook does: from REACT_DOC_DIR,
// the checkout of react-doc (default: the one beside this project, 2026/react-doc). Only the pure
// subpaths are needed: '@wwf971/react-doc/asset-path', '@wwf971/react-doc/pagination'.
const SUBPATH_FILE = {
	'asset-path': 'main/frontend/src/lib/doc-object-frontend-asset-path.js',
	pagination: 'main/frontend/src/lib/doc-pagination.js',
};
const dirHere = path.dirname(fileURLToPath(import.meta.url));
const reactDocDir = process.env.REACT_DOC_DIR ?? path.resolve(dirHere, '../../../../2026/react-doc');

registerHooks({
	resolve(specifier, context, nextResolve) {
		const match = /^@wwf971\/react-doc\/(.+)$/.exec(specifier);
		if (!match || !SUBPATH_FILE[match[1]]) return nextResolve(specifier, context);
		try {
			return nextResolve(specifier, context);
		} catch {
			const file = path.join(reactDocDir, SUBPATH_FILE[match[1]]);
			if (!fs.existsSync(file)) throw new Error(`${specifier}: react-doc is not installed, and no checkout at ${reactDocDir} (set REACT_DOC_DIR)`);
			return { url: pathToFileURL(file).href, shortCircuit: true };
		}
	},
});
