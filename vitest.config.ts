import { defineConfig } from "vitest/config";

// Plain Node config: the tested modules are runtime-agnostic, and Astro's
// Vite config would boot the Cloudflare workerd runner.
export default defineConfig({ test: { include: ["tests/**/*.test.ts"], environment: "node" } });
