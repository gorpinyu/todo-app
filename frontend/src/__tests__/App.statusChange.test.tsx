// Feature: kanban-drag-and-drop, Property 5: Local task list reflects new status after successful API call
// Feature: kanban-drag-and-drop, Property 6: Local task list reverts status after failed API call

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  act,
  waitFor,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import * as fc from "fast-check";
import App from "../App";
import type { Task } from "../types";

// **Validates: Requirements 4.2**

// Mock the api module
vi.mock("../api", () => ({
  api: {
    getTasks: vi.fn(),
    getCategories: vi.fn(),
    getPriorities: vi.fn(),
    updateTask: vi.fn(),
    createTask: vi.fn(),
    deleteTask: vi.fn(),
    getComments: vi.fn(),
    addComment: vi.fn(),
    deleteComment: vi.fn(),
  },
}));

import { api } from "../api";

const mockedApi = api as unknown as {
  getTasks: ReturnType<typeof vi.fn>;
  getCategories: ReturnType<typeof vi.fn>;
  getPriorities: ReturnType<typeof vi.fn>;
  updateTask: ReturnType<typeof vi.fn>;
};

const columnClassMap: Record<string, string> = {
  todo: "col-todo",
  inprogress: "col-inprogress",
  completed: "col-completed",
};

function makeTask(id: number, status: Task["status"]): Task {
  return {
    id,
    title: `Task ${id}`,
    description: null,
    status,
    priority: null,
    category: null,
    due_date: null,
    created_at: "2024-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("Property 5: Local task list reflects new status after successful API call", () => {
  it("task in local state has the new status after handleStatusChange resolves", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        // Only generate pairs where statuses differ
        fc
          .tuple(
            fc.constantFrom(
              "todo" as const,
              "inprogress" as const,
              "completed" as const,
            ),
            fc.constantFrom(
              "todo" as const,
              "inprogress" as const,
              "completed" as const,
            ),
          )
          .filter(([s, t]) => s !== t),
        async (taskId, [initialStatus, newStatus]) => {
          // Reset mocks and cleanup DOM between iterations
          // Reset mocks and cleanup DOM between iterations
          vi.clearAllMocks();
          cleanup();

          const task = makeTask(taskId, initialStatus);
          mockedApi.getTasks.mockResolvedValue([task]);
          mockedApi.getCategories.mockResolvedValue([]);
          mockedApi.getPriorities.mockResolvedValue([]);

          const updatedTask: Task = { ...task, status: newStatus };
          mockedApi.updateTask.mockResolvedValue(updatedTask);

          let container!: HTMLElement;
          await act(async () => {
            const result = render(<App />);
            container = result.container;
          });

          // Wait for initial load — task card should be in its initial column
          await waitFor(() => {
            const initialCol = container.querySelector(
              `.column.${columnClassMap[initialStatus]}`,
            );
            expect(initialCol?.querySelector(".task-card")).not.toBeNull();
          });

          // Trigger status change via drag-and-drop
          const taskCard = container.querySelector(".task-card")!;
          const targetColumn = container.querySelector(
            `.column.${columnClassMap[newStatus]}`,
          )!;

          // Fire dragStart first and let React process the state update
          await act(async () => {
            fireEvent.dragStart(taskCard);
          });

          // Then fire drop so dragState.draggedTaskId is already set
          await act(async () => {
            fireEvent.drop(targetColumn);
          });

          // Wait for updateTask to be called with the new status
          await waitFor(() => {
            expect(mockedApi.updateTask).toHaveBeenCalledWith(
              taskId,
              expect.objectContaining({ status: newStatus }),
            );
          });

          // After successful API call, the task card should appear in the new status column
          await waitFor(() => {
            const newColumn = container.querySelector(
              `.column.${columnClassMap[newStatus]}`,
            );
            expect(newColumn).not.toBeNull();
            const cardInNewColumn = newColumn!.querySelector(".task-card");
            expect(cardInNewColumn).not.toBeNull();
          });
        },
      ),
      { numRuns: 50 },
    );
  });
});

// **Validates: Requirements 4.1**

describe("Task 5.4: API called with correct payload on drop", () => {
  it("calls api.updateTask with the task id and status:inprogress when dropped on inprogress column", async () => {
    const task = makeTask(42, "todo");
    const updatedTask: Task = { ...task, status: "inprogress" };

    mockedApi.getTasks.mockResolvedValue([task]);
    mockedApi.getCategories.mockResolvedValue([]);
    mockedApi.getPriorities.mockResolvedValue([]);
    mockedApi.updateTask.mockResolvedValue(updatedTask);

    let container!: HTMLElement;
    await act(async () => {
      const result = render(<App />);
      container = result.container;
    });

    // Wait for the task card to appear in the "todo" column
    await waitFor(() => {
      const todoCol = container.querySelector(".column.col-todo");
      expect(todoCol?.querySelector(".task-card")).not.toBeNull();
    });

    const taskCard = container.querySelector(".column.col-todo .task-card")!;
    const inprogressCol = container.querySelector(".column.col-inprogress")!;

    // Simulate drag: dragStart on the card, then drop on the target column
    await act(async () => {
      fireEvent.dragStart(taskCard);
    });

    await act(async () => {
      fireEvent.drop(inprogressCol);
    });

    // Assert api.updateTask was called with the correct id and status
    await waitFor(() => {
      expect(mockedApi.updateTask).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ status: "inprogress" }),
      );
    });
  });
});

// **Validates: Requirements 4.3**

describe("Property 6: Local task list reverts status after failed API call", () => {
  it("task in local state retains original status after handleStatusChange rejects", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc
          .tuple(
            fc.constantFrom(
              "todo" as const,
              "inprogress" as const,
              "completed" as const,
            ),
            fc.constantFrom(
              "todo" as const,
              "inprogress" as const,
              "completed" as const,
            ),
          )
          .filter(([s, t]) => s !== t),
        async (taskId, [initialStatus, newStatus]) => {
          vi.clearAllMocks();
          cleanup();

          const task = makeTask(taskId, initialStatus);
          mockedApi.getTasks.mockResolvedValue([task]);
          mockedApi.getCategories.mockResolvedValue([]);
          mockedApi.getPriorities.mockResolvedValue([]);

          // Mock updateTask to reject (simulate API failure)
          mockedApi.updateTask.mockRejectedValue(new Error("API failure"));

          let container!: HTMLElement;
          await act(async () => {
            const result = render(<App />);
            container = result.container;
          });

          // Wait for initial load — task card should be in its initial column
          await waitFor(() => {
            const initialCol = container.querySelector(
              `.column.${columnClassMap[initialStatus]}`,
            );
            expect(initialCol?.querySelector(".task-card")).not.toBeNull();
          });

          // Trigger status change via drag-and-drop
          const taskCard = container.querySelector(".task-card")!;
          const targetColumn = container.querySelector(
            `.column.${columnClassMap[newStatus]}`,
          )!;

          await act(async () => {
            fireEvent.dragStart(taskCard);
          });

          await act(async () => {
            fireEvent.drop(targetColumn);
          });

          // Wait for updateTask to be called (the API call was attempted)
          await waitFor(() => {
            expect(mockedApi.updateTask).toHaveBeenCalledWith(
              taskId,
              expect.objectContaining({ status: newStatus }),
            );
          });

          // After API failure, the task card should revert to the original column
          await waitFor(() => {
            const originalCol = container.querySelector(
              `.column.${columnClassMap[initialStatus]}`,
            );
            expect(originalCol).not.toBeNull();
            const cardInOriginalCol = originalCol!.querySelector(".task-card");
            expect(cardInOriginalCol).not.toBeNull();
          });
        },
      ),
      { numRuns: 50 },
    );
  });
});
