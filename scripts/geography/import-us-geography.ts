import { PrismaClient } from "@prisma/client";

import { geographySeedFingerprint, importUsGeography, loadGeographySeed } from "../../src/features/geography/import.ts";

const client = new PrismaClient();

try {
  const seed = loadGeographySeed();
  const result = await importUsGeography(client, seed);
  process.stdout.write(`${JSON.stringify({ ...result, fingerprint: geographySeedFingerprint(seed) }, null, 2)}\n`);
} finally {
  await client.$disconnect();
}
