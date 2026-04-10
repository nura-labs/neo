import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool(
  process.env.INSTANCE_UNIX_SOCKET
    ? {
        host: process.env.INSTANCE_UNIX_SOCKET,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASS?.trim(),
      }
    : {
        connectionString: process.env.DATABASE_URL,
      }
);

export const db = drizzle(pool, { schema });
