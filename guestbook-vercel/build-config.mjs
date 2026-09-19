// Runs on Vercel at build time. Turns environment variables into public/config.env.js.
// Only variables you actually set are written; everything else keeps its default.
import { writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const publicDir = join(root, "public");
const outFile = join(publicDir, "config.env.js");

// Fail early, with a clear message, if the site files were not uploaded.
const required = ["index.html", "app.js", "style.css", "config.js", "favicon.svg"];
const missing = required.filter((f) => !existsSync(join(publicDir, f)));
if (missing.length) {
  console.error("Missing files in the public/ folder: " + missing.join(", "));
  console.error("Upload the whole public folder to GitHub and redeploy.");
  process.exit(1);
}

const map = {
  CONTRACT_ADDRESS: ["contractAddress", String],
  CHAIN_ID:         ["chainId", Number],
  CHAIN_NAME:       ["chainName", String],
  RPC_URL:          ["rpcUrl", String],
  EXPLORER_URL:     ["explorer", String],
  FAUCET_NOTE:      ["faucetNote", String],
};

const overrides = {};
for (const [envKey, [prop, cast]] of Object.entries(map)) {
  const raw = process.env[envKey]?.trim();
  if (raw) overrides[prop] = cast(raw);
}

if (overrides.contractAddress && !/^0x[0-9a-fA-F]{40}$/.test(overrides.contractAddress)) {
  console.error(`CONTRACT_ADDRESS is not a valid address: "${overrides.contractAddress}". It should be 0x followed by 40 hex characters.`);
  process.exit(1);
}
if ("chainId" in overrides && !Number.isInteger(overrides.chainId)) {
  console.error("CHAIN_ID must be a whole number (Sepolia is 11155111).");
  process.exit(1);
}

writeFileSync(
  outFile,
  `Object.assign(window.GUESTBOOK_CONFIG = window.GUESTBOOK_CONFIG || {}, ${JSON.stringify(overrides, null, 2)});\n`
);
console.log("Wrote config.env.js with:", Object.keys(overrides).join(", ") || "(no overrides, using defaults)");
