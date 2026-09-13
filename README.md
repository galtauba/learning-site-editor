# Learning Site Editor

The production Electron desktop editor for Learning Site projects. It uses the Engine for project creation, validation, migration, and generated `public/` output; the renderer is isolated from filesystem and process APIs.

## Development

Run `npm install`, then `npm run dev`. Run `npm run lint && npm test && npm run package` before release. Windows packaging produces an NSIS installer in `release/`; tagged GitHub Actions releases publish the installer and SHA-256 checksums.

## Desktop controls

- `Ctrl+Shift+R` removes the selected project from the Editor's local list without touching its files.
- `Ctrl+Shift+D` deletes the selected local Git clone only after the exact project name is entered; it never removes a remote repository.
- Page slugs determine generated URLs. Changing a slug moves the page source safely and preserves exactly one content record.
