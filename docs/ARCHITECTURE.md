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

The agent contracts follow the current LangChain/LangGraph design guidance while keeping the runtime local and free:

- each role has a bounded instruction and receives only the context it needs;
- metadata and correction agents use explicit JSON schemas plus application-side validation;
- deterministic catalog search remains the fallback when model execution fails;
- owner correction and final override provide the human-in-the-loop checkpoint;
- model transport, prompt construction, validation, persistence, and UI rendering stay separate.

The direct Ollama transport is intentionally retained because these workflows are short, single-model operations with no tool loop. If a later workflow needs durable multi-step execution, tool calling, or resumable state, it should be implemented as a LangGraph workflow rather than expanding the main Electron process.

## Code organization

- `electron/main.cjs` owns desktop lifecycle, storage, and named IPC handlers.
- `src/agent-contracts.cjs` owns bounded prompts, JSON schemas, and model-output validation.
- `src/library-utils.cjs` owns reusable deterministic classification, preview, URL, filename, and search utilities.
- `renderer/app.js` owns view state and uses persistent delegated event handlers instead of recreating listeners after every render.

Every named function has a short description so future changes can be reviewed without reverse-engineering its purpose.

## Mobile direction

The renderer is plain web technology and the data contract is already isolated behind IPC. A future mobile app can reuse the information architecture and replace Electron IPC with a mobile repository/synchronization layer. Recommended future work:

1. Introduce stable API DTOs and database migrations.
2. Add authentication only when a second device or user exists.
3. Sync resource metadata through a managed API with conflict handling.
4. Upload only managed files, preserving reference-only semantics for local files.
5. Encrypt cloud data and add offline queues.

## Deferred fields reminder

The requested MVP deliberately stays simple. Revisit publication year, clinical topic, theoretical orientation, audience, rating, and personal notes after the base workflow has been used with real resources.
