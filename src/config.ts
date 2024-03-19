import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  ORACLE_PRIVATE_KEY: z.string(),
  TRPC_URL: z.string().url(),
});

export const config = envSchema.parse(process.env);
