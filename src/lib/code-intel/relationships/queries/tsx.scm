; TSX relationship-bearing-syntax captures (specs/004-engineering-relationship-graph).
; Per Feature 002's own confirmed finding (symbols/queries/tsx.scm): the tsx
; grammar's declaration/call/import node types are structurally identical to
; typescript.scm's — JSX adds only a disjoint node-type set that never
; matches these patterns. EXPORTS is D1-only (contains-derivation.ts), never
; captured here.

(import_statement
  source: (string (string_fragment) @rel.import.path)) @rel.import

(class_declaration
  name: (type_identifier) @rel.subject.name
  (class_heritage
    (extends_clause
      value: (identifier) @rel.extends.name))) @rel.extends

(class_declaration
  name: (type_identifier) @rel.subject.name
  (class_heritage
    (implements_clause
      (type_identifier) @rel.implements.name))) @rel.implements

(interface_declaration
  name: (type_identifier) @rel.subject.name
  (extends_type_clause
    (type_identifier) @rel.extends.name)) @rel.extends

(call_expression
  function: (identifier) @rel.call.name) @rel.call

(call_expression
  function: (member_expression
    property: (property_identifier) @rel.call.name)) @rel.call
