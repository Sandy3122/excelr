import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const envPath = process.argv[2];
const projectId = "prj_X6IJt2vpU6SvItr5N4LzvyOAjA8d";
const teamId = "team_YayOo1goYmcJQcdCjpYjKwyX";
const token = JSON.parse(
  readFileSync(
    join(homedir(), "Library/Application Support/com.vercel.cli/auth.json"),
    "utf8",
  ),
).token;

const SKIP = new Set([
  "GOOGLE_SHEETS_SPREADSHEET_ID",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_SHEETS_SHEET_NAME",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
]);

function parseEnv(content) {
  const map = new Map();
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key) || map.has(key)) continue;
    let val = line.slice(eq + 1);
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!val.trim() || val.includes("BEGIN PRIVATE KEY-----\\n...")) continue;
    map.set(key, val);
  }
  return map;
}

async function api(method, path, body) {
  const url = `https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${teamId}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} ${res.status}: ${json.error?.message || text.slice(0, 200)}`);
  }
  return json;
}

const vars = parseEnv(readFileSync(envPath, "utf8"));
for (const key of SKIP) vars.delete(key);

const existing = await api("GET", `/v9/projects/${projectId}/env`);
const envs = existing.envs || existing;
for (const item of envs) {
  await api("DELETE", `/v9/projects/${projectId}/env/${item.id}`);
  console.log(`removed ${item.key} (${(item.target || []).join(",")})`);
}

for (const [key, value] of vars) {
  await api("POST", `/v10/projects/${projectId}/env`, {
    key,
    value,
    type: "encrypted",
    target: ["production", "preview", "development"],
  });
  console.log(`added ${key} once → Production, Preview, Development`);
}

console.log(`\nDone. ${vars.size} unique variables.`);
