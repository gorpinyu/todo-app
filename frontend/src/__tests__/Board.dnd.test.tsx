// Unit test: drag does not trigger click (Requirement 1.3)

describe("Unit: drag does not trigger click", () => {
  it("firing dragStart on a task card does not invoke onCardClick", () => {
    const onCardClick = vi.fn();
    const task: Task = {
      id: 1,
      title: "Test task",
      description: null,
      status: "todo",
      priority: null,
      category: null,
      due_date: null,
      created_at: "2024-01-01T00:00:00.000Z",
    };

    const { container } = render(
      <Board
        tasks={[task]}
        onCardClick={onCardClick}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );

    const taskCard = container.querySelector(".task-card");
    expect(taskCard).not.toBeNull();

    fireEvent.dragStart(taskCard!);

    expect(onCardClick).not.toHaveBeenCalled();
  });
});

// Feature: kanban-drag-and-drop, Property 2: Column highlight follows drag cursor

import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import * as fc from "fast-check";
import Board from "../components/Board";
import type { Task } from "../types";

// **Validates: Requirements 2.1, 2.2, 2.3**

const columnKeyToClass: Record<string, string> = {
  todo: "col-todo",
  inprogress: "col-inprogress",
  completed: "col-completed",
};

const baseTasks: Task[] = [
  {
    id: 1,
    title: "Todo task",
    description: null,
    status: "todo",
    priority: null,
    category: null,
    due_date: null,
    created_at: "2024-01-01T00:00:00.000Z",
  },
  {
    id: 2,
    title: "In progress task",
    description: null,
    status: "inprogress",
    priority: null,
    category: null,
    due_date: null,
    created_at: "2024-01-01T00:00:00.000Z",
  },
  {
    id: 3,
    title: "Completed task",
    description: null,
    status: "completed",
    priority: null,
    category: null,
    due_date: null,
    created_at: "2024-01-01T00:00:00.000Z",
  },
];

// Feature: kanban-drag-and-drop, Property 3: Valid drop invokes status change with correct arguments

// **Validates: Requirements 3.1, 3.2**

describe("Property 3: Valid drop invokes status change with correct arguments", () => {
  it("drop on different column calls onStatusChange exactly once with (taskId, targetStatus)", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.constantFrom("todo", "inprogress", "completed"),
          fc.constantFrom("todo", "inprogress", "completed"),
        ),
        ([sourceStatus, targetStatus]: [string, string]) => {
          const onStatusChange = vi.fn();
          const task: Task = {
            id: 42,
            title: "Test task",
            description: null,
            status: sourceStatus as Task["status"],
            priority: null,
            category: null,
            due_date: null,
            created_at: "2024-01-01T00:00:00.000Z",
          };

          const { container } = render(
            <Board
              tasks={[task]}
              onCardClick={vi.fn()}
              onEdit={vi.fn()}
              onDelete={vi.fn()}
              onStatusChange={onStatusChange}
            />,
          );

          // Find the task card and fire dragStart to set drag state
          const taskCard = container.querySelector(".task-card");
          expect(taskCard).not.toBeNull();
          fireEvent.dragStart(taskCard!);

          // Find the target column and fire drop
          const targetColClass = columnKeyToClass[targetStatus];
          const targetColumn = container.querySelector(
            `.column.${targetColClass}`,
          );
          expect(targetColumn).not.toBeNull();
          fireEvent.drop(targetColumn!);

          if (sourceStatus !== targetStatus) {
            // Handler should be called exactly once with (taskId, targetStatus)
            expect(onStatusChange).toHaveBeenCalledTimes(1);
            expect(onStatusChange).toHaveBeenCalledWith(task.id, targetStatus);
          } else {
            // Same column drop — handler should NOT be called
            expect(onStatusChange).not.toHaveBeenCalled();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Property 2: Column highlight follows drag cursor", () => {
  it("dragover adds drag-over class; dragleave removes it and no other column has it", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("todo", "inprogress", "completed"),
        (columnKey: string) => {
          const { container } = render(
            <Board
              tasks={baseTasks}
              onCardClick={vi.fn()}
              onEdit={vi.fn()}
              onDelete={vi.fn()}
              onStatusChange={vi.fn()}
            />,
          );

          // Find all column divs
          const allColumns = container.querySelectorAll(".column");
          expect(allColumns.length).toBe(3);

          // Find the specific column for this key
          const targetColumn = container.querySelector(
            `.column.${columnKeyToClass[columnKey]}`,
          );
          expect(targetColumn).not.toBeNull();

          // Fire dragover on the target column
          fireEvent.dragOver(targetColumn!);

          // Assert target column has drag-over class
          expect(targetColumn!.classList.contains("drag-over")).toBe(true);

          // Assert no other column has drag-over class
          allColumns.forEach((col) => {
            if (col !== targetColumn) {
              expect(col.classList.contains("drag-over")).toBe(false);
            }
          });

          // Fire dragleave on the target column
          fireEvent.dragLeave(targetColumn!);

          // Assert drag-over class is removed from target column
          expect(targetColumn!.classList.contains("drag-over")).toBe(false);

          // Assert no column has drag-over class
          allColumns.forEach((col) => {
            expect(col.classList.contains("drag-over")).toBe(false);
          });
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: kanban-drag-and-drop, Property 4: Drag state is reset after any drag operation ends

// **Validates: Requirements 3.3, 3.4**

describe("Property 4: Drag state is reset after any drag operation ends", () => {
  it("after any drag end scenario, no column has drag-over class and dragged card opacity is 1", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("valid-drop", "same-column-drop", "dragend-outside"),
        (scenario: string) => {
          const onStatusChange = vi.fn();
          const task: Task = {
            id: 10,
            title: "Drag test task",
            description: null,
            status: "todo",
            priority: null,
            category: null,
            due_date: null,
            created_at: "2024-01-01T00:00:00.000Z",
          };

          const { container } = render(
            <Board
              tasks={[task]}
              onCardClick={vi.fn()}
              onEdit={vi.fn()}
              onDelete={vi.fn()}
              onStatusChange={onStatusChange}
            />,
          );

          const taskCard = container.querySelector(".task-card");
          expect(taskCard).not.toBeNull();

          const todoColumn = container.querySelector(".column.col-todo")!;
          const inprogressColumn = container.querySelector(
            ".column.col-inprogress",
          )!;

          if (scenario === "valid-drop") {
            // dragStart on card → dragOver different column → drop on different column
            fireEvent.dragStart(taskCard!);
            fireEvent.dragOver(inprogressColumn);
            fireEvent.drop(inprogressColumn);
          } else if (scenario === "same-column-drop") {
            // dragStart on card → drop on same column
            fireEvent.dragStart(taskCard!);
            fireEvent.drop(todoColumn);
          } else {
            // dragend-outside: dragStart on card → dragEnd on card (no drop)
            fireEvent.dragStart(taskCard!);
            fireEvent.dragEnd(taskCard!);
          }

          // Assert: no column has drag-over class
          const allColumns = container.querySelectorAll(".column");
          allColumns.forEach((col) => {
            expect(col.classList.contains("drag-over")).toBe(false);
          });

          // Assert: the task card's opacity is "1" (not reduced)
          const cardEl = container.querySelector(".task-card") as HTMLElement;
          expect(cardEl).not.toBeNull();
          expect(cardEl.style.opacity).toBe("1");
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: kanban-drag-and-drop, Property 8: ARIA live region announces status change after drop

// **Validates: Requirements 5.2**

describe("Property 8: ARIA live region announces status change after drop", () => {
  it("aria-live region contains non-empty text after a valid cross-column drop", () => {
    fc.assert(
      fc.property(
        fc
          .tuple(
            fc.constantFrom("todo", "inprogress", "completed"),
            fc.constantFrom("todo", "inprogress", "completed"),
          )
          .filter(([s, t]) => s !== t),
        ([sourceStatus, targetStatus]: [string, string]) => {
          const task: Task = {
            id: 99,
            title: "ARIA test task",
            description: null,
            status: sourceStatus as Task["status"],
            priority: null,
            category: null,
            due_date: null,
            created_at: "2024-01-01T00:00:00.000Z",
          };

          const { container } = render(
            <Board
              tasks={[task]}
              onCardClick={vi.fn()}
              onEdit={vi.fn()}
              onDelete={vi.fn()}
              onStatusChange={vi.fn()}
            />,
          );

          // Find the task card and fire dragStart to set drag state
          const taskCard = container.querySelector(".task-card");
          expect(taskCard).not.toBeNull();
          fireEvent.dragStart(taskCard!);

          // Find the target column and fire drop
          const targetColClass = columnKeyToClass[targetStatus];
          const targetColumn = container.querySelector(
            `.column.${targetColClass}`,
          );
          expect(targetColumn).not.toBeNull();
          fireEvent.drop(targetColumn!);

          // Assert the aria-live region has non-empty text content
          const liveRegion = container.querySelector(
            '[role="status"][aria-live="polite"]',
          );
          expect(liveRegion).not.toBeNull();
          expect(liveRegion!.textContent).not.toBe("");
          expect(liveRegion!.textContent!.trim().length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Unit test: status buttons still work after drag wiring (Requirement 5.3)

describe("Unit: status buttons still work after drag wiring", () => {
  it("clicking '▶ Start' button calls onStatusChange with (task.id, 'inprogress')", () => {
    const onStatusChange = vi.fn();
    const task: Task = {
      id: 7,
      title: "Button test task",
      description: null,
      status: "todo",
      priority: null,
      category: null,
      due_date: null,
      created_at: "2024-01-01T00:00:00.000Z",
    };

    const { getByText } = render(
      <Board
        tasks={[task]}
        onCardClick={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onStatusChange={onStatusChange}
      />,
    );

    const startButton = getByText("▶ Start");
    fireEvent.click(startButton);

    expect(onStatusChange).toHaveBeenCalledTimes(1);
    expect(onStatusChange).toHaveBeenCalledWith(task.id, "inprogress");
  });
});

// Unit test: same-column drop is a no-op (Requirement 3.2)

describe("Unit: same-column drop is a no-op", () => {
  it("dropping a card onto its own column does not invoke onStatusChange", () => {
    const onStatusChange = vi.fn();
    const task: Task = {
      id: 1,
      title: "Test task",
      description: null,
      status: "todo",
      priority: null,
      category: null,
      due_date: null,
      created_at: "2024-01-01T00:00:00.000Z",
    };

    const { container } = render(
      <Board
        tasks={[task]}
        onCardClick={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onStatusChange={onStatusChange}
      />,
    );

    // Find the task card and fire dragStart
    const taskCard = container.querySelector(".task-card");
    expect(taskCard).not.toBeNull();
    fireEvent.dragStart(taskCard!);

    // Find the same column the task is in (col-todo) and fire drop on it
    const todoColumn = container.querySelector(".column.col-todo");
    expect(todoColumn).not.toBeNull();
    fireEvent.drop(todoColumn!);

    // onStatusChange should NOT have been called
    expect(onStatusChange).not.toHaveBeenCalled();
  });
});
