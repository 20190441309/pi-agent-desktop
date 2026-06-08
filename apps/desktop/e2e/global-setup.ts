import { access } from "fs/promises";
import { resolve } from "path";

const MAIN_ENTRY = resolve(__dirname, "..", "out", "main", "index.js");

export default async function globalSetup(): Promise<void> {
    await access(MAIN_ENTRY);
}
