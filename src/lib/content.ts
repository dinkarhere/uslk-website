import { getCollection, getEntry, type CollectionEntry } from "astro:content";

export type Project = CollectionEntry<"projects">;
export type Post = CollectionEntry<"blog">;

const byDateDesc = (a: { data: { date: Date } }, b: { data: { date: Date } }) =>
  b.data.date.getTime() - a.data.date.getTime();

/** Published projects, newest first. Drafts are only visible in `astro dev`. */
export async function getProjects(): Promise<Project[]> {
  const all = await getCollection("projects", ({ data }) => import.meta.env.DEV || !data.draft);
  return all.sort(byDateDesc);
}

/** Published blog posts, newest first. Drafts are only visible in `astro dev`. */
export async function getPosts(): Promise<Post[]> {
  const all = await getCollection("blog", ({ data }) => import.meta.env.DEV || !data.draft);
  return all.sort(byDateDesc);
}

export async function getSite() {
  const entry = await getEntry("site", "site");
  if (!entry) throw new Error("Missing src/content/settings/site.yaml");
  return entry.data;
}

export async function getHome() {
  const entry = await getEntry("home", "home");
  if (!entry) throw new Error("Missing src/content/settings/home.yaml");
  return entry.data;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "Aug 29, 2025" — matches the Framer site's date style. */
export const formatDate = (date: Date) => dateFormatter.format(date);

export const TAG_LABELS: Record<Project["data"]["tag"], string> = {
  education: "Education",
  environment: "Environment",
  "water-conservation": "Water Conservation",
  plantation: "Plantation",
};

export const projectUrl = (p: Project) => `/projects/${p.id}`;
export const postUrl = (p: Post) => `/blog/${p.id}`;

/** "tel:" href from a display number such as "+91 9522067412". */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
