# Deployment review — 2026-10-02

Operator supplied by owner: OppositeThanks. Intended launch: France and Spain.
This is an engineering audit and draft policy implementation, not legal clearance.

## Release reminders

- Before public distribution, verify OppositeThanks is the publishable legal identity and supply a business address and monitored public privacy contact. The owner requested that contact information remain omitted for now. The in-app deletion request screen clearly says it does not submit requests.
- Have French/Spanish consumer and privacy terms reviewed for the actual operator, free/paid distribution, mandatory guarantees, withdrawal rights if sold, and applicable law. Choose an app distribution license; none is currently declared. Do not treat notice dismissal as terms acceptance.
- Verify rights to the starter catalog imported from RECURSOS PSI and `build/icon.ico`. No source license or ownership evidence for these assets was found. Do not infer rights from repository possession. Catalog entries do not license their referenced books/media.
- Review bundled native binaries, OCR trained data and upstream embedded notices. The generated inventory includes installed production and development packages and verbatim top-level legal files; it is not a complete binary license clearance. Review every UNDECLARED or missing-notice entry and any reciprocal license before shipment. Preserve Electron's Chromium license/credits files in packaging. Review Ollama/model terms separately before recommending redistribution; they are separately installed.
- Set up a monitored privacy-request process: minimal reply address and request description, proportionate identity checks, one-month GDPR response tracking, lawful extensions/exceptions and appropriate retention. Never ask for the library/password/patient information just to identify a requester.
- Pushing main invokes the repository's existing automatic installer release workflow. Policy drafts remain visibly marked pending contact configuration/review; source publication does not resolve these release requirements.

## Data and network inventory

| Component | Data/purpose | Destination/retention | Control |
|---|---|---|---|
| SQLite, managed files | Catalog, notes, annotations, paths, reading state | Local app-data until removed | Existing export/removal/uninstall |
| Search/OCR | Extracted document text; English/French/Spanish OCR | Local index until cleared; included local storage | Library tools clear-index; no remote OCR SDK |
| Preferences | Model, language, backup folder, layout, privacy notice acknowledgement | Settings and localStorage until cleared | Local necessary storage; no tracking consent record |
| App security | Salted lock hash, DPAPI-protected derived backup key | Local app-data | Existing opt-in lock/encryption; no password telemetry |
| AI | Questions, relevant metadata, selected passages | Local Ollama loopback; separate service behavior | Explicit AI actions; verify trusted Ollama configuration |
| Update check/download | IP/network headers; release query/download | GitHub infrastructure, upstream retention | New installations default automatic checks off; existing explicit settings retained; manual check available |
| Backups/exports | Full library for backup; reviewed fields/files for sharing | Chosen folder, possibly synced externally; retained until user deletes | Existing folder choice, optional backup encryption, notes/files unchecked in export review |
| Hardware check | CPU/RAM/GPU/free space | Local scan; no publisher upload | Optional setup |
| External sites | Browser/network data | User's browser and destination policies | Explicit link action |

No advertising, analytics, marketing signup, account form, remote font or image service was found in the inspected code. Fonts are OS/system fonts (Segoe UI, Georgia), not distributed font files. Branding in the renderer is text/CSS; the installer icon still requires ownership evidence. User-imported images/files are not publisher-licensed assets.

## Forms and consent review

Local add/edit/search/settings forms do not submit to a publisher. Required URL/title fields serve the requested catalog operation; notes and enrichment fields remain optional. No bundled marketing/privacy checkbox is added to local actions. Backup folders and encryption are user-selected. Sharing files requires existing rights acknowledgement, with personal notes/attachments excluded unless selected. AI has a disclosed local processing destination. No optional browser tracking exists, so the banner explains necessary storage and offers dismissal/reopening, rather than recording fictitious cookie consent. Adding any optional tracking in future requires prior, granular opt-in, equally accessible refusal and withdrawal, plus gating the SDK before it runs.

## Deletion limits

The installed Windows uninstall flow offers deletion of catalog, managed files, settings, caches and local safety backups. Entry removal alone preserves files. Referenced originals, external backups/exports, synced cloud history/recycle bins, clipboard contents and Ollama data require separate removal. Deletion does not promise secure disk erasure. The publisher cannot remotely delete a local-only library. The in-app request instructions cover separately submitted publisher information but cannot submit a request until a contact channel exists.

## Validation results

65 unit tests passed. Real Electron security and privacy smoke tests passed, including new-install update-check opt-in, legal-notice IPC, EN/FR/ES policy content and persisted banner dismissal. Production and full dependency audits reported zero known advisories on 2026-10-02; this does not establish absence of vulnerabilities. Installed inventory captured 280 package/version declarations; 21 packages had no top-level legal file. No UNDECLARED license or GPL/AGPL/LGPL declaration was found in that inventory. Embedded/native/model license review remains open.

### Sources

- GDPR transparency, rights and response rules: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
- Necessary cookies and prior consent: https://europa.eu/youreurope/business/growing/digitalising/online-privacy/index_en.htm
- France CNIL cookies: https://www.cnil.fr/fr/cookies-et-autres-traceurs
- Spain AEPD cookies guide: https://www.aepd.es/guias/guia-cookies.pdf
