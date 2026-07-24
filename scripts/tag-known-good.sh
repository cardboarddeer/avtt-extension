#!/usr/bin/env bash

set -e

FEATURE="$1"

if [ -z "$FEATURE" ]; then
    echo
    echo "Usage:"
    echo "  ./scripts/tag-known-good.sh <feature-name>"
    echo
    echo "Example:"
    echo "  ./scripts/tag-known-good.sh roll-buff"
    exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Not inside a Git repository."
    exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
    echo
    echo "Working tree is not clean."
    echo "Commit or stash your changes first."
    git status --short
    exit 1
fi

VERSION=1

while git rev-parse "${FEATURE}-known-good-v${VERSION}" >/dev/null 2>&1; do
    VERSION=$((VERSION + 1))
done

TAG="${FEATURE}-known-good-v${VERSION}"

echo
echo "Creating tag:"
echo "  $TAG"

git tag "$TAG"

echo
echo "Pushing tag..."

git push origin "$TAG"

echo
echo "Known Good tags:"
git tag --list "*known-good*" | sort

echo
echo "Done."
