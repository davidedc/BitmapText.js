# Documentation Index

## Documentation Strategy

Each document has a **single responsibility** to avoid duplication:

### Primary Responsibilities

- **README.md**: Quick start, API examples, build instructions, font assets building workflow, brief testing overview
- **docs/ARCHITECTURE.md**: System design, component organization, architectural patterns, OO design, data flow diagrams
- **docs/CLAUDE.md**: Claude-specific development context and workflow tips ONLY
- **scripts/README.md**: Complete automation pipeline documentation, script usage, dependency requirements

### What NOT to Include (Anti-Duplication Rules)

**README.md should NOT contain:**
- Architecture implementation details (→ docs/ARCHITECTURE.md)
- Detailed script automation instructions (→ scripts/README.md)

**docs/CLAUDE.md should NOT contain:**
- API usage examples (→ README.md)
- Script automation details (→ scripts/README.md) 
- Build instruction details (→ README.md)
- Architecture explanations (→ docs/ARCHITECTURE.md)

**docs/ARCHITECTURE.md should NOT contain:**
- API usage examples (→ README.md)
- Script development instructions (→ scripts/README.md)
- Quick start guides (→ README.md)

**scripts/README.md should NOT contain:**
- API examples (→ README.md)
- Architecture theory (→ docs/ARCHITECTURE.md)
- Claude development tips (→ docs/CLAUDE.md)

### Cross-Reference Pattern

**Instead of duplicating content, use references:**
- "See README.md for API examples"
- "See docs/ARCHITECTURE.md for design details" 
- "See scripts/README.md for automation pipeline"
- "See docs/CLAUDE.md for Claude development tips"

### Single Source of Truth

- **API examples**: README.md only
- **Architecture details**: docs/ARCHITECTURE.md only
- **Script automation**: scripts/README.md only
- **Claude guidance**: docs/CLAUDE.md only (no duplication from other docs)

## Quick Navigation

- **Getting started** → README.md
- **Understanding the design** → docs/ARCHITECTURE.md  
- **Script automation** → scripts/README.md
- **Development with Claude** → docs/CLAUDE.md
- **Font assets building** → public/font-assets-builder.html
- **Testing** → public/test-renderer.html

## Documentation Maintenance

### Key Invariants

1. **No duplication**: Each piece of information has exactly one authoritative source
2. **Cross-references**: Documents link to each other rather than duplicating content
3. **Single responsibility**: Each document covers one primary concern
4. **Navigation clarity**: Quick reference guide helps users find the right document

### Content Guidelines

- Keep README.md focused on getting users started quickly
- Reserve ARCHITECTURE.md for deep technical implementation details
- Use CLAUDE.md only for Claude-specific development context
- Document all script automation thoroughly in scripts/README.md