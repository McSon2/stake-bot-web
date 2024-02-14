import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = resolve(__dirname, "subscription.db");

const dbSubscription = open({
  filename: dbPath,
  driver: sqlite3.Database,
});

export default dbSubscription;