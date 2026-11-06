import { PrismaClient, Role } from "@prisma/client";
import argon2 from "argon2";

const db = new PrismaClient();
async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password || password === "change-this-before-first-run") throw new Error("Set BOOTSTRAP_ADMIN_EMAIL and a strong BOOTSTRAP_ADMIN_PASSWORD before seeding.");
  await db.user.upsert({ where: { email }, update: {}, create: { email, passwordHash: await argon2.hash(password), role: Role.ADMIN } });
  const columns = [
    ["IMAGE", "image_caption", "Image caption", "TEXT"], ["IMAGE", "confidence", "Confidence", "NUMBER"],
    ["SPECIES", "conservation_status", "Conservation status", "CHOICE"]
  ] as const;
  for (const [entity, key, label, type] of columns) await db.columnDefinition.upsert({ where: { entity_key: { entity, key } }, update: {}, create: { entity, key, label, type } });
}
main().finally(() => db.$disconnect());
