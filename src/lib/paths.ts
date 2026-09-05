import fs from "node:fs";
import path from "node:path";

export function getDataDir() {
  const dir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getDbPath() {
  return path.join(getDataDir(), "hub.db");
}

export function getConfigPath() {
  return path.join(getDataDir(), "config.json");
}
