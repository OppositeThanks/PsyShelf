# PsyShelf

PsyShelf is a private, local-first Windows desktop library for professional psychology resources. It accepts any file type or web link, organizes each resource into multiple categories and languages, and keeps the metadata editable through a review-and-override workflow.

The first launch includes the usable entries imported from the original `RECURSOS PSI` Google Sheet. Incomplete rows such as **The Help** and **Laufey** are deliberately marked as drafts instead of filling gaps with invented information.

## What works in this MVP

- Store any file format as either a reference to its current location or a managed copy.
- Add web links with title, authors, categories, languages, and a short description.
- Assign multiple authors, categories, and languages to one resource.
- Search across the complete catalog and filter by category or language.
- Ask the library from a draggable floating AI bubble and fold the resource-details drawer away when more workspace is needed.
- Preview common PDFs, images, audio, video, and text formats inside the app.
- Open every other format through Windows and recommend an appropriate free viewer from its official website.
- Analyze metadata with a free local Ollama model.
- Analyze the computer privately on first launch, recommend a suitable Qwen3 size, and re-run the check from settings at any time.
- Submit metadata corrections to the local review agent and apply the owner's final override when needed.
- Ask conversational questions about the library; exact catalog search remains available while the local model is offline.
- Export shareable metadata packages, optionally including a file after the owner confirms permission to share it.
- Back up the SQLite database and managed files to a Google Drive, OneDrive, or other cloud-synchronized folder.

## Install and run

The packaged portable build is produced at:

```text
dist/PsyShelf-0.3.0-Windows.exe
```

It can be launched directly and does not require a separate Node.js installation.

For development, install Node.js 24 or later and pnpm, then run:

```powershell
pnpm install
pnpm start
```

Run the checks with:

```powershell
pnpm test
```

Create a new Windows portable build with:

```powershell
pnpm run dist:win
```

## Free local AI setup

1. On first launch, review PsyShelf's private hardware recommendation and choose whether to use it.
2. Install [Ollama for Windows](https://ollama.com/download/windows).
3. Open PsyShelf → **Agent & backup settings**, copy the displayed `ollama pull ...` command, and run it in PowerShell.

The adviser measures RAM and usable CPU capacity, reports the processor and active graphics adapter, then makes a conservative selection from official Qwen3 packages ranging from 0.6B to 30B. The graphics adapter is shown for transparency but does not trigger an unsafe upgrade because graphics-memory reporting varies by Windows driver. The result stays in local settings, is never uploaded, does not automatically download a model, and can be refreshed or overridden later. See the [official Ollama Qwen3 library page](https://ollama.com/library/qwen3).

PsyShelf sends catalog context only to the Ollama service running on `127.0.0.1`. It does not require a paid AI API.

## File previews and helper recommendations

Every format is accepted and stored. Built-in preview support is intentionally limited to formats Chromium can render safely and consistently. For other formats, the Preview Helper offers Windows opening plus verified official links to free tools:

- Office and OpenDocument files: [LibreOffice](https://www.libreoffice.org/download/download-libreoffice/)
- EPUB and other e-books: [calibre](https://calibre-ebook.com/download_windows)
- Specialist audio/video: [VLC](https://www.videolan.org/vlc/)
- Archives: [7-Zip](https://www.7-zip.org/download.html)
- Specialist image formats: [GIMP](https://www.gimp.org/downloads/)

The helper never silently installs software. The user is redirected to the verified official page and remains in control of the installation.

## Google Drive and cloud backup

Install Google Drive for Desktop or another sync client, then choose one of its local folders under **Agent & backup settings**. After database changes, PsyShelf automatically refreshes a `PsyShelf Backup` folder containing:

- `psyshelf.sqlite`
- managed file copies under `library-files/`
- `backup-info.json`

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
