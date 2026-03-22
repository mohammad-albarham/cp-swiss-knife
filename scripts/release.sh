#!/bin/bash

# Exit on 1st error
set -e

echo "🚀 Starting release process..."

# 1. Test Locally
echo "🧪 Running tests..."
npm test

# 2. Version Pump
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"
echo "Select version bump (patch, minor, major) or enter manual version (e.g. 0.3.2):"
read -p "> " VERSION_INPUT

if [[ "$VERSION_INPUT" == "patch" || "$VERSION_INPUT" == "minor" || "$VERSION_INPUT" == "major" ]]; then
    NEW_VERSION=$(npm version $VERSION_INPUT --no-git-tag-version)
    # Remove 'v' prefix from npm version output
    NEW_VERSION=${NEW_VERSION#v}
else
    NEW_VERSION=$VERSION_INPUT
    # Update package.json manually
    sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
fi

echo "New version: $NEW_VERSION"

# 3. Edit Changelog
DATE=$(date +%Y-%m-%d)
echo "📝 Updating CHANGELOG.md..."
# Seek for ## [Unreleased] or similar, but here we just prepend.
# Better: User might want to add custom notes. We'll open the editor.
CHANGELOG_ENTRY="## [$NEW_VERSION] - $DATE\n\n### Changed\n- Updated to version $NEW_VERSION\n"
# Prepend to CHANGELOG.md after header (line 7)
sed -i '' "7i\\
$CHANGELOG_ENTRY\\
" CHANGELOG.md

echo "Opening CHANGELOG.md for manual edits. Save and close to continue."
# Try to open in VS Code if possible, otherwise vi
code --wait CHANGELOG.md || vi CHANGELOG.md

# 4. Update Website Information
echo "🌐 Updating website information..."
# Update version in +page.svelte
sed -i '' "s/v[0-9]*\.[0-9]*\.[0-9]* — Now/v$NEW_VERSION — Now/" website/src/routes/+page.svelte

# Build website (optional check)
cd website && npm install && npm run build && cd ..

# 5. Build Extension
echo "📦 Packaging extension..."
npm run package

# 6. Add and Commit
echo "💾 Committing changes..."
git add .
git commit -m "release: v$NEW_VERSION"

# 7. Final Confirmation & Publish
echo "⚠️  Ready to publish version $NEW_VERSION to marketplaces?"
read -p "Type 'yes' to publish: " CONFIRM

if [[ "$CONFIRM" == "yes" ]]; then
    echo "🚢 Publishing to VS Marketplace..."
    npm run publish
    
    echo "🚢 Publishing to Open VSX..."
    VSIX_FILE="cp-swiss-knife-$NEW_VERSION.vsix"
    if [ -f "$VSIX_FILE" ]; then
        npx ovsx publish "$VSIX_FILE"
    else
        # Try fallback name if package script used a different one
        npx ovsx publish *.vsix
    fi
    echo "✅ Published successfully!"
else
    echo "🚫 Publishing cancelled. Changes are committed locally."
fi

echo "🎉 Release process complete!"
