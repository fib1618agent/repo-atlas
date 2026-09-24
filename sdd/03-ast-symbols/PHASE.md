# Phase 03 — Polyglot AST and Symbol Intelligence

## Objective

Turn source snapshots into a language-neutral structural representation.

## Initial languages

Java, TypeScript, JavaScript, Python.

## Requirements

1. Use deterministic parsers/AST extraction.
2. Extract applicable modules/files, packages/namespaces, classes, interfaces, enums, functions, methods, constructors, variables/constants, imports, and exports.
3. Symbols SHALL have stable snapshot-scoped identities.
4. Declarations SHALL retain source locations.
5. Language-specific analyzers SHALL emit a common intermediate representation.
6. Parser failures SHALL be file-scoped.
7. Evidence states SHALL be `EXTRACTED`, `RESOLVED`, `INFERRED`, or `UNKNOWN`.
8. Inference MUST NOT be represented as deterministic extraction.
9. Framework-specific extraction may be added only where deterministic.

## Acceptance

Representative fixtures for all initial languages produce expected symbols and locations; ambiguous/dynamic constructs retain uncertainty.

## Non-goals

Complete runtime semantics, guaranteed dynamic dispatch, LLM parsing.
