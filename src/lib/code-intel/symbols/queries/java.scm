; Java symbol capture patterns (T023, contracts/language-grammar-provider.md
; "Symbol query patterns"). Node types verified directly against the pinned
; tree-sitter-wasms@0.1.13 tree-sitter-java grammar (Language.types).
;
; Only the symbol kinds T023 requires: class, interface, method, plus a
; @symbol.name sub-capture for each declaration's identifier. Java has no
; free-standing function construct (a method is always a member of a class
; or interface, per the grammar's node types), so no @symbol.function
; capture is emitted here. No parent/child nesting or symbol_key logic is
; encoded — that is derived from the AST ancestor chain and computed
; separately (to-intermediate-representation.ts / symbol-identity.ts), not
; by this query.

(class_declaration
  name: (identifier) @symbol.name) @symbol.class

(interface_declaration
  name: (identifier) @symbol.name) @symbol.interface

(method_declaration
  name: (identifier) @symbol.name) @symbol.method
