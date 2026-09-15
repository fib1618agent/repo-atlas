import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
// Uncomment to enable the TanStack Router inspector in dev:
// import { devtools } from "@tanstack/devtools-vite";

export default defineConfig(({ command }) => ({
  server: {
    port: 4949,
    host: "127.0.0.1",
  },
  plugins: [
    // tanstackStart must come before react()
    tanstackStart({
      server: { entry: "server" },
    }),
    // Nitro is not bundled by tanstackStart; keep it build-only for Cloudflare output.
    ...(command === "build"
      ? [nitro({ defaultPreset: "cloudflare-module" })]
      : []),
    react(),
    tailwindcss(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    // devtools(),
  ],
}));
