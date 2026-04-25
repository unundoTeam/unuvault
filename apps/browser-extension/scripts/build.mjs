import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");
const distRoot = join(packageRoot, "dist");
const browserEnv = {
  "process.env.NEXT_PUBLIC_API_BASE_URL": JSON.stringify(
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  ),
  "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  ),
  "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  ),
};

const browserBundleOptions = {
  bundle: true,
  define: browserEnv,
  format: "esm",
  platform: "browser",
  target: "chrome120",
};
const contentBundleOptions = {
  ...browserBundleOptions,
  format: "iife",
  globalName: "unuvaultContent",
};

const manifest = {
  manifest_version: 3,
  name: "UnuVault",
  version: "0.0.1",
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
  },
  background: {
    service_worker: "background.js",
    type: "module",
  },
  action: {
    default_popup: "popup.html",
  },
  content_scripts: [
    {
      js: ["content.js"],
      matches: ["http://*/*", "https://*/*"],
      run_at: "document_idle",
    },
  ],
  permissions: ["activeTab", "storage"],
};

async function main() {
  await rm(distRoot, { force: true, recursive: true });
  await mkdir(distRoot, { recursive: true });

  await build({
    ...browserBundleOptions,
    entryPoints: [join(packageRoot, "src/background/index.ts")],
    outfile: join(distRoot, "background.js"),
  });

  await build({
    ...contentBundleOptions,
    entryPoints: [join(packageRoot, "src/content/index.ts")],
    outfile: join(distRoot, "content.js"),
  });

  await build({
    ...browserBundleOptions,
    entryPoints: [join(packageRoot, "src/popup/index.tsx")],
    outfile: join(distRoot, "popup.js"),
  });

  await copyFile(
    join(packageRoot, "static/popup.html"),
    join(distRoot, "popup.html"),
  );

  await writeFile(
    join(distRoot, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

main().catch((error) => {
  console.error("Browser extension build failed.");
  console.error(error);
  process.exitCode = 1;
});
