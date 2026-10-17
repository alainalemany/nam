import { PrismaClient } from "@prisma/client";

import { resetPackage2BBrowserRateHistoryFixture } from "./package-2b-browser-fixture";
import { guardedPackage2BBrowserTestConfiguration } from "./package-2b-browser-guard";

export default async function package2BBrowserGlobalSetup() {
  const configuration = guardedPackage2BBrowserTestConfiguration();
  const prisma = new PrismaClient({ datasourceUrl: configuration.databaseUrl });
  try {
    await resetPackage2BBrowserRateHistoryFixture(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
