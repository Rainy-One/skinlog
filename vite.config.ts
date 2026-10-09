import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "SkinLog · 皮肤观察日志",
        short_name: "SkinLog",
        description: "个人洗护习惯与皮肤状态观察",
        lang: "zh-CN",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#f4f7fa",
        theme_color: "#315c79",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallback: "index.html",
        maximumFileSizeToCacheInBytes: 4000000,
      },
    }),
  ],
});
