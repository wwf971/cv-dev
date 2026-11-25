#!/bin/sh
# Builds the static page of this package and publishes it on the branch gh-pages, which GitHub Pages
# serves (https://wwf971.github.io/cv-dev/). The repository is the package; the branch is a git
# worktree beside the repository's folder, ../gh-pages; the build goes to ../dist first (react-doc
# builds outside the doc page). Made after react-doc-map-styles's script of the same name.
#
#   sh script-build/pages-deploy.sh               build and publish
#   sh script-build/pages-deploy.sh --build-only  build to ../dist and stop: nothing is committed or pushed
#   REACT_DOC_DIR=<a react-doc checkout>          where react-doc is, when not at ../../../2026/react-doc
set -e
here=$(cd "$(dirname "$0")/.." && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
react_doc=${REACT_DOC_DIR:-$(cd "$repo/../../../2026/react-doc" && pwd)}
out="$repo/../dist"
site="$repo/../gh-pages"

# the build is made from what is committed, exported to a folder of its own: a file the checkout has
# and git does not is never published. That is what keeps a person's own data off the page: the
# partitions real and playground of the frontend objects are ignored by git (.gitignore), so the
# export does not hold them. The libraries the components import come with the react-doc checkout.
exported=$(mktemp -d)
git -C "$repo" archive HEAD | tar -x -C "$exported"

# and it is checked, not trusted: the page is published with the partition example and no other.
# a partition committed by mistake (git add -f, a changed .gitignore) stops the build here
# (a partition is a folder of item/ that is no item itself: an item's folder holds its item.yaml)
partition_list=$(find "$exported/.doc-page/object-frontend" -mindepth 3 -maxdepth 3 -path '*/item/*' -type d ! -exec test -e {}/item.yaml \; -exec basename {} \; | sort -u)
for partition in $partition_list; do
	if [ "$partition" != "example" ]; then
		rm -r "$exported"
		echo "refused: the commit holds the partition \"$partition\" of a frontend object; only \"example\" is published." >&2
		echo "take it out of git (git rm -r --cached <its folder>) and keep it ignored (.gitignore), then run this again." >&2
		exit 1
	fi
done

# what the portals of the package are drawn with (Material UI, three.js: package.json, doc/cv-portal.md)
# is installed into the export, by its lock file: the export holds no node_modules
if [ -f "$exported/package-lock.json" ]; then
	(cd "$exported" && npm ci --no-audit --no-fund)
fi

node "$react_doc/main/frontend/cli/doc-cli.js" build "$exported" --out "$out" --force
rm -r "$exported"
if [ "$1" = "--build-only" ]; then
	echo "built to $out from $(git -C "$repo" rev-parse --short HEAD); nothing is published"
	exit 0
fi

# the worktree of the branch gh-pages: the branch of the remote when it exists, else a new branch
# without history (made inside a detached worktree, which git of every version can do)
if [ ! -e "$site/.git" ]; then
	if git -C "$repo" fetch -q origin gh-pages 2>/dev/null; then
		git -C "$repo" worktree add -B gh-pages "$site" origin/gh-pages
	else
		git -C "$repo" worktree add --detach "$site"
		git -C "$site" checkout -q --orphan gh-pages
		git -C "$site" rm -rq --cached . 2>/dev/null || true
	fi
fi

# the files of the build, nothing else; .nojekyll: every file served as it is
find "$site" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R "$out"/. "$site"/
touch "$site/.nojekyll"
git -C "$site" add -A
if git -C "$site" diff --cached --quiet 2>/dev/null && git -C "$site" rev-parse -q --verify HEAD >/dev/null; then
	echo "the page did not change"
else
	git -C "$site" commit -q -m "build the static page from $(git -C "$repo" rev-parse --short HEAD)"
fi
# a build is tens of MB in hundreds of files: over https git needs a larger buffer to send it at once
git -C "$site" config http.postBuffer 524288000
git -C "$site" push -u origin gh-pages
