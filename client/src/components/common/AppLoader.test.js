import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("AppLoader keeps the premium visual accessible and indeterminate", async () => {
  const [component, styles] = await Promise.all([
    read("./AppLoader.jsx"),
    read("../../index.css"),
  ]);

  assert.match(component, /role="status" aria-live="polite"/);
  assert.match(component, /Preparing your restaurant dashboard\.\.\./);
  assert.match(component, /Good food takes a little time\. Thanks for waiting!/);
  assert.match(component, /app-loader__ring/);
  assert.match(component, /app-loader__bubble--coffee/);
  assert.match(component, /app-loader__progress/);
  assert.doesNotMatch(component, /setTimeout|%/);
  assert.match(styles, /\.app-loader \{[\s\S]*min-height: 100dvh/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\) \{ \.app-loader/);
});

test("the loader is reserved for route and real protected bootstrap states", async () => {
  const [router, protectedRoute] = await Promise.all([
    read("../../routes/AppRouter.jsx"),
    read("./ProtectedRoute.jsx"),
  ]);

  assert.match(router, /const PageSkeleton = \(\) => <AppLoader \/>;/);
  assert.match(protectedRoute, /if \(profileLoading \|\| \(!user && !profileError\)\) \{\s*return <AppLoader \/>;/);
  assert.match(protectedRoute, /outletStatus === "loading"\) \{\s*return <AppLoader \/>;/);
});
