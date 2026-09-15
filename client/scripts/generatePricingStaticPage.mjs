import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const distDirectory = join(process.cwd(), "dist");
const indexPath = join(distDirectory, "index.html");
const pricingPath = join(distDirectory, "pricing", "index.html");
const canonicalUrl = "https://hotel-biling-software.vercel.app/pricing";
const pricingMetadata = `<meta name="description" content="Compare RestoSphere restaurant management plans and start with a 15-day free trial." />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="${canonicalUrl}" />`;

const pricingFallback = `<div id="root"><main class="app-page-container mx-auto max-w-7xl pb-10"><section class="mx-auto max-w-3xl text-center"><p>Pricing</p><h1>Simple plans for every restaurant</h1><p>Compare RestoSphere restaurant management plans. Start with a 15-day free trial, then choose the plan that fits your restaurant.</p></section><section class="mx-auto mt-10 max-w-3xl"><h2>RestoSphere restaurant management plans</h2><p>Every plan helps restaurant teams manage orders, tables, kitchen operations, inventory, staff, billing, payments, and reports from one platform.</p><p><a href="/register">Start your free trial</a></p></section></main></div>`;

const indexHtml = await readFile(indexPath, "utf8");
const pricingHtml = indexHtml
  .replace(/<meta name="description" content="[^"]*"\s*\/>/, pricingMetadata)
  .replace("<title>RestoSphere | Restaurant Management</title>", "<title>RestoSphere Pricing | Restaurant Management Plans</title>")
  .replace('<div id="root"></div>', pricingFallback);

if (pricingHtml === indexHtml || !pricingHtml.includes(canonicalUrl)) {
  throw new Error("Unable to create the static pricing entry from the Vite output.");
}

await mkdir(dirname(pricingPath), { recursive: true });
await writeFile(pricingPath, pricingHtml, "utf8");
console.log("Static pricing page generated: dist/pricing/index.html");
