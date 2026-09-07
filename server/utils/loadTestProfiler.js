import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

const enabled = () => String(process.env.LOAD_TEST_MODE || "").toLowerCase() === "true";
const resultPath = () => path.resolve("load-tests", "results", "profiles.jsonl");
export const startLoadTestProfile = (req) => {
  if (!enabled()) return null;
  const startedAt = performance.now();
  const profile = {
    runId: String(req.body?.notes || "unknown"),
    method: req.method,
    route: req.originalUrl,
    startedAt: new Date().toISOString(),
    marks: {},
    dbOperations: 0,
  };
  profile.startedAtMs = startedAt;
  req.loadTestProfile = profile;
  req.loadTestProfileMark = (name) => {
    profile.marks[name] = Number((performance.now() - startedAt).toFixed(2));
  };
  req.loadTestProfileCount = (count = 1) => {
    profile.dbOperations += Number(count) || 0;
  };
  return profile;
};

export const finishLoadTestProfile = async (req, res) => {
  if (!enabled() || !req.loadTestProfile) return;
  const profile = req.loadTestProfile;
  profile.status = res.statusCode;
  profile.total = Number((performance.now() - profile.startedAtMs).toFixed(2));
  delete profile.startedAtMs;
  await mkdir(path.dirname(resultPath()), { recursive: true });
  await appendFile(resultPath(), `${JSON.stringify(profile)}\n`);
};
