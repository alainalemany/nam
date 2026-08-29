import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

const [, , statesPath, placesPath, outputDirectory = "data/geography"] = process.argv;

if (!statesPath || !placesPath) {
  throw new Error(
    "Usage: node scripts/geography/normalize-census-gazetteer.mjs <states.txt> <places.txt> [output-directory]",
  );
}

const stateSourceUrl =
  "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_state_national.zip";
const placeSourceUrl =
  "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_place_national.zip";

const placeSuffixByLsad = new Map([
  ["21", " borough"],
  ["25", " city"],
  ["37", " municipality"],
  ["43", " town"],
  ["47", " village"],
  ["53", " city and borough"],
  ["57", " CDP"],
  ["CG", " consolidated government"],
  ["CN", " corporation"],
  ["MG", " metropolitan government"],
  ["UC", " urban county"],
  ["UG", " unified government"],
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedKey(value) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function rows(source) {
  const [header, ...records] = source.trim().split(/\r?\n/);
  return { header: header.split("|"), records: records.map((line) => line.split("|")) };
}

function placeName(name, lsad) {
  const suffix = placeSuffixByLsad.get(lsad);
  if (!suffix) return name.trim();
  if (!name.endsWith(suffix)) {
    throw new Error(`Census Place ${name} does not end with the expected LSAD suffix ${suffix}.`);
  }
  return name.slice(0, -suffix.length).trim();
}

const statesSource = readFileSync(resolve(statesPath), "utf8");
const placesSource = readFileSync(resolve(placesPath), "utf8");
const stateRows = rows(statesSource);
const placeRows = rows(placesSource);

const stateColumn = Object.fromEntries(stateRows.header.map((name, index) => [name, index]));
const placeColumn = Object.fromEntries(placeRows.header.map((name, index) => [name, index]));

const states = stateRows.records
  .filter((row) => row[stateColumn.USPS] !== "PR")
  .map((row) => ({
    abbreviation: row[stateColumn.USPS],
    censusGeoid: row[stateColumn.GEOID],
    name: row[stateColumn.NAME].trim(),
  }))
  .sort((left, right) => left.abbreviation.localeCompare(right.abbreviation));

if (states.length !== 51 || !states.some((state) => state.abbreviation === "DC")) {
  throw new Error(`Expected 50 states plus DC; received ${states.length} rows.`);
}

const stateAbbreviations = new Set(states.map((state) => state.abbreviation));
const placesByKey = new Map();
let excludedDuplicatePlaces = 0;

for (const row of placeRows.records) {
  const abbreviation = row[placeColumn.USPS];
  if (abbreviation === "PR") continue;
  if (!stateAbbreviations.has(abbreviation)) {
    throw new Error(`Place row uses an unexpected state abbreviation: ${abbreviation}.`);
  }
  const name = placeName(row[placeColumn.NAME], row[placeColumn.LSAD]);
  const place = { abbreviation, censusGeoid: row[placeColumn.GEOID], name };
  const key = `${abbreviation}|${normalizedKey(name)}`;
  const retained = placesByKey.get(key);
  if (!retained || place.censusGeoid.localeCompare(retained.censusGeoid) < 0) {
    if (retained) excludedDuplicatePlaces += 1;
    placesByKey.set(key, place);
  } else {
    excludedDuplicatePlaces += 1;
  }
}

const places = [...placesByKey.values()].sort(
  (left, right) =>
    left.abbreviation.localeCompare(right.abbreviation) ||
    left.name.localeCompare(right.name, "en-US") ||
    left.censusGeoid.localeCompare(right.censusGeoid),
);

if (!places.some((place) => place.abbreviation === "FL" && place.name === "Medley")) {
  throw new Error("The normalized Census Place dataset does not contain Medley, FL.");
}

const statesTsv = [
  "state_abbreviation\tcensus_geoid\tname",
  ...states.map((state) => `${state.abbreviation}\t${state.censusGeoid}\t${state.name}`),
].join("\n") + "\n";
const placesTsv = [
  "state_abbreviation\tcensus_geoid\tname",
  ...places.map((place) => `${place.abbreviation}\t${place.censusGeoid}\t${place.name}`),
].join("\n") + "\n";
const placesGzip = gzipSync(Buffer.from(placesTsv, "utf8"), { level: 9 });

const output = resolve(outputDirectory);
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, "us-states-2025.tsv"), statesTsv, "utf8");
writeFileSync(resolve(output, "us-cities-2025.tsv.gz"), placesGzip);
writeFileSync(
  resolve(output, "us-census-gazetteer-2025.manifest.json"),
  `${JSON.stringify({
    dataset: "U.S. Census Bureau 2025 Gazetteer — States and Places",
    stateSourceUrl,
    placeSourceUrl,
    stateSourceTextSha256: sha256(statesSource),
    placeSourceTextSha256: sha256(placesSource),
    statesArtifactSha256: sha256(statesTsv),
    citiesArtifactSha256: sha256(placesGzip),
    stateCount: states.length,
    cityCount: places.length,
    excludedTerritories: ["PR"],
    excludedDuplicatePlaces,
  }, null, 2)}\n`,
  "utf8",
);

process.stdout.write(
  `Prepared ${states.length} states/DC and ${places.length} unique Census Places; removed ${excludedDuplicatePlaces} duplicate City+State rows.\n`,
);
