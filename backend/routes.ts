import { query } from "./db.js";

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
  SELECT t.id, t.title, t.description, t.status, t.due_date, t.created_at, t.archived,
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
    archived: row.archived,
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

    // Active tasks only
    if (path === "/api/tasks" && method === "GET") {
      const { rows } = await query(taskQuery + " WHERE t.user_id=$1 AND t.archived=FALSE ORDER BY t.created_at DESC", [uid]);
      return json(rows.map(formatTask));
    }
    if (path === "/api/tasks" && method === "POST") {
      const body = await req.json();
      const { rows } = await query(
        `INSERT INTO tasks (title,description,status,priority_id,category_id,user_id,due_date) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [body.title, body.description??null, body.status??"todo", body.priority_id??null, body.category_id??null, uid, body.due_date??null],
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
        const { rowCount } = await query(
          `UPDATE tasks SET title=$1,description=$2,status=$3,priority_id=$4,category_id=$5,due_date=$6 WHERE id=$7 AND user_id=$8 AND archived=FALSE`,
          [body.title, body.description??null, body.status, body.priority_id??null, body.category_id??null, body.due_date??null, id, uid],
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
        const { rows } = await query("INSERT INTO comments (task_id,content) VALUES ($1,$2) RETURNING *", [taskId, body.content]);
        return json(rows[0], 201);
      }
    }

    const commentMatch = path.match(/^\/api\/comments\/(\d+)$/);
    if (commentMatch && method === "DELETE") {
      await query("DELETE FROM comments WHERE id=$1", [parseInt(commentMatch[1])]);
      return json({ success: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: "Internal server error" }, 500);
  }
}
