import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/*
 * These schemas mirror keystatic.config.ts. Keystatic edits the files; Astro
 * validates them at build time, so a malformed edit fails the build instead of
 * shipping a broken page.
 */

const tag = z.enum(["education", "environment", "water-conservation", "plantation"]);

const projects = defineCollection({
  loader: glob({ pattern: "*.mdoc", base: "src/content/projects" }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1),
      date: z.coerce.date(),
      tag: tag.default("education"),
      thumbnail: image(),
      thumbnailAlt: z.string().default(""),
      gallery: z.array(z.object({ image: image(), alt: z.string().default("") })).default([]),
      draft: z.boolean().default(false),
    }),
});

const blog = defineCollection({
  loader: glob({ pattern: "*.mdoc", base: "src/content/blog" }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1),
      date: z.coerce.date(),
      author: z.string().default(""),
      excerpt: z.string().default(""),
      image: image(),
      imageAlt: z.string().default(""),
      draft: z.boolean().default(false),
    }),
});

const legal = defineCollection({
  loader: glob({ pattern: "*.mdoc", base: "src/content/legal" }),
  schema: z.object({ title: z.string().min(1), draft: z.boolean().default(true) }),
});

const text = z.string().default("");

const site = defineCollection({
  loader: glob({ pattern: "site.yaml", base: "src/content/settings" }),
  schema: z.object({
    name: z.string(),
    seoTitle: z.string(),
    seoDescription: text,
    tagline: text,
    copyright: text,
    email: z.email(),
    phones: z.array(z.string()).default([]),
    officeName: text,
    address: text,
    mapQuery: text,
    social: z
      .object({ facebook: text, instagram: text, twitter: text, linkedin: text })
      .default({ facebook: "", instagram: "", twitter: "", linkedin: "" }),
    volunteer: z.object({ title: text, text, ctaLabel: text }),
    donationCauses: z.array(z.string()).default([]),
  }),
});

const home = defineCollection({
  loader: glob({ pattern: "home.yaml", base: "src/content/settings" }),
  schema: z.object({
    hero: z.object({ title: text, subtitle: text, ctaLabel: text }),
    focus: z.object({
      title: text,
      text,
      items: z.array(
        z.object({ icon: z.enum(["water", "community", "sustainability"]), title: text, text }),
      ),
    }),
    projects: z.object({ title: text, text }),
    news: z.object({ title: text, text }),
    donate: z.object({ title: text, text, ctaLabel: text }),
    stats: z.object({
      title: text,
      items: z.array(z.object({ value: z.number().int().nonnegative(), suffix: text, label: text })),
    }),
  }),
});

export const collections = { projects, blog, legal, site, home };
