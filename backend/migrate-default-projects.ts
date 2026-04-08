import { query, initDb } from "./db.js";

async function migrateDefaultProjects() {
  console.log("Starting migration: Update default project names to 'Sandbox Testbed'");
  
  try {
    await initDb();
    
    const { rows } = await query(
      "SELECT id, user_id, name FROM projects WHERE is_default = TRUE AND name != 'Sandbox Testbed'"
    );
    
    if (rows.length === 0) {
      console.log("✓ No projects need migration. All default projects are already named 'Sandbox Testbed'.");
      process.exit(0);
    }
    
    console.log(`Found ${rows.length} default project(s) to migrate:`);
    rows.forEach((row: any) => {
      console.log(`  - Project ID ${row.id} (User ${row.user_id}): "${row.name}" → "Sandbox Testbed"`);
    });
    
    const { rowCount } = await query(
      "UPDATE projects SET name = 'Sandbox Testbed' WHERE is_default = TRUE AND name != 'Sandbox Testbed'"
    );
    
    console.log(`✓ Successfully migrated ${rowCount} project(s)`);
    process.exit(0);
  } catch (error) {
    console.error("✗ Migration failed:", error);
    process.exit(1);
  }
}

migrateDefaultProjects();
