## Summary

-

## Architecture Review

The agent must prove conformance before implementation, not explain correctness afterward.

Affected ADRs:

Affected Invariants:

Acceptance Tests:

Regression Risks:

Implementation Plan:

## Testing

-

## Release Gates

- [ ] Scope gate: scope-affecting config fields trigger sync-token invalidation, config save compares against persisted config state, and import-start boundaries use spreadsheet timezone.
- [ ] Recovery gate: `onOpen()` creates the menu even when config is invalid, and recovery/reset remains reachable in-sheet.
- [ ] Data safety gate: invalid config handling does not silently reset unrelated fields, and user-owned sheets/tabs/named ranges are not clobbered.
- [ ] Security gate: no credentials/tokens are committed, credential-like files are ignored, CI auth comes from secrets/environment, and HTML model injection is script-safe escaped.
- [ ] Quality gate: `git diff --check` and `bash scripts/preflight-review.sh` pass before commit/PR publication.
