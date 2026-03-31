// Feature: kanban-drag-and-drop, Property 7: TaskCard exposes draggable attribute

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import * as fc from "fast-check";
import TaskCard from "../components/TaskCard";
import type { Task } from "../types";

// **Validates: Requirements 5.1**

const priorityArb = fc.record({
  id: fc.integer({ min: 1, max: 100 }),
  name: fc.string({ minLength: 1, maxLength: 20 }),
  emoji: fc.constantFrom("🔴", "🟡", "🟢", "⚪"),
});

const categoryArb = fc.record({
  id: fc.integer({ min: 1, max: 100 }),
  name: fc.string({ minLength: 1, maxLength: 20 }),
  emoji: fc.constantFrom("🏠", "💼", "🎯", "📚"),
});

const taskArb: fc.Arbitrary<Task> = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
  status: fc.constantFrom(
    "todo" as const,
    "inprogress" as const,
    "completed" as const,
  ),
  priority: fc.option(priorityArb, { nil: null }),
  category: fc.option(categoryArb, { nil: null }),
  due_date: fc.option(fc.string({ minLength: 10, maxLength: 10 }), {
    nil: null,
  }),
  created_at: fc.constant("2024-01-01T00:00:00.000Z"),
});

// Feature: kanban-drag-and-drop, Property 1: Dragging card applies visual distinction
describe("Property 1: Dragging card applies visual distinction", () => {
  // **Validates: Requirements 1.2**
  it("isDragging=true yields opacity ≤ 0.5; isDragging=false yields opacity 1", () => {
    fc.assert(
      fc.property(taskArb, (task: Task) => {
        const { container: draggingContainer } = render(
          <TaskCard
            task={task}
            onClick={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onStatusChange={vi.fn()}
            isDragging={true}
            onDragStart={vi.fn()}
            onDragEnd={vi.fn()}
          />,
        );
        const draggingRoot = draggingContainer.firstElementChild as HTMLElement;
        const draggingOpacity = parseFloat(draggingRoot.style.opacity);
        expect(draggingOpacity).toBeLessThanOrEqual(0.5);

        const { container: normalContainer } = render(
          <TaskCard
            task={task}
            onClick={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onStatusChange={vi.fn()}
            isDragging={false}
            onDragStart={vi.fn()}
            onDragEnd={vi.fn()}
          />,
        );
        const normalRoot = normalContainer.firstElementChild as HTMLElement;
        const normalOpacity = parseFloat(normalRoot.style.opacity);
        expect(normalOpacity).toBe(1);
      }),
      { numRuns: 100 },
    );
  });
});

describe("Property 7: TaskCard exposes draggable attribute", () => {
  it("root element has draggable=true for any task", () => {
    fc.assert(
      fc.property(taskArb, (task: Task) => {
        const { container } = render(
          <TaskCard
            task={task}
            onClick={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onStatusChange={vi.fn()}
            isDragging={false}
            onDragStart={vi.fn()}
            onDragEnd={vi.fn()}
          />,
        );

        const root = container.firstElementChild as HTMLElement;
        expect(root).not.toBeNull();
        expect(root.getAttribute("draggable")).toBe("true");
      }),
      { numRuns: 100 },
    );
  });
});
