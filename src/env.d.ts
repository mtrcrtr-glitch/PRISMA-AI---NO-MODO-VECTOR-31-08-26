declare namespace Cloudflare {
  interface Env {
    DATABASE_URL?: string
  }
}

declare module "cloudflare:workers" {
  interface Env {
    DATABASE_URL?: string
  }
}
