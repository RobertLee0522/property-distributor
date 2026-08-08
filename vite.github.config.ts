import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  process.env.VITE_SITE_URL = env.VITE_SITE_URL || "http://localhost:3000/";

  return {
    base: "./",
    plugins: [react()],
    build: {
      outDir: "github-pages",
      emptyOutDir: true,
    },
  };
});
