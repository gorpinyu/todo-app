export interface Priority {
  id: number;
  name: string;
  emoji: string;
}

export interface Category {
  id: number;
  name: string;
  emoji: string;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: "todo" | "inprogress" | "completed";
  priority: Priority | null;
  category: Category | null;
  due_date: string | null;
  created_at: string;
  archived: boolean;
}

export interface Comment {
  id: number;
  task_id: number;
  content: string;
  created_at: string;
}

export type TaskFormData = {
  title: string;
  description: string;
  status: string;
  priority_id: number | "";
  category_id: number | "";
  due_date: string;
};
