/**
 * Creates SQLite auth tables and seeds demo accounts using better-auth's own API.
 * Run: node scripts/seed-auth.mjs
 */
import { betterAuth } from "better-auth"
import { getMigrations } from "better-auth/db/migration"
import { DatabaseSync } from "node:sqlite"

const db = new DatabaseSync("./aarogya.db")

const auth = betterAuth({
  database: db,
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "asha",
        input: true,
      },
    },
  },
})

console.log("Running migrations...")
const { runMigrations } = await getMigrations(auth.options)
await runMigrations()
console.log("Migrations done.")

const users = [
  { name: "ASHA Demo",  email: "asha@demo.com",  password: "asha1234",  role: "asha" },
  { name: "Admin Demo", email: "admin@demo.com", password: "admin1234", role: "admin" },
]

for (const u of users) {
  try {
    await auth.api.signUpEmail({
      body: { name: u.name, email: u.email, password: u.password, role: u.role },
    })
    console.log(`✓ Created ${u.email} (role: ${u.role})`)
  } catch (err) {
    const msg = err?.message ?? String(err)
    if (msg.toLowerCase().includes("exist") || msg.toLowerCase().includes("unique")) {
      console.log(`  ${u.email} already exists, skipping.`)
    } else {
      console.error(`✗ ${u.email}:`, msg)
    }
  }
}

console.log("Done.")
