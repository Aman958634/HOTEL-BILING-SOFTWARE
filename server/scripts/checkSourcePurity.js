import fs from "node:fs";
import path from "node:path";

const roots = ["controllers", "services", "routes", "middleware", "utils"];
const pattern = /\b[A-Z][A-Za-z]+\.(find|findOne|findById|findOneAndUpdate|updateOne|updateMany|aggregate|countDocuments|exists|deleteOne|create)\s*\(/;
const violations = [];
for (const root of roots) {
  const directory = path.resolve(root);
  if (!fs.existsSync(directory)) continue;
  for (const file of fs.readdirSync(directory, { recursive: true })) {
    if (!String(file).endsWith(".js")) continue;
    const filename = path.join(directory, file);
    const lines = fs.readFileSync(filename, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (pattern.test(line)) violations.push(`${filename}:${index + 1}: ${line.trim()}`);
    });
  }
}
if (violations.length) {
  console.error(`Direct MongoDB access found: ${violations.length}`);
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Source purity check passed: no direct model operations outside repositories.");
}
