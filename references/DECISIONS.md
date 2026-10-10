# Architectural and Design Decisions (ADR)

This document records architectural, schema, and operational decisions, deviations, and rationale made during the lifecycle of the project.

---

## ADR 001: Project Layout and Documentation Consolidation

- **Status**: Accepted
- **Context**: The Phase 1 brief specified documentation under `docs/`, but user instructions mandated placing all documentation within `references/` and deleting empty leftover directories (`docs/`, `database/`, `scripts/`, `src/`).
- **Decision**: All documentation is placed in `references/` instead of `docs/`. Empty leftover directories were removed.
- **Reason**: Adhere to user constraints while preserving the documentation specifications.
- **Consequences**: All file paths for ADRs, requirements, schema docs, diagrams, and progress reporting reference `references/`.
