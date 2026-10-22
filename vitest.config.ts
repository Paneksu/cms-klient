import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src/", import.meta.url));

export default defineConfig({
  resolve: {
    // Tests import the package by name, the same way consumers do.
    alias: [
      { find: /^@panekweb\/cms$/, replacement: `${src}index.ts` },
      { find: /^@panekweb\/cms\/(.*)$/, replacement: `${src}$1.ts` },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
