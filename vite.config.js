import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Track It",
        short_name: "Track It",
        description: "A running tally of where it went",
        theme_color: "#1c2b22",
        background_color: "#1c2b22",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Never precache anything under /.well-known/ — files there (like
        // the Android app's assetlinks.json) need to always be fetched
        // fresh from the network, never served from an old cached copy
        // frozen at whatever it looked like when the app was first built.
        globIgnores: ["**/.well-known/**"],
        // Never cache Supabase API calls — this app's data must always be
        // fresh, not served from an offline cache pretending to be current.
        // Also never intercept /.well-known/ — files there need to be
        // served as real files, not swapped for the app's own login screen.
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/\.well-known\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith(".supabase.co"),
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
});