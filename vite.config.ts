import { cloudflare } from "@cloudflare/vite-plugin"
import { devtools } from "@happyseeds/devtools/vite"
import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    allowedHosts: [".sandbox.novita.ai"],
    cors: {
      origin: /^https:\/\/[^.]+\.sandbox\.novita\.ai(?::\d+)?$/,
    },
  },
  /**
   * Vite 6.0.9+ requires a token on the HMR WebSocket upgrade whenever the
   * request carries an `Origin` header, and that token is minted fresh on every
   * dev-server start. A preview page that outlives a restart — or that was
   * handed a cached `/@vite/client` — therefore holds a token the server will
   * never accept, and every reconnect is rejected for the life of the document.
   * The page keeps rendering; only HMR is gone, which makes it easy to miss.
   *
   * Skipping the check trades that failure away deliberately. What it costs:
   * the token is what stops an arbitrary website from opening a socket to this
   * dev server, and `allowedHosts` does not cover that case — a browser fills
   * the Host header from the URL, so a request from any origin still matches.
   * Dev only, and the reason it is acceptable here is that the preview server
   * holds nothing that is not already in the repository.
   */
  legacy: { skipWebSocketTokenCheck: true },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    devtools(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
})

export default config