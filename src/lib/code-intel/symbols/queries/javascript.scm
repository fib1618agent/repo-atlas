; JavaScript symbol capture patterns (T024, contracts/language-grammar-provider.md
; "Symbol query patterns"). Node types verified directly against the pinned
; tree-sitter-wasms@0.1.13 tree-sitter-javascript grammar (Language.types).
;
; Only the symbol kinds T024 requires: function, class, method, plus a
; @symbol.name sub-capture for each declaration's identifier. JavaScript has
; no interface construct (confirmed via Language.types — no "interface" node
; type in this grammar), so no @symbol.interface capture is emitted here.
; No parent/child nesting or symbol_key logic is encoded — that is derived
; separately (to-intermediate-representation.ts / symbol-identity.ts).
;
; Note: JS method names use the `property_identifier` node type, not
; `identifier` (unlike Java's `method_declaration`) — this grammar has no
; separate constructor node type the way Java's does, so a `constructor(...)`
; member is itself a `method_definition` and is captured as @symbol.method,
; matching this grammar's actual structure rather than inventing an exclusion
; the grammar doesn't express.

(function_declaration
  name: (identifier) @symbol.name) @symbol.function

(class_declaration
  name: (identifier) @symbol.name) @symbol.class

(method_definition
  name: (property_identifier) @symbol.name) @symbol.method
