import { defineConfig } from "vite";

export default defineConfig({
  assetsInclude: ["**/*.wgsl"],
  build: {
    target: "es2022",
  },
});
