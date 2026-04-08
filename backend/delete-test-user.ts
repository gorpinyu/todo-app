import { query, initDb } from "./db.js";

async function deleteTestUser() {
  const email = "andrii.gorpyniuk@yahoo.com";
  
  console.log(`Deleting user: ${email}`);
  
  try {
    await initDb();
    
    const { rows } = await query("SELECT id FROM users WHERE email = $1", [email]);
    
    if (rows.length === 0) {
      console.log(`✓ User ${email} not found. Nothing to delete.`);
      process.exit(0);
    }
    
    const userId = rows[0].id;
    console.log(`Found user ID: ${userId}`);
    
    // Check what will be deleted
    const { rows: projects } = await query("SELECT COUNT(*) as count FROM projects WHERE user_id = $1", [userId]);
    const { rows: tasks } = await query("SELECT COUNT(*) as count FROM tasks WHERE user_id = $1", [userId]);
    
    console.log(`This will delete:`);
    console.log(`  - 1 user account`);
    console.log(`  - ${projects[0].count} project(s)`);
    console.log(`  - ${tasks[0].count} task(s)`);
    
    // Delete user (cascade will handle projects and tasks)
    await query("DELETE FROM users WHERE id = $1", [userId]);
    
    console.log(`✓ Successfully deleted user ${email} and all associated data`);
    process.exit(0);
  } catch (error) {
    console.error("✗ Deletion failed:", error);
    process.exit(1);
  }
}

deleteTestUser();
