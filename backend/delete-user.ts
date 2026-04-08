import { query } from "./db.js";

const email = process.argv[2];

if (!email) {
  console.error("Usage: bun delete-user.ts <email>");
  process.exit(1);
}

async function deleteUser() {
  const { rows } = await query("SELECT id FROM users WHERE email = $1", [email]);
  
  if (rows.length === 0) {
    console.log(`User ${email} not found`);
    return;
  }
  
  const userId = rows[0].id;
  console.log(`Found user ${email} with id ${userId}`);
  
  // Delete user (CASCADE will delete all related data: projects, tasks, comments, etc.)
  await query("DELETE FROM users WHERE id = $1", [userId]);
  
  console.log(`✓ Deleted user ${email} and all associated data`);
}

deleteUser().catch(console.error);
