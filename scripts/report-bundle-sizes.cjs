const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const chunks = path.join(root, ".next", "static", "chunks");
if (!fs.existsSync(chunks)) {
  console.error("Build the app first so .next/static/chunks exists.");
  process.exit(1);
}

function collect(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? collect(file) : entry.name.endsWith(".js") ? [file] : [];
  });
}

const files = collect(chunks);
const total = files.reduce((sum, file) => sum + zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length, 0);
const routeGroups = {
  fleetMap: files.filter((file) => /[\\/]app[\\/]map[\\/]page-/.test(file)),
  apiHealth: files.filter((file) => /[\\/]app[\\/]admin[\\/]api-health[\\/]page-/.test(file)),
};
const report = {
  generatedAt: new Date().toISOString(),
  staticJavaScriptFiles: files.length,
  totalStaticChunksGzipBytes: total,
  routeEntryChunkCandidates: Object.fromEntries(Object.entries(routeGroups).map(([name, group]) => [
    name,
    { gzipBytes: group.reduce((sum, file) => sum + zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length, 0), files: group.map((file) => path.relative(root, file)) },
  ])),
};
console.log(JSON.stringify(report, null, 2));
