; Java relationship-bearing-syntax captures (specs/004-engineering-relationship-graph).
; Node types verified against the same pinned tree-sitter-wasms@0.1.13
; tree-sitter-java grammar Feature 002's symbols/queries/java.scm already
; uses. EXPORTS has no Java equivalent captured here — Java has no explicit
; export keyword; Feature 002's is_exported population (if any signal exists
; for Java) is consumed as-is by contains-derivation.ts, not re-derived here.

(import_declaration
  (scoped_identifier) @rel.import.path) @rel.import

(class_declaration
  name: (identifier) @rel.subject.name
  superclass: (superclass (type_identifier) @rel.extends.name)) @rel.extends

(class_declaration
  name: (identifier) @rel.subject.name
  interfaces: (super_interfaces
    (type_list (type_identifier) @rel.implements.name))) @rel.implements

(interface_declaration
  name: (identifier) @rel.subject.name
  (extends_interfaces
    (type_list (type_identifier) @rel.extends.name))) @rel.extends

(method_invocation
  name: (identifier) @rel.call.name) @rel.call
