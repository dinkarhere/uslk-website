/**
 * Minimal types for the Cloudflare runtime module used by /api/forms.
 * (The full `wrangler types` output is global and clashes with DOM types used
 * by client-side scripts, so only the surface we use is declared here.)
 */
declare module "cloudflare:workers" {
  interface RateLimit {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  }
  export const env: {
    /** Configured in wrangler.jsonc → ratelimits. */
    FORM_LIMITER?: RateLimit;
  };
}
