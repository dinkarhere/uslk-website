import { collection, config, fields, singleton } from "@keystatic/core";

/**
 * Content model for the USLK Jal Foundation site.
 *
 * Storage: files in this repo. In development Keystatic writes to the local
 * filesystem; in production editors sign in with GitHub and every save is a
 * commit to `main`, which triggers a Cloudflare rebuild.
 */
// Set PUBLIC_KEYSTATIC_STORAGE=github locally once to create the GitHub App (see README).
const useGitHub = import.meta.env.PROD || import.meta.env.PUBLIC_KEYSTATIC_STORAGE === "github";

export const PROJECT_TAGS = [
  { label: "Education", value: "education" },
  { label: "Environment", value: "environment" },
  { label: "Water Conservation", value: "water-conservation" },
  { label: "Plantation", value: "plantation" },
] as const;

/** Image stored next to the other images of its collection, optimised by Astro at build time. */
const image = (label: string, folder: string, opts: { required?: boolean } = {}) =>
  fields.image({
    label,
    directory: `src/assets/images/${folder}`,
    publicPath: `../../assets/images/${folder}/`,
    validation: { isRequired: opts.required ?? true },
  });

const markdoc = (label = "Content") =>
  fields.markdoc({
    label,
    options: {
      image: { directory: "src/assets/images/inline", publicPath: "../../assets/images/inline/" },
    },
  });

export default config({
  storage: useGitHub ? { kind: "github", repo: "dinkarhere/uslk-website" } : { kind: "local" },
  ui: {
    brand: { name: "USLK Jal Foundation" },
    navigation: {
      Content: ["projects", "blog"],
      Pages: ["home", "legal"],
      Settings: ["site"],
    },
  },
  collections: {
    projects: collection({
      label: "Projects",
      slugField: "title",
      path: "src/content/projects/*",
      format: { contentField: "content" },
      entryLayout: "content",
      columns: ["title", "date"],
      schema: {
        title: fields.slug({ name: { label: "Title", validation: { length: { min: 3, max: 160 } } } }),
        date: fields.date({ label: "Date", validation: { isRequired: true } }),
        tag: fields.select({ label: "Category", options: PROJECT_TAGS, defaultValue: "education" }),
        thumbnail: image("Thumbnail", "projects"),
        thumbnailAlt: fields.text({ label: "Thumbnail description (for screen readers)" }),
        gallery: fields.array(
          fields.object({
            image: image("Image", "projects"),
            alt: fields.text({ label: "Description" }),
          }),
          { label: "Gallery", itemLabel: (p) => p.fields.alt.value || "Photo" },
        ),
        draft: fields.checkbox({ label: "Draft (hidden from the site)", defaultValue: false }),
        content: markdoc(),
      },
    }),
    blog: collection({
      label: "Blog posts",
      slugField: "title",
      path: "src/content/blog/*",
      format: { contentField: "content" },
      entryLayout: "content",
      columns: ["title", "date"],
      schema: {
        title: fields.slug({ name: { label: "Title", validation: { length: { min: 3, max: 160 } } } }),
        date: fields.date({ label: "Date", validation: { isRequired: true } }),
        author: fields.text({ label: "Author" }),
        excerpt: fields.text({
          label: "Excerpt",
          description: "Short summary shown on cards and in search results.",
          multiline: true,
          validation: { length: { max: 300 } },
        }),
        image: image("Cover image", "blog"),
        imageAlt: fields.text({ label: "Cover image description (for screen readers)" }),
        draft: fields.checkbox({ label: "Draft (hidden from the site)", defaultValue: false }),
        content: markdoc(),
      },
    }),
    legal: collection({
      label: "Legal pages",
      slugField: "title",
      path: "src/content/legal/*",
      format: { contentField: "content" },
      entryLayout: "content",
      schema: {
        title: fields.slug({ name: { label: "Title" } }),
        draft: fields.checkbox({ label: "Draft (hidden from the site)", defaultValue: true }),
        content: markdoc(),
      },
    }),
  },
  singletons: {
    site: singleton({
      label: "Site settings",
      path: "src/content/settings/site",
      format: "yaml",
      schema: {
        name: fields.text({ label: "Organisation name", validation: { isRequired: true } }),
        seoTitle: fields.text({ label: "Default page title (SEO)", validation: { isRequired: true } }),
        seoDescription: fields.text({ label: "Default description (SEO)", multiline: true }),
        tagline: fields.text({ label: "Footer tagline" }),
        copyright: fields.text({ label: "Copyright line" }),
        email: fields.text({ label: "Email", validation: { isRequired: true } }),
        phones: fields.array(fields.text({ label: "Phone number" }), {
          label: "Phone numbers",
          description: "The first number is shown in the header.",
          itemLabel: (p) => p.value,
        }),
        officeName: fields.text({ label: "Office name" }),
        address: fields.text({ label: "Office address", multiline: true }),
        mapQuery: fields.text({
          label: "Map search text",
          description: "What Google Maps searches for on the contact page.",
        }),
        social: fields.object(
          {
            facebook: fields.url({ label: "Facebook" }),
            instagram: fields.url({ label: "Instagram" }),
            twitter: fields.url({ label: "X / Twitter" }),
            linkedin: fields.url({ label: "LinkedIn" }),
          },
          { label: "Social links (leave empty to hide)" },
        ),
        volunteer: fields.object(
          {
            title: fields.text({ label: "Title" }),
            text: fields.text({ label: "Text", multiline: true }),
            ctaLabel: fields.text({ label: "Button label" }),
          },
          { label: "“Become a volunteer” banner (every page)" },
        ),
        donationCauses: fields.array(fields.text({ label: "Cause" }), {
          label: "Donation form causes",
          itemLabel: (p) => p.value,
        }),
      },
    }),
    home: singleton({
      label: "Home page",
      path: "src/content/settings/home",
      format: "yaml",
      schema: {
        hero: fields.object(
          {
            title: fields.text({ label: "Title" }),
            subtitle: fields.text({ label: "Subtitle", multiline: true }),
            ctaLabel: fields.text({ label: "Button label" }),
          },
          { label: "Hero" },
        ),
        focus: fields.object(
          {
            title: fields.text({ label: "Title" }),
            text: fields.text({ label: "Text", multiline: true }),
            items: fields.array(
              fields.object({
                icon: fields.select({
                  label: "Icon",
                  options: [
                    { label: "Water", value: "water" },
                    { label: "Community", value: "community" },
                    { label: "Sustainability", value: "sustainability" },
                  ],
                  defaultValue: "water",
                }),
                title: fields.text({ label: "Title" }),
                text: fields.text({ label: "Text", multiline: true }),
              }),
              { label: "Focus areas", itemLabel: (p) => p.fields.title.value },
            ),
          },
          { label: "Our focus" },
        ),
        projects: fields.object(
          { title: fields.text({ label: "Title" }), text: fields.text({ label: "Text", multiline: true }) },
          { label: "Recent projects" },
        ),
        news: fields.object(
          { title: fields.text({ label: "Title" }), text: fields.text({ label: "Text", multiline: true }) },
          { label: "News" },
        ),
        donate: fields.object(
          {
            title: fields.text({ label: "Title" }),
            text: fields.text({ label: "Text", multiline: true }),
            ctaLabel: fields.text({ label: "Button label" }),
          },
          { label: "Donation banner" },
        ),
        stats: fields.object(
          {
            title: fields.text({ label: "Title" }),
            items: fields.array(
              fields.object({
                value: fields.integer({ label: "Number", validation: { isRequired: true, min: 0 } }),
                suffix: fields.text({ label: "Suffix (e.g. +, k+, %)" }),
                label: fields.text({ label: "Label" }),
              }),
              { label: "Numbers", itemLabel: (p) => `${p.fields.value.value ?? ""}${p.fields.suffix.value} ${p.fields.label.value}` },
            ),
          },
          { label: "Numbers" },
        ),
      },
    }),
  },
});
