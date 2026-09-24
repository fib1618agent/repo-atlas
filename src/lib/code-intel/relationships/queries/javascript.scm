; JavaScript relationship-bearing-syntax captures (specs/004-engineering-relationship-graph).
; Node types verified against the same pinned tree-sitter-wasms@0.1.13
; tree-sitter-javascript grammar Feature 002's symbols/queries/javascript.scm
; already uses. Five parse-dependent relationship types only — EXPORTS is
; D1-only (contains-derivation.ts, from Feature 002's own is_exported), never
; captured here.

(import_statement
  source: (string (string_fragment) @rel.import.path)) @rel.import

(class_declaration
  name: (identifier) @rel.subject.name
  (class_heritage (identifier) @rel.extends.name)) @rel.extends

(call_expression
  function: (identifier) @rel.call.name) @rel.call

(call_expression
  function: (member_expression
    property: (property_identifier) @rel.call.name)) @rel.call
