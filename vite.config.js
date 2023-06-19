import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  esbuild: {
    minify: true,
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    lib: {
      name: "gb.js",
      entry: resolve(__dirname, "src/gb.ts"),
      formats: ["es", "umd", "iife"],
    },
  },
});
