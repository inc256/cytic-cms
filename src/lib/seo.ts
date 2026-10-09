export const meta = (title: string, description: string) => ({
  meta: [
    { title: `${title} — CYTIC Creatives CMS` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} — CYTIC Creatives CMS` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});
