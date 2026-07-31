# Release Instructions

This repository is configured to publish automatically to the npm registry via GitHub Actions whenever a new GitHub Release is created.

## How it Works
1. When you create a new Release on GitHub (from a `v*` tag), the **Publish** workflow is triggered.
2. The workflow builds the package, runs lints, and publishes it with cryptographic **provenance** using the `NPM_TOKEN` secret.

---

## Step-by-Step Release Guide

### 1. Verify Build
Ensure the code builds and type-checks successfully:
```powershell
npm run build; npm run lint
```

### 2. Bump Version & Create Tag
Use `npm version` to update `package.json`, create a commit, and create a Git tag:
```bash
# Patch release (1.0.1 → 1.0.2)
npm version patch

# Minor release (1.0.1 → 1.1.0)
npm version minor

# Major release (1.0.1 → 2.0.0)
npm version major
```

### 3. Push to GitHub
Push both the release commit and the new tag:
```bash
git push origin main --follow-tags
```

### 4. Create GitHub Release
Go to GitHub → Releases → "Create a new release" from the tag just pushed. This triggers the automatic publish.

---

## Notes for AI Assistants

If you are an AI assistant asked to release a new version:
1. Ensure all files are committed and working tree is clean.
2. Run `npm run build; npm run lint` to verify compilation.
3. Run `npm version <patch|minor|major>` to bump the version.
4. Execute `git push origin main --follow-tags` to push.
5. Instruct the user to create a GitHub Release from the new tag, OR if the user prefers manual publish, follow the manual workflow below.

---

## Manual Publish (Fallback)

Only use when GitHub Actions is not available:

```powershell
# Set token (get from npm_publishing_guide.txt in workspace root)
$env:NPM_TOKEN = "YOUR_TOKEN"

# Create temp .npmrc
"//registry.npmjs.org/:_authToken=$env:NPM_TOKEN" | Out-File -Encoding ascii .npmrc

# Publish
npm publish --access public

# Cleanup immediately
Remove-Item .npmrc -Force
Remove-Item env:\NPM_TOKEN
```
