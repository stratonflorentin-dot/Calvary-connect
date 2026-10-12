const { spawnSync } = require("node:child_process");
const path = require("node:path");

process.env.ANALYZE = "true";
const result = spawnSync(process.execPath, [path.join(__dirname, "run-next.cjs"), "build"], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
