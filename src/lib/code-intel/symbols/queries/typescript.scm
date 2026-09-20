; TypeScript symbol capture patterns (T025, contracts/language-grammar-provider.md
; "Symbol query patterns"). Node types verified directly against the pinned
; tree-sitter-wasms@0.1.13 tree-sitter-typescript grammar (Language.types +
; real parse inspection) — not inferred from JavaScript or from memory.
;
; Real, confirmed distinctions this grammar has that Java/JavaScript do not:
;  - `namespace X { ... }` parses as node type `internal_module`.
;  - `module X { ... }` parses as a DIFFERENT node type, `module` — both are
;    legal TypeScript namespace/module declaration forms (the `module`
;    keyword is a legacy synonym for `namespace`), so both are captured as
;    @symbol.module here, per T025's "namespace/module declarations where
;    present" — this is the grammar's own actual namespace/module
;    representation, not an invented one.
;  - `interface_declaration` and `class_declaration` name fields are
;    `type_identifier`, not `identifier` (unlike JavaScript's plain
;    `class_declaration`, whose name field is `identifier`).
;  - `function_declaration` name field is `identifier`, same as JavaScript.
;  - `method_definition` (class methods, including constructors — same as
;    javascript.scm) and `method_signature` (interface methods, which have
;    no body) are two distinct node types, both captured as @symbol.method
;    per data-model.md's Symbol entity ("Method: ...bound to a Class OR
;    Interface as a member"); both use `property_identifier` for their name.
;
; No parent/child nesting or symbol_key logic is encoded here.

(internal_module
  name: (identifier) @symbol.name) @symbol.module

(module
  name: (identifier) @symbol.name) @symbol.module

(interface_declaration
  name: (type_identifier) @symbol.name) @symbol.interface

(class_declaration
  name: (type_identifier) @symbol.name) @symbol.class

(function_declaration
  name: (identifier) @symbol.name) @symbol.function

(method_definition
  name: (property_identifier) @symbol.name) @symbol.method

(method_signature
  name: (property_identifier) @symbol.name) @symbol.method
