; TSX symbol capture patterns (T026, contracts/language-grammar-provider.md
; "Symbol query patterns"). Node types verified directly against the pinned
; tree-sitter-wasms@0.1.13 tree-sitter-tsx grammar (Language.types + real
; parse inspection) — not copied from typescript.scm without verification.
;
; Confirmed by direct inspection: this grammar's declaration-related node
; types (`internal_module`, `module`, `interface_declaration`,
; `class_declaration`, `function_declaration`, `method_definition`,
; `method_signature`) and their name fields are structurally identical to
; typescript.scm's — the tsx grammar only adds a disjoint set of JSX node
; types (`jsx_element`, `jsx_opening_element`, `jsx_closing_element`,
; `jsx_self_closing_element`, `jsx_attribute`, `jsx_expression`,
; `jsx_namespace_name`, `jsx_text`) that share no node type with any pattern
; below, so JSX content (e.g. a component's returned markup) can never match
; a symbol capture here — a function/component returning JSX is captured
; exactly once, as @symbol.function, via its function_declaration alone.
;
; Same real, confirmed distinctions as typescript.scm (T025): `namespace X{}`
; is `internal_module`, `module X{}` is a different node type `module` — both
; captured as @symbol.module per "where present" semantics. Interface/class
; names use `type_identifier`. `method_definition` (class) and
; `method_signature` (interface) are both captured as @symbol.method.
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
