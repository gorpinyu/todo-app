import { query, ensureDefaultProject } from "./db.js";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

const taskQuery = `
  SELECT t.id, t.title, t.description, t.status, t.due_date, t.created_at, t.completed_at, t.archived, t.project_id,
    p.id as priority_id, p.name as priority_name, p.emoji as priority_emoji,
    c.id as category_id, c.name as category_name, c.emoji as category_emoji
  FROM tasks t
  LEFT JOIN priorities p ON t.priority_id = p.id
  LEFT JOIN categories c ON t.category_id = c.id
`;

function formatTask(row: any) {
  return {
    id: row.id, title: row.title, description: row.description,
    status: row.status, due_date: row.due_date, created_at: row.created_at,
    completed_at: row.completed_at,
    archived: row.archived, project_id: row.project_id,
    priority: row.priority_id ? { id: row.priority_id, name: row.priority_name, emoji: row.priority_emoji } : null,
    category: row.category_id ? { id: row.category_id, name: row.category_name, emoji: row.category_emoji } : null,
  };
}

export async function handleRequest(req: Request, user: { user_id: number; email: string }): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  const uid = user.user_id;

  if (method === "OPTIONS") return new Response(null, { status: 204, headers });

  try {
    if (path === "/api/categories" && method === "GET") {
      const { rows } = await query("SELECT * FROM categories");
      return json(rows);
    }
    if (path === "/api/priorities" && method === "GET") {
      const { rows } = await query("SELECT * FROM priorities");
      return json(rows);
    }

    // Projects
    if (path === "/api/projects" && method === "GET") {
      const includeArchived = url.searchParams.get("archived") === "true";
      const archived = includeArchived ? "TRUE" : "FALSE";
      
      // Debug logging
      console.log(`[PROJECT FETCH] user_id=${uid}, email=${user.email}, archived=${archived}`);
      
      const { rows } = await query(
        `SELECT * FROM projects WHERE user_id=$1 AND archived=${archived} ORDER BY is_default DESC, created_at ASC`,
        [uid],
      );
      
      console.log(`[PROJECT FETCH RESULT] Found ${rows.length} projects for user_id=${uid}`);
      
      return json(rows);
    }
    if (path === "/api/projects" && method === "POST") {
      const body = await req.json();
      const name = (body.name ?? "").trim();
      if (!name || name.length > 100) return json({ error: "Name must be 1–100 characters" }, 400);
      
      // Debug logging
      console.log(`[PROJECT CREATE] user_id=${uid}, email=${user.email}, project_name="${name}"`);
      
      const { rows } = await query(
        "INSERT INTO projects (user_id,name,description,color,emoji,is_default,archived) VALUES ($1,$2,$3,$4,$5,FALSE,FALSE) RETURNING *",
        [uid, name, body.description??null, body.color??null, body.emoji??null],
      );
      
      console.log(`[PROJECT CREATED] id=${rows[0].id}, user_id=${rows[0].user_id}, name="${rows[0].name}"`);
      
      return json(rows[0], 201);
    }
    const projectMatch = path.match(/^\/api\/projects\/(\d+)$/);
    if (projectMatch) {
      const pid = parseInt(projectMatch[1]);
      if (method === "PUT") {
        const body = await req.json();
        const { rows } = await query("SELECT id, is_default FROM projects WHERE id=$1 AND user_id=$2", [pid, uid]);
        if (!rows[0]) return json({ error: "Not found" }, 404);
        const name = (body.name ?? "").trim();
        if (!name || name.length > 100) return json({ error: "Name must be 1–100 characters" }, 400);
        const { rows: updated } = await query(
          "UPDATE projects SET name=$1,description=$2,color=$3,emoji=$4 WHERE id=$5 AND user_id=$6 RETURNING *",
          [name, body.description??null, body.color??null, body.emoji??null, pid, uid],
        );
        return json(updated[0]);
      }
      if (method === "DELETE") {
        const { rows } = await query("SELECT id, is_default FROM projects WHERE id=$1 AND user_id=$2", [pid, uid]);
        if (!rows[0]) return json({ error: "Not found" }, 404);
        if (rows[0].is_default) return json({ error: "Cannot archive the default project" }, 403);
        
        // Check if project has tasks (only count tasks belonging to this user)
        const { rows: taskCount } = await query("SELECT COUNT(*) as count FROM tasks WHERE project_id=$1 AND user_id=$2", [pid, uid]);
        const hasTasks = parseInt(taskCount[0].count) > 0;
        
        await query("UPDATE projects SET archived=TRUE WHERE id=$1 AND user_id=$2", [pid, uid]);
        return json({ success: true, has_tasks: hasTasks });
      }
    }

    // Permanent project deletion (only for archived projects)
    const projectDeleteMatch = path.match(/^\/api\/projects\/(\d+)\/permanent$/);
    if (projectDeleteMatch && method === "DELETE") {
      const pid = parseInt(projectDeleteMatch[1]);
      const { rows } = await query("SELECT id, is_default, archived FROM projects WHERE id=$1 AND user_id=$2", [pid, uid]);
      if (!rows[0]) return json({ error: "Not found" }, 404);
      if (rows[0].is_default) return json({ error: "Cannot delete the default project" }, 403);
      if (!rows[0].archived) return json({ error: "Project must be archived first" }, 400);
      
      // Delete all tasks in this project (only user's tasks)
      await query("DELETE FROM tasks WHERE project_id=$1 AND user_id=$2", [pid, uid]);
      // Delete the project
      await query("DELETE FROM projects WHERE id=$1 AND user_id=$2", [pid, uid]);
      return json({ success: true });
    }

    // Restore project from archive
    const projectRestoreMatch = path.match(/^\/api\/projects\/(\d+)\/restore$/);
    if (projectRestoreMatch && method === "PUT") {
      const pid = parseInt(projectRestoreMatch[1]);
      const { rows } = await query("SELECT id, archived FROM projects WHERE id=$1 AND user_id=$2", [pid, uid]);
      if (!rows[0]) return json({ error: "Not found" }, 404);
      if (!rows[0].archived) return json({ error: "Project is not archived" }, 400);
      
      await query("UPDATE projects SET archived=FALSE WHERE id=$1 AND user_id=$2", [pid, uid]);
      return json({ success: true });
    }

    // Active tasks only
    if (path === "/api/tasks" && method === "GET") {
      const projectId = url.searchParams.get("project_id");
      let q = taskQuery + " WHERE t.user_id=$1 AND t.archived=FALSE";
      const params: unknown[] = [uid];
      if (projectId) { q += ` AND t.project_id=$2`; params.push(parseInt(projectId)); }
      q += " ORDER BY t.created_at DESC";
      const { rows } = await query(q, params);
      return json(rows.map(formatTask));
    }
    if (path === "/api/tasks" && method === "POST") {
      const body = await req.json();
      const projectId = body.project_id ?? await ensureDefaultProject(uid);
      const { rows } = await query(
        `INSERT INTO tasks (title,description,status,priority_id,category_id,user_id,project_id,due_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [body.title, body.description??null, body.status??"todo", body.priority_id??null, body.category_id??null, uid, projectId, body.due_date??null],
      );
      const { rows: task } = await query(taskQuery + " WHERE t.id=$1 AND t.user_id=$2", [rows[0].id, uid]);
      return json(formatTask(task[0]), 201);
    }

    // Archived tasks list
    if (path === "/api/archive" && method === "GET") {
      const { rows } = await query(taskQuery + " WHERE t.user_id=$1 AND t.archived=TRUE ORDER BY t.created_at DESC", [uid]);
      return json(rows.map(formatTask));
    }

    const taskMatch = path.match(/^\/api\/tasks\/(\d+)$/);
    if (taskMatch) {
      const id = parseInt(taskMatch[1]);
      if (method === "GET") {
        const { rows } = await query(taskQuery + " WHERE t.id=$1 AND t.user_id=$2 AND t.archived=FALSE", [id, uid]);
        if (!rows[0]) return json({ error: "Not found" }, 404);
        return json(formatTask(rows[0]));
      }
      if (method === "PUT") {
        const body = await req.json();
        
        // Auto-set completed_at when status changes to completed
        let completedAt = body.completed_at !== undefined ? body.completed_at : undefined;
        if (body.status === "completed" && completedAt === undefined) {
          // Check if task is being marked as completed
          const { rows: current } = await query("SELECT status FROM tasks WHERE id=$1 AND user_id=$2", [id, uid]);
          if (current[0] && current[0].status !== "completed") {
            completedAt = new Date().toISOString();
          }
        } else if (body.status !== "completed") {
          // Clear completed_at if status is changed from completed
          completedAt = null;
        }
        
        const { rowCount } = await query(
          `UPDATE tasks SET title=$1,description=$2,status=$3,priority_id=$4,category_id=$5,due_date=$6,project_id=COALESCE($7,project_id),completed_at=$8 WHERE id=$9 AND user_id=$10 AND archived=FALSE`,
          [body.title, body.description??null, body.status, body.priority_id??null, body.category_id??null, body.due_date??null, body.project_id??null, completedAt, id, uid],
        );
        if (!rowCount) return json({ error: "Not found" }, 404);
        const { rows } = await query(taskQuery + " WHERE t.id=$1 AND t.user_id=$2", [id, uid]);
        return json(formatTask(rows[0]));
      }
      // Soft-delete → archive
      if (method === "DELETE") {
        await query("UPDATE tasks SET archived=TRUE WHERE id=$1 AND user_id=$2", [id, uid]);
        return json({ success: true });
      }
    }

    // Restore from archive back to main board
    const archiveMatch = path.match(/^\/api\/archive\/(\d+)$/);
    if (archiveMatch) {
      const id = parseInt(archiveMatch[1]);
      if (method === "PUT") {
        await query("UPDATE tasks SET archived=FALSE WHERE id=$1 AND user_id=$2 AND archived=TRUE", [id, uid]);
        return json({ success: true });
      }
      if (method === "DELETE") {
        await query(
          "UPDATE tasks SET title='[Deleted]',description=NULL WHERE id=$1 AND user_id=$2 AND archived=TRUE",
          [id, uid],
        );
        return json({ success: true });
      }
    }

    const commentsMatch = path.match(/^\/api\/tasks\/(\d+)\/comments$/);
    if (commentsMatch) {
      const taskId = parseInt(commentsMatch[1]);
      if (method === "GET") {
        const { rows } = await query(
          "SELECT c.* FROM comments c JOIN tasks t ON c.task_id=t.id WHERE c.task_id=$1 AND t.user_id=$2 ORDER BY c.created_at ASC",
          [taskId, uid],
        );
        return json(rows);
      }
      if (method === "POST") {
        const body = await req.json();
        // Verify task belongs to user before adding comment
        const { rows: taskCheck } = await query("SELECT id FROM tasks WHERE id=$1 AND user_id=$2", [taskId, uid]);
        if (!taskCheck[0]) return json({ error: "Task not found" }, 404);
        
        const { rows } = await query("INSERT INTO comments (task_id,content) VALUES ($1,$2) RETURNING *", [taskId, body.content]);
        return json(rows[0], 201);
      }
    }

    const commentMatch = path.match(/^\/api\/comments\/(\d+)$/);
    if (commentMatch && method === "DELETE") {
      const commentId = parseInt(commentMatch[1]);
      // Verify comment belongs to user's task before deleting
      await query(
        "DELETE FROM comments WHERE id=$1 AND task_id IN (SELECT id FROM tasks WHERE user_id=$2)",
        [commentId, uid]
      );
      return json({ success: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: "Internal server error" }, 500);
  }
}
