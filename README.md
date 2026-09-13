# Learning Site Editor

Learning Site Editor is the Windows Electron replacement for both the original Python editor and the Learning Site Launcher. It keeps the renderer isolated from filesystem and process APIs while the Engine owns the portable project format and static-site build.

## What it manages

- Pages, nested folders, publication, order, slugs, tags, descriptions, RTL/LTR, table of contents and Markdown shortcuts.
- Branding, homepage, themes, favicon, media library, safe image-reference checks, local preview and recovery drafts.
- Local projects, legacy-project import and migration, GitHub cloning, commits, history, safe origin sync, checkpoints and official upstream updates.
- Static output from Engine 4 with navigation, search, theme toggle, table of contents, media and legacy-compatible metadata files.

## Development and releases

Run `npm install`, then `npm run dev`. Use `npm run release` for linting, tests and the Windows NSIS package. The installer, blockmap and `latest.yml` are written to `release/`.

The release workflow checks out `learning-site-editor`, `learning-site-engine`, and `learning-site-themes` together, then publishes the installer and its SHA-256 checksum when a `v*` tag is pushed. Publish the editor release before deploying `learning-site-web`; its download page reads the latest GitHub Release and checksum automatically.
