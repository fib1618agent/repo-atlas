declare module "*.wasm?module" {
  const mod: WebAssembly.Module;
  export default mod;
}
