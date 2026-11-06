// Merges the fisha1 dataset into the app after the covt import.
// - Images: only for species/sites that have no images yet (covt images are preferred).
// - Storytelling: every question/answer row, attached to its species (skipped if already present).
// Usage: npm run import:fisha -- --dir ./fisha1 [--dry-run]
import fs from "node:fs/promises";
import path from "node:path";
import XLSX from "xlsx";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { hashImage, findNearDuplicate } from "../src/lib/phash";
import { putImage } from "../src/lib/storage";
import { audit } from "../src/lib/audit";
import { IMAGE_QUESTIONS } from "../src/lib/questions";

const db = new PrismaClient();
type Row = Record<string, unknown>;
const args = process.argv.slice(2);
function arg(name: string) { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; }
const dryRun = args.includes("--dry-run");
const text = (v: unknown) => String(v ?? "").trim();
// Folder and file names in the workbook don't always match the disk (case, dots, underscores), so match on letters and digits only.
const norm = (s: string) => s.toLowerCase().replace(/\.[a-z]+$/, "").replace(/[^a-z0-9]/g, "");
function sheet(file: string) { const book = XLSX.readFile(file); return XLSX.utils.sheet_to_json<Row>(book.Sheets[book.SheetNames[0]], { defval: "" }); }

async function indexImages(root: string) {
  const byName = new Map<string, string>();
  for (const folder of await fs.readdir(root, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    for (const file of await fs.readdir(path.join(root, folder.name))) if (/\.(jpe?g|png|webp)$/i.test(file)) byName.set(norm(file), path.join(root, folder.name, file));
  }
  return byName;
}

async function main() {
  const dir = path.resolve(arg("--dir") || "./fisha1");
  const recognition = sheet(path.join(dir, "entity_recognition_dataset.xlsx"));
  const stories = sheet(path.join(dir, "entity_storytelling_dataset.xlsx"));
  const manifestFile = path.join(dir, "scraped_data", "scraped_images_manifest.xlsx");
  const manifest = new Map<string, Row>();
  try { for (const m of sheet(manifestFile)) manifest.set(norm(text(m["Saved File Name"])), m); } catch { /* the manifest is optional */ }
  const images = await indexImages(path.join(dir, "scraped_data"));

  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase();
  const admin = dryRun ? null : adminEmail ? await db.user.findUnique({ where: { email: adminEmail } }) : null;
  if (!dryRun && !admin) throw new Error("Run npm run db:seed first; the bootstrap admin must exist.");

  const report = { newSpecies: [] as string[], imagesImported: [] as string[], imagesSkippedCovtHasSpecies: 0, duplicates: [] as unknown[], failures: [] as unknown[], storiesAdded: 0, storiesAlreadyPresent: 0 };
  const speciesIds = new Map<string, string>();
  async function species(row: Row) {
    const canonicalName = text(row.canonical_name), shortName = text(row.short_name), category = text(row.category) || "fish_species";
    const known = speciesIds.get(canonicalName); if (known) return known;
    const existing = await db.species.findUnique({ where: { canonicalName } });
    if (existing) { speciesIds.set(canonicalName, existing.id); return existing.id; }
    report.newSpecies.push(canonicalName);
    if (dryRun) { speciesIds.set(canonicalName, `dry-${canonicalName}`); return speciesIds.get(canonicalName)!; }
    const created = await db.species.create({ data: { canonicalName, shortName, category } });
    await audit(admin!.id, "SPECIES", created.id, "IMPORT", undefined, undefined, { source: "fisha1", canonicalName });
    speciesIds.set(canonicalName, created.id); return created.id;
  }

  // Images: only species/sites that have none yet.
  const hasImages = new Set((await db.imageRecord.findMany({ where: { deletedAt: null }, distinct: ["canonicalName"], select: { canonicalName: true } })).map(r => r.canonicalName));
  for (let i = 0; i < recognition.length; i++) {
    const row = recognition[i], canonicalName = text(row.canonical_name), shortName = text(row.short_name), file = text(row.image_file);
    if (hasImages.has(canonicalName)) { report.imagesSkippedCovtHasSpecies++; continue; }
    try {
      if (!file || !canonicalName || !shortName) throw new Error("Missing image_file, canonical_name or short_name.");
      const found = images.get(norm(file)) || images.get(norm(path.basename(text(row.local_path).replace(/\\/g, "/"))));
      if (!found) throw new Error("Image file not found in scraped_data.");
      const question = text(row.question) || "What fish is this?";
      if (!IMAGE_QUESTIONS.includes(question)) throw new Error(`Invalid question: ${question}`);
      const original = await fs.readFile(found);
      const meta = await sharp(original).metadata();
      if (!meta.width || !meta.height || meta.width * meta.height < 90000 || Math.max(meta.width, meta.height) / Math.min(meta.width, meta.height) > 4) throw new Error("Image is too small, corrupt or has an extreme aspect ratio.");
      const duplicate = await findNearDuplicate(original);
      if (duplicate) { report.duplicates.push({ row: i + 2, file, existing: duplicate }); continue; }
      const speciesId = await species(row);
      const sourceUrl = text(manifest.get(norm(file))?.["Original Source URL"]);
      if (dryRun) { report.imagesImported.push(file); continue; }
      const normalized = await sharp(original).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
      const id = crypto.randomUUID(), objectKey = `${canonicalName.replace(/[^a-zA-Z0-9_-]+/g, "_")}/${id}.jpg`;
      await putImage(objectKey, normalized);
      const created = await db.imageRecord.create({ data: { id, category: text(row.category) || "fish_species", canonicalName, shortName, originalFileName: path.basename(found), objectKey, question, source: text(row["source(s)"]), speciesId, uploaderId: admin!.id, phash: await hashImage(normalized), custom: { dataset: "fisha1", ...(sourceUrl ? { source_url: sourceUrl } : {}) } } });
      await audit(admin!.id, "IMAGE", created.id, "IMPORT", undefined, undefined, { sourceFile: file, canonicalName, dataset: "fisha1" });
      report.imagesImported.push(file);
    } catch (error) { report.failures.push({ row: i + 2, file, canonicalName, message: error instanceof Error ? error.message : String(error) }); }
  }

  // Storytelling: every row, deduplicated on species + question + answer.
  // A dry run may happen before the Story migration is applied, so a missing table counts as empty there.
  const existingStories = await db.story.findMany({ where: { deletedAt: null }, select: { speciesId: true, question: true, answer: true } }).catch(error => { if (dryRun) return []; throw error; });
  const seen = new Set(existingStories.map(s => `${s.speciesId}\n${s.question}\n${s.answer}`));
  const toCreate: { speciesId: string; question: string; answer: string; source: string }[] = [];
  for (const row of stories) {
    const question = text(row.question), answer = text(row.answer);
    if (!text(row.canonical_name) || !question || !answer) continue;
    const speciesId = await species(row), key = `${speciesId}\n${question}\n${answer}`;
    if (seen.has(key)) { report.storiesAlreadyPresent++; continue; }
    seen.add(key); toCreate.push({ speciesId, question, answer, source: text(row["source(s)"]) });
  }
  if (!dryRun) for (let i = 0; i < toCreate.length; i += 500) await db.story.createMany({ data: toCreate.slice(i, i + 500) });
  report.storiesAdded = toCreate.length;

  const out = path.resolve("import-fisha-report.json");
  await fs.writeFile(out, JSON.stringify(report, null, 2));
  console.log(`${dryRun ? "[dry run] " : ""}New species/sites ${report.newSpecies.length}; images imported ${report.imagesImported.length}; skipped (covt already has the species) ${report.imagesSkippedCovtHasSpecies}; duplicates ${report.duplicates.length}; failures ${report.failures.length}; stories added ${report.storiesAdded} (already present ${report.storiesAlreadyPresent}). Report: ${out}`);
  if (report.duplicates.length || report.failures.length) process.exitCode = 2;
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
