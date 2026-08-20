import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // Include both fitment schema and auth schema
  schema: [
    "./src/lib/fitment-db/schema.ts",
    "./src/lib/auth-schema.ts",
  ],
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
  verbose: true,
  strict: true,
});
