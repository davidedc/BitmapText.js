# Documentation Index

## Documentation Strategy

Each document has a **single responsibility** to avoid duplication:

### Primary Responsibilities

- **README.md**: Quick start, API examples, build instructions, brief testing overview
- **ARCHITECTURE.md**: System design, component organization, architectural patterns, OO design
- **CLAUDE.md**: Claude-specific development context and workflow tips ONLY

### What NOT to Include (Anti-Duplication Rules)

**README.md should NOT contain:**
- Architecture implementation details (→ ARCHITECTURE.md)

**CLAUDE.md should NOT contain:**
- API usage examples (→ README.md)
- Build instruction details (→ README.md)
- Architecture explanations (→ ARCHITECTURE.md)

**ARCHITECTURE.md should NOT contain:**
- API usage examples (→ README.md)

**tests/README.md should NOT contain:**
- API examples (→ README.md)
- Architecture theory (→ ARCHITECTURE.md)

### Cross-Reference Pattern

**Instead of duplicating content, use references:**
- "See README.md for API examples"
- "See ARCHITECTURE.md for design details" 

### Single Source of Truth

- **API examples**: README.md only
- **Architecture details**: ARCHITECTURE.md only
- **Claude guidance**: CLAUDE.md only (no duplication from other docs)

## Quick Navigation

- **Getting started** → README.md
- **Understanding the design** → ARCHITECTURE.md  
- **Development with Claude** → CLAUDE.md