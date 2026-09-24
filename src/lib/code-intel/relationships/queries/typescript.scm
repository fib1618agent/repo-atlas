; TypeScript relationship-bearing-syntax captures (specs/004-engineering-relationship-graph).
; Extends JavaScript's shape with `implements_clause` (TS-only). EXPORTS is
; D1-only (contains-derivation.ts), never captured here.

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
