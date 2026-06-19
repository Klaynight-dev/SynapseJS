import { defineConfig } from "vite";

export default defineConfig({
  assetsInclude: ["**/*.wgsl"],
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist",
  },
});
