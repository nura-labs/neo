import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/wizard.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  shims: true,
  splitting: false,
  bundle: true,
  outDir: "dist",
  banner: { js: "#!/usr/bin/env node" },
});
