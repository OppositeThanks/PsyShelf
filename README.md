# PsyShelf

PsyShelf is a private, local-first Windows desktop library for professional psychology resources. It accepts any file type or web link, organizes each resource into multiple categories and languages, and keeps the metadata editable through a review-and-override workflow.

The first launch includes the usable entries imported from the original `RECURSOS PSI` Google Sheet. Incomplete rows such as **The Help** and **Laufey** are deliberately marked as drafts instead of filling gaps with invented information.

## What works in this MVP

Resource details now include publication year, clinical topic, theoretical approach,
audience, a 1–5 rating, and personal notes. Use **Edit details & notes** in a resource’s
details panel, or fill these optional fields when adding a link. These fields save
directly without AI review. Search includes year, topic, approach, audience and notes;
the sort menu supports highest rating and newest publication. Existing libraries are
migrated automatically. The fields are included in backups and shared metadata exports,
including personal notes.

- Store any file format as either a reference to its current location or a managed copy.
- Add web links with title, authors, categories, languages, and a short description.
- Assign multiple authors, categories, and languages to one resource.
- Search across the complete catalog and filter by category or language.
- Preview common PDFs, images, audio, video, and text formats inside the app.
- Open every other format through Windows and recommend an appropriate free viewer from its official website.
- Analyze metadata with a free local Ollama model.
- Submit metadata corrections to the local review agent and apply the owner's final override when needed.
- Ask conversational questions about the library; exact catalog search remains available while the local model is offline.
- Export shareable metadata packages, optionally including a file after the owner confirms permission to share it.
- Back up the SQLite database and managed files to a Google Drive, OneDrive, or other cloud-synchronized folder.

## Install and run

[**Download PsyShelf for Windows (.exe)**](https://github.com/OppositeThanks/PsyShelf/releases/latest/download/PsyShelf-Setup-Windows.exe)

This direct download becomes available after the first release using this workflow is published. You can also find installers on the [Releases page](https://github.com/OppositeThanks/PsyShelf/releases).

1. Download **PsyShelf-Setup-Windows.exe** from the link above.
2. Double-click it. Setup installs PsyShelf for your Windows user, creates desktop and Start menu shortcuts, and opens the app automatically.
3. Once setup finishes, you can delete the downloaded `.exe`. Open PsyShelf using its shortcuts from then on.

**No file extraction, source-code download, or separate Node.js installation is needed.** The installer contains the application and its runtime. Local AI features use the separate, optional Ollama setup below.

Remove the installed application through **Settings > Apps > Installed apps**. Deleting the downloaded installer does not uninstall PsyShelf or delete your library.

### Uninstall

Open **Agent & backup settings → Uninstall PsyShelf…** in an installed Windows copy. Choose **Keep library** to retain local data for reinstallation, or **Delete local data** to permanently remove the catalog, notes, managed copies, settings, caches, and local safety backups. Referenced originals and backups outside the app-data folder remain untouched. Active copies are cancelled safely first. The standard **Windows Settings → Apps → Installed apps** uninstaller keeps library data by default.

### Development

The locally built Windows installer is produced at:

```text
dist/PsyShelf-Setup-0.1.0-Windows.exe
```

For development, install Node.js 24 or later and pnpm, then run:

```powershell
pnpm install
pnpm start
```

For a live desktop preview, run `pnpm dev`. Changes under `renderer/` reload the
window; changes under `electron/` or `src/` restart the app. Save any unfinished
form edits before changing source files. Close the window to stop the preview.

Run the checks with:

```powershell
pnpm test
```

Create a new Windows installer with:

```powershell
pnpm run dist:win
```

### Download or publish the Windows build with GitHub Actions

End users should use the direct `.exe` download above. GitHub's **Source code (zip)** and **Code > Download ZIP** contain source files, not the installer.

Every successful push to **main** now tests, builds, and publishes a Windows installer automatically. Manual runs on main also publish; pull requests only build. Build versions use the package major/minor and workflow run number (for example, 0.2.42). Check the installed version at the top of **Agent & backup settings**.

The stable download link points to the latest successful release. Use **Agent & backup settings → Application updates** to check and download a newer installer. Run the downloaded EXE when you are ready; installation is never automatic. Versions before this feature need one manual download first. Failed builds leave the previous download available. GitHub Actions artifacts are ZIP archives intended for development; end users only need the release EXE.

Matching version tags can still publish explicit releases. Use a higher major/minor in package.json before starting a new release series.

### Windows SmartScreen

The installer is currently unsigned, so Windows may show **Unknown publisher**. Only run installers obtained from this repository that you trust. Removing the unknown-publisher label requires a trusted code-signing certificate or signing service. Even signed new apps can receive SmartScreen reputation warnings. Do not disable Windows protection. See [Microsoft's signing and reputation guidance](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).

## Free local AI setup

On first use, the **Agent setup** assistant checks RAM, available memory, CPU,
graphics information, and free space on the estimated Ollama model drive locally.
It recommends Qwen3 0.6B, 1.7B, 4B, or 8B, with conservative memory/CPU limits.
It explains how to install Ollama, copy the model download command into PowerShell,
and verify installation before selecting the model. Nothing downloads automatically.
Close it to continue without AI; reopen it through **Agent & backup settings →
Check computer & set up agent**, including to scan after a hardware change.

The estimates are not performance guarantees or GPU compatibility checks. Graphics
are informational; recommendations use a CPU/RAM baseline. Model storage is inferred
from `OLLAMA_MODELS` or the default user folder and may differ from the running
Ollama service. Model calls use a 4,096-token context budget to limit memory use;
very large catalog prompts may exceed it. PsyShelf no longer silently substitutes a
different installed model when the selected model is missing.

Download sizes come from the [official Qwen3 model list](https://ollama.com/library/qwen3).
Installation guidance follows [Ollama for Windows](https://docs.ollama.com/windows).

1. Install [Ollama for Windows](https://ollama.com/download/windows).
2. Open PowerShell and run `ollama pull qwen3:4b`.
3. Open PsyShelf → **Agent & backup settings** and keep `qwen3:4b` as the selected model.

Qwen3 is a practical multilingual starting point: the 4B package is approximately 2.5 GB and the model family supports more than 100 languages. Larger Qwen3 variants can be selected later if the computer has enough memory and the 4B model is not accurate enough. See the [official Ollama Qwen3 library page](https://ollama.com/library/qwen3).

PsyShelf sends selected catalog information and document excerpts only to the Ollama service running on `127.0.0.1`. It does not require a paid AI API.

## In-app update notifications and downloads

Installed Windows x64 builds check GitHub at startup and every six hours while open. A sidebar notice appears when a newer stable installer is available. Turn automatic checks off in **Agent & backup settings → Application updates**; **Check for updates** still works manually. These checks contact GitHub without uploading library content.

Choose **Download update** to save the installer in your Windows Downloads folder. Progress and cancellation are available while the app remains usable. The download is pinned to the checked release and its SHA-256 checksum is verified before the final EXE appears. Failed or cancelled partial downloads are removed, and existing downloads are preserved.

Choose **Show installer in Downloads**, then run it when you are ready. Installation is not automatic; you can delete the EXE afterward. Existing SmartScreen warnings may still appear because installers are unsigned. Downloaded files remain in Downloads after restarting PsyShelf; the in-app download status lasts for the current session. Offline or rate-limited checks can be retried. Development builds offer manual checks only.

## Answers linked to sources and pages

Open **Ask library** and ask a specific question. PsyShelf searches local PDF and text content in a background worker, then asks Ollama to answer from the selected excerpts. Each statement has clickable references such as **[S1]**. Click one to inspect its supporting excerpt, then **Open source page** to open the PDF at that page. PDF numbers count physical pages from the start of the file; printed page labels may differ.

Text files have passage references without invented page numbers. Web links and unreadable/unsupported documents can contribute catalog descriptions, explicitly labeled **Catalog description only**; their full contents are not fetched. Source content remains in its original language. Interface controls support English, French, and Spanish.

If Ollama is unavailable, matching excerpts are still shown. If the model returns unknown or missing source IDs, its answer is discarded and the excerpts remain available. Valid IDs establish where an excerpt came from, not whether every model interpretation is correct: read the excerpts before relying on an answer.

Current limits: lexical matching (not semantic or cross-language search), up to 30 candidate resources per question, PDFs up to 32 MiB, the first 600 pages and one million extracted characters per document, and eight selected excerpts. Search limitations identify missing, protected, unsupported or partially read files. Scanned PDFs need OCR, which is not included yet. Office/e-book extraction is not included. Files are read again for each question; after editing a source, ask again for updated references. Questions are independent; this does not add persistent chat history or document indexing.

## File previews and helper recommendations

Every format is accepted and stored. Built-in preview support is intentionally limited to formats Chromium can render safely and consistently. For other formats, the Preview Helper offers Windows opening plus verified official links to free tools:

- Office and OpenDocument files: [LibreOffice](https://www.libreoffice.org/download/download-libreoffice/)
- EPUB and other e-books: [calibre](https://calibre-ebook.com/download_windows)
- Specialist audio/video: [VLC](https://www.videolan.org/vlc/)
- Archives: [7-Zip](https://www.7-zip.org/download.html)
- Specialist image formats: [GIMP](https://www.gimp.org/downloads/)

The helper never silently installs software. The user is redirected to the verified official page and remains in control of the installation.

## Google Drive and cloud backup

Install Google Drive for Desktop or another sync client, then choose one of its local folders under **Agent & backup settings**. After database changes, PsyShelf automatically creates dated snapshots inside `PsyShelf Backup/`. Each snapshot contains:

- `psyshelf.sqlite`
- managed file copies under `library-files/`
- `backup-info.json`

### Background file operations

Imports, backups, shared-file exports, and restore preparation show a **Background activity** panel with the current phase, file count, byte progress, and **Cancel**. The panel also appears inside open dialogs. Browsing and searching remain available during file copying. Completion, cancellation, and failures appear in the panel; dismiss it when finished.

Only one file operation runs at a time. Automatic backups are combined while work is running and run afterward if the library changed. Cancelling an import adds no entries and removes its temporary copies; cancelling a backup or export leaves previous completed copies intact. Cancellation is checked between file chunks and validation steps; a database snapshot or a stalled disk read must finish its current step first. The final import/restore commit cannot be cancelled. Closing the app cancels pending copies and waits for safe cleanup.

### Restore a backup

Open **Agent & backup settings → Restore backup…**, then select a dated backup folder containing `psyshelf.sqlite`. Or expand **Backup history & safety copies** and click **Restore** next to a saved copy. Original single-folder PsyShelf backups are also accepted. Check the resource and file counts, then choose **Restore library** to replace the current catalog and managed files. Cancel leaves the library unchanged.

PsyShelf validates the database and checks that managed files exist before restoring. It reconnects managed files to this computer's library folder and saves a local safety snapshot under the application-data folder's `restore-safety/` directory before replacement. Use **Backup history & safety copies** to find that folder if you need to undo a restore. Settings stay unchanged. Referenced originals retain their old paths and need to exist there separately.

New backups are stored in separate dated folders under `PsyShelf Backup/`, with the database, managed files, and backup information together. The settings panel shows backup history, the last successful backup in the selected folder, and backup errors. Older snapshots are retained until you delete them manually; allow disk space for full copies of the library. Local safety copies do not protect against loss of the computer.

Restore stages the selected data before replacing the library, rolls back if opening the restored database fails, and recovers an interrupted replacement on next launch. Empty restored libraries stay empty. File copies and backup checks now run in a background worker. During restore preparation you can browse and search, but library edits are paused so the safety copy remains accurate. The final library replacement briefly pauses operations and cannot be cancelled. This feature is in source and needs a new release to reach installed copies.

Referenced originals are not copied into backups. This MVP provides a safe one-way backup, not multi-device conflict resolution. A future phone app should use an authenticated synchronization service rather than writing to the same SQLite file from two devices.

## Data and privacy

- This project is designed for professional reading material, not patient records.
- The live database and managed files stay in the local Electron application-data folder.
- Deleting an entry preserves its original or managed file.
- Sharing includes the underlying file only after the owner actively confirms copyright or other permission.
- No account or login is required in this single-user version.

## Project structure

```text
electron/   Secure main process, SQLite database, local agents, filesystem and sharing
renderer/   Modifiable desktop interface
src/        Seed data and reusable file/search helpers
test/       Unit checks
scripts/    Automated Electron smoke test
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for data boundaries and the mobile-ready direction.

## Update history

### 2026-09-10

- Ship the previously local sidebar scrolling, resource notes/details, preview, language, and setup improvements in the public installer.
- Publish tested main builds automatically; show the installed version in settings and explain SmartScreen signing requirements.

- Added background file operations with progress, cancellation, safe import commits, and queued automatic backups.

- Added an in-app uninstall action with keep-library and delete-local-data choices.

- Added validated backup restoration, safety copies, dated backup history, and backup status in settings.

### 2026-09-09

- Simplified Windows setup to install for the current user, create shortcuts, and launch PsyShelf automatically. The installer can be deleted after setup.
- Added a stable direct `.exe` download filename and release installation instructions. The download becomes available when a GitHub Release is published.
- Established the repository workflow: every completed modification includes a README update, appropriate checks, and a commit pushed to GitHub.

### 2026-09-11

- Added automatic in-app update notices, manual checks, cancellable installer downloads with checksum verification, and French/Spanish controls.

- Added document-grounded answers with source excerpts, PDF page navigation, validated reference IDs, offline excerpt search, and translated controls.

- Translate built-in category and resource-language labels, backup history/restoration, background progress, and uninstall confirmations into French and Spanish. Saved metadata and personal content stay unchanged.
- Future interface changes must include all supported translations, including native dialogs and accessibility text.
