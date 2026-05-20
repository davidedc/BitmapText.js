# Documentation Index

## Documentation Strategy

Each document has a **single responsibility** to avoid duplication:

### Primary Responsibilities

- **CLAUDE.md** (project root): Constraint set + router for agent sessions — universal invariants, hot-path discipline, refactor gates, pointers to deeper docs. Auto-loaded into Claude Code sessions.
- **README.md**: Quick start, API examples, build instructions, font assets building workflow, brief testing overview.
- **docs/ARCHITECTURE.md**: System design, component organization, architectural patterns, OO design, data flow diagrams.
- **docs/FONT_SET_FORMAT.md**: JSON font set specification format for FontSetGenerator.
- **docs/PLAYWRIGHT_AUTOMATION.md**: Playwright automation flows (builder, hash generation, screenshots).
- **scripts/README.md**: Complete automation pipeline documentation, script usage, dependency requirements.
- **dist/README.md**: Bundle contents, sizes, distribution options.
- **perf/README.md**, **perf/profiling/README.md**: Performance harnesses, profiling workflow.

### What NOT to Include (Anti-Duplication Rules)

**README.md should NOT contain:**
- Architecture implementation details (→ docs/ARCHITECTURE.md)
- Detailed script automation instructions (→ scripts/README.md)

**docs/ARCHITECTURE.md should NOT contain:**
- API usage examples (→ README.md)
- Script development instructions (→ scripts/README.md)
- Quick start guides (→ README.md)

**scripts/README.md should NOT contain:**
- API examples (→ README.md)
- Architecture theory (→ docs/ARCHITECTURE.md)

### Cross-Reference Pattern

**Instead of duplicating content, use references:**
- "See README.md for API examples"
- "See docs/ARCHITECTURE.md for design details"
- "See scripts/README.md for automation pipeline"

### Single Source of Truth

- **Universal invariants + refactor gates**: CLAUDE.md (root) only
- **API examples**: README.md only
- **Architecture details**: docs/ARCHITECTURE.md only
- **Script automation**: scripts/README.md only

## Quick Navigation

- **Constraints / hot-path / gates** → CLAUDE.md (project root)
- **Getting started** → README.md
- **Understanding the design** → docs/ARCHITECTURE.md
- **Font set specification format** → docs/FONT_SET_FORMAT.md
- **Script automation** → scripts/README.md
- **Font assets building** → public/font-assets-builder.html
- **Testing** → public/test-renderer.html

## Documentation Maintenance

### Key Invariants

1. **No duplication**: Each piece of information has exactly one authoritative source.
2. **Cross-references**: Documents link to each other rather than duplicating content.
3. **Single responsibility**: Each document covers one primary concern.
4. **Navigation clarity**: Quick reference guide helps users find the right document.

### Content Guidelines

- Keep root CLAUDE.md tight (≤ ~100 lines): constraints, hot-path discipline, refactor gates, pointers. No prose documentation.
- Keep README.md focused on getting users started quickly.
- Reserve ARCHITECTURE.md for deep technical implementation details.
- Document all script automation thoroughly in scripts/README.md.