#!/usr/bin/env node
/**
 * One-off migration: Framer CMS export -> Keystatic content files.
 *
 * Input:  scripts/migration/framer-cms.json (exported from the Framer project)
 * Output: src/content/{projects,blog}/<slug>.mdoc
 *         src/assets/images/{projects,blog}/<slug>/*  (downloaded from framerusercontent.com)
 *
 * Safe to re-run: images that already exist are not downloaded again, and
 * content files are overwritten only with --force.
 *
 * Usage: node scripts/migrate-framer-cms.mjs [--force]
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const force = process.argv.includes("--force");
const exportFile = path.join(root, "scripts/migration/framer-cms.json");

const TAGS = {
  Education: "education",
  Enviroment: "environment", // sic: spelled this way in Framer
  Environment: "environment",
  "Water Conservation": "water-conservation",
  Plantation: "plantation",
};

const exists = (p) => access(p).then(() => true, () => false);

/** Minimal YAML scalar quoting: always double-quote strings so ':' '#' and quotes are safe. */
const yamlString = (value) => JSON.stringify(value ?? "");

const isoDate = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${value}`);
  return d.toISOString().slice(0, 10); // Framer displays dates in UTC
};

async function download(url, dest) {
  if (await exists(dest)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

/** Downloads an image and returns the path Keystatic/Astro expect in frontmatter. */
async function localImage(url, folder, slug, name) {
  const ext = path.extname(new URL(url).pathname).toLowerCase() || ".jpg";
  const file = `${name}${ext === ".jpeg" ? ".jpg" : ext}`;
  await download(url, path.join(root, "src/assets/images", folder, slug, file));
  return `../../assets/images/${folder}/${slug}/${file}`;
}

async function writeEntry(folder, slug, frontmatter, body) {
  const dest = path.join(root, "src/content", folder, `${slug}.mdoc`);
  if (!force && (await exists(dest))) {
    console.log(`skip  ${folder}/${slug} (exists, use --force)`);
    return;
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, `---\n${frontmatter.join("\n")}\n---\n\n${body.trim()}\n`);
  console.log(`wrote ${folder}/${slug}`);
}

const data = JSON.parse(await readFile(exportFile, "utf8"));

for (const p of data.Projects) {
  const slug = p.Slug;
  const tag = TAGS[p.Tags];
  if (!tag) throw new Error(`Unknown project tag "${p.Tags}" on ${slug}`);
  const thumbnail = await localImage(p.Thumbnail.url, "projects", slug, "thumbnail");

  // Framer galleries contain accidental duplicates; keep the first occurrence.
  const unique = [...new Map(p.Gallery.filter(Boolean).map((g) => [g.url, g])).values()];
  const gallery = [];
  for (const [i, g] of unique.entries()) {
    gallery.push({ image: await localImage(g.url, "projects", slug, `gallery-${i + 1}`), alt: g.alt ?? "" });
  }

  await writeEntry(
    "projects",
    slug,
    [
      `title: ${yamlString(p.Title)}`,
      `date: ${isoDate(p.Date)}`,
      `tag: ${tag}`,
      `thumbnail: ${thumbnail}`,
      `thumbnailAlt: ${yamlString(p.Thumbnail.alt || p.Title)}`,
      gallery.length ? "gallery:" : "gallery: []",
      ...gallery.flatMap((g) => [`  - image: ${g.image}`, `    alt: ${yamlString(g.alt)}`]),
      `draft: ${Boolean(p.draft)}`,
    ],
    p.Content,
  );
}

for (const b of data.Blogs) {
  const slug = b.Slug;
  const image = await localImage(b.Image.url, "blog", slug, "cover");
  await writeEntry(
    "blog",
    slug,
    [
      `title: ${yamlString(b.Title)}`,
      `date: ${isoDate(b.Date)}`,
      `author: ${yamlString(b.Author)}`,
      // Framer cards showed "Caption"; "Description" was mostly empty.
      `excerpt: ${yamlString(b.Caption || b.Description)}`,
      `image: ${image}`,
      `imageAlt: ${yamlString(b.Image.alt && b.Image.alt !== "blog image" ? b.Image.alt : b.Title)}`,
      `draft: ${Boolean(b.draft)}`,
    ],
    b.Content,
  );
}
