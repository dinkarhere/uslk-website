// @ts-check
import { defineConfig, envField } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import markdoc from "@astrojs/markdoc";
import sitemap from "@astrojs/sitemap";
import keystatic from "@keystatic/astro";
import node from "@astrojs/node";

// Pages are prerendered to static HTML. Only /keystatic (CMS admin) and
// /api/* (form handler) run on demand as a Cloudflare Worker.
//
// `astro dev` uses the Node adapter: Keystatic's local mode edits files on
// disk, which the workerd-based Cloudflare dev runtime cannot do. Builds and
// `astro preview` use Cloudflare, matching production.
const useNode = process.argv.includes("dev");

export default defineConfig({
  site: "https://uslkfoundation.com",
  output: "static",
  trailingSlash: "never",
  build: { format: "file" },
  // Lets a parent style a child component via `class` (e.g. <BackgroundBanner class="volunteer">).
  scopedStyleStrategy: "class",
  adapter: useNode ? node({ mode: "standalone" }) : cloudflare({ imageService: "compile" }),
  integrations: [
    react(),
    markdoc(),
    keystatic(),
    sitemap({ filter: (page) => !page.includes("/keystatic") }),
  ],
  env: {
    schema: {
      RESEND_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      CONTACT_TO_EMAIL: envField.string({ context: "server", access: "secret", optional: true }),
      CONTACT_FROM_EMAIL: envField.string({
        context: "server",
        access: "secret",
        default: "USLK Website <onboarding@resend.dev>",
      }),
    },
  },
});
