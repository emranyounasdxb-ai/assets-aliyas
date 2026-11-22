# Property photos and documents

Open **Properties → View property → Photos & documents**, directly below property details.

- **Add photos** accepts JPG, PNG and WebP. Select up to 20 files per batch, up to 20 MB per file and 40 megapixels per image. Uploads run sequentially, with progress and retry of remaining files. Successful uploads are not duplicated on retry.
- **Add documents** accepts PDF and the same image formats. Choose Floor plan for property maps/plans, Contract or Other for supporting files.
- **Set cover** chooses the property card and detail banner thumbnail. The first photo becomes the default cover; a batch can explicitly use its first photo. Replacing a selected cover through Documents carries the selection to the new version.
- Thumbnails are generated as small, auto-oriented WebP images. Preview/download opens the original. Renaming changes its display/download name, not the stored file path.
- **Archive** removes a file from the gallery, document lists and downloads. Its private original and audit history are retained. Archiving the selected cover uses another current photo when available.

Owners, managers and accountants can manage files. Viewers can see property photos and floor plans; sensitive documents remain restricted. All uploads use the existing authenticated, workspace-scoped, antivirus-scanned private storage. Scanner failures block uploads. No public upload folder or file URL is created.

## Existing installations

Back up the dedicated assets database and private files before upgrading. Run `scripts/migrate.mjs` with the existing private environment and temporary DDL privileges on the assets database only, then restore runtime CRUD privileges. Version `001_self_hosted` remains immutable. Additive `002_property_media` creates `property_covers`, preserving all existing properties, documents, accounts and financial records. Re-running migration is safe. Cover changes, replacements and archival serialize on the workspace transaction lock.
