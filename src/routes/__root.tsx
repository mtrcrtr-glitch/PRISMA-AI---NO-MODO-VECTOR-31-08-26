import { HappySeedsInspector } from "@happyseeds/devtools/react"
import "@happyseeds/devtools/runtime"
import type { QueryClient } from "@tanstack/react-query"
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouter,
} from "@tanstack/react-router"
import type { ErrorComponentProps } from "@tanstack/react-router"

import { HappySeedsWatermark } from "#/components/HappySeedsWatermark.tsx"
import { Button } from "#/components/ui/button.tsx"
import { env } from "#/env.ts"

import appCss from "../styles.css?url"

interface MyRouterContext {
  queryClient: QueryClient
}

/**
 * Umami analytics. Loads only in a production build and only once both values
 * are configured, so a dev session or an unconfigured app ships no tracker.
 *
 * `import.meta.env.PROD` is statically false in every other build, including
 * `build:dev`, so the tag never renders there. The configured values still sit
 * in the bundle either way — a VITE_ variable is public by definition, so
 * neither of these may hold anything secret.
 */
const UMAMI_SCRIPT_URL = env.VITE_UMAMI_SCRIPT_URL ?? ""
const UMAMI_WEBSITE_ID = (env.VITE_UMAMI_WEBSITE_ID ?? "").trim()
const UMAMI_ENABLED =
  import.meta.env.PROD && UMAMI_SCRIPT_URL !== "" && UMAMI_WEBSITE_ID !== ""

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "OTC Trading Terminal" },
      {
        name: "description",
        content:
          "Real-time OTC options analysis, broker integration, and automated signal scanner terminal.",
      },
      { property: "og:title", content: "OTC Trading Terminal" },
      {
        property: "og:description",
        content:
          "Real-time OTC options analysis, broker integration, and automated signal scanner terminal.",
      },
      {
        name: "keywords",
        content:
          "HappySeeds, VibeCoding, AI Agents, Software Engineering, SaaS Builder, UI-First Development",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "HappySeeds" },
      { property: "og:locale", content: "en_US" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootDocument,
  errorComponent: RootError,
})

function RootError({ reset }: ErrorComponentProps) {
  const router = useRouter()

  return (
    <main
      key="root-error"
      className="fixed inset-0 flex items-center justify-center overflow-hidden bg-background px-4"
    >
      <section className="flex w-full max-w-md flex-col items-center text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page failed to load
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          An error stopped it from rendering.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              void router.invalidate()
              reset()
            }}
          >
            Try again
          </Button>
          <Button variant="outline" asChild>
            <a href="/">Go home</a>
          </Button>
        </div>
      </section>
    </main>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  // Browser extensions decorate <html>/<body> before React hydrates. The
  // suppression is element-local — mismatches inside the app still warn.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <HappySeedsInspector />
        <HappySeedsWatermark />
        {UMAMI_ENABLED && (
          <script
            async
            src={UMAMI_SCRIPT_URL}
            data-website-id={UMAMI_WEBSITE_ID}
          />
        )}
        <Scripts />
      </body>
    </html>
  )
}