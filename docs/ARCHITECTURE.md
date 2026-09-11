# PsyShelf architecture

## Design goals

1. Remain useful without an internet connection or paid service.
2. Accept every file format without claiming that every format can be rendered internally.
3. Keep file ownership decisions explicit on every import.
4. Preserve user authority over AI-generated or AI-reviewed metadata.
5. Keep the interface and data model adaptable for a later mobile client.

## Runtime boundaries

The Electron renderer has no direct Node.js or filesystem access. A sandboxed preload exposes a small IPC API. Filesystem operations, SQLite statements, application launching, backups, and local-model calls are confined to the main process.

Untrusted titles, descriptions, and agent responses are escaped before being inserted into the interface. External helper links are restricted to an allowlist of verified official domains.

## Data model

`resources` stores the core catalog:

- identity and timestamps
- title
- authors as a JSON array
- categories as a JSON array
- languages as a JSON array
- short description
- source kind (`file`, `url`, `google-sheet`, or manual)
- file path or URL
- reference/copy storage choice
- file extension
- ready/draft status

`corrections` stores the requested changes, the user's reason, the local agent's decision and explanation, and whether the owner overrode that decision.

The JSON array fields keep the first version simple while supporting multiple values. If advanced reporting becomes important, they can later be normalized into relationship tables without changing the user-facing model.

## Local agents

The application presents one Agent Hub with three bounded roles:

- **Metadata agent:** proposes title, author, languages, categories, and a concise description. It is instructed to leave uncertain fields empty.
- **Correction agent:** compares current and requested metadata, accepts reasonable owner-supplied corrections, or explains a rejection. The owner can always override.
- **Preview helper:** detects internal support and recommends a free compatible application from an official download page when necessary.

When Ollama is offline, catalog search and all library features continue working. Metadata analysis pauses, and correction requests move to the explicit owner-override path.

## Mobile direction

The renderer is plain web technology and the data contract is already isolated behind IPC. A future mobile app can reuse the information architecture and replace Electron IPC with a mobile repository/synchronization layer. Recommended future work:

1. Introduce stable API DTOs and database migrations.
2. Add authentication only when a second device or user exists.
3. Sync resource metadata through a managed API with conflict handling.
4. Upload only managed files, preserving reference-only semantics for local files.
5. Encrypt cloud data and add offline queues.

## Additional resource details

The `resources.details` JSON column stores publication year, clinical topic,
theoretical approach, audience, rating, and personal notes. Startup adds this column
to older databases without replacing their records. Main-process normalization
validates year and rating and preserves untouched fields during metadata corrections
or AI analysis. Direct editing is available without Ollama; exports and backups
retain these fields.

## Source-grounded answers

`source-evidence.cjs` extracts local PDF pages using PDF.js and text passages, ranks lexical matches, and validates structured model references. `evidence-search.cjs` runs retrieval in a bounded worker with a 90-second timeout; it does not block the Electron event loop or persist document text. `agent:chat` passes at most eight excerpts to local Ollama and rejects answers with missing or unknown source IDs. The renderer builds source cards with textContent and keeps excerpts and generated answers outside interface translation. Page numbers originate from PDF extraction, never from model output. PDF preview navigation uses the physical page number in the local viewer URL. Catalog-only evidence is labeled explicitly.

## Application updates

`app-updates.cjs` queries the fixed public GitHub latest-release endpoint and compares stable numeric versions. It accepts only versioned Windows assets under this repository, streams an explicitly requested download into a unique `.part` file in Downloads, and checks its exact size and SHA-256 before renaming it to EXE. No renderer-supplied URL or path is accepted. The existing installer is never launched automatically. Electron exposes check/download/cancel/reveal operations and broadcasts progress; quit waits for partial-download cleanup. Installed builds check on startup and every six hours unless the persisted preference disables checks. Test data directories isolate downloads and disable automatic network checks.
