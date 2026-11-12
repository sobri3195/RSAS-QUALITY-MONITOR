import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: { include: ["src/tests/**/*.test.ts", "supabase/tests/**/*.test.ts"] },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          backend: ["@supabase/supabase-js"],
          exports: ["html-to-image"],
          vendor: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
