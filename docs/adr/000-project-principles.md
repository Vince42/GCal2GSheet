# ADR-000: Project Principles

## Status

Accepted.

## Context

The project is intended to be maintained by humans and coding agents over time. Recent regressions show that explaining a change after implementation is not enough: contributors must identify the architectural contract before changing the system.

Future ADRs define specific contracts, but the project also needs a first principle that governs how those contracts are applied during development and review.

## Decision

The agent must prove conformance before implementation, not explain correctness afterward.

Before modifying code or behavior, contributors MUST identify:

1. affected ADRs,
2. affected invariants,
3. acceptance tests,
4. regression risks, and
5. the implementation plan.

Implementation may begin only after this conformance analysis is complete. Pull requests MUST preserve that analysis so reviewers can verify that the change was designed against the architectural contracts rather than justified retroactively.

## Invariants

- Architectural conformance is established before implementation begins.
- Every behavior-changing pull request identifies affected ADRs and invariants.
- Every behavior-changing pull request identifies acceptance tests before implementation.
- Every behavior-changing pull request identifies regression risks before implementation.
- Implementation plans must be traceable to the affected invariants.
- Review evidence must show how the change complies with the project contracts.

## Allowed Future Changes

- The conformance checklist may add stricter review fields if they improve architectural traceability.
- Tooling may automate ADR, invariant, test, or risk detection if human-readable evidence remains in the pull request.
- Documentation-only changes may use a reduced conformance analysis when they do not modify runtime behavior, provided they still identify affected documents and review checks.
- Future ADRs may define more specific conformance requirements for their own domains.

## Explicitly Forbidden Changes

- Beginning implementation of behavior-changing work before identifying affected ADRs, invariants, acceptance tests, regression risks, and an implementation plan.
- Treating post-hoc explanation as a substitute for pre-implementation conformance analysis.
- Merging pull requests that omit architecture review evidence for affected contracts.
- Using implementation convenience to bypass ADR invariants or required acceptance tests.
