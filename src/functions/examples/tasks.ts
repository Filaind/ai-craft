

import { z } from "zod"

import { LLMFunctions } from "../llm-functions";
import type { Agent } from "../../agent"

export interface LLMTask {
	/**
	 * Short, descriptive title of the task
	 */
	title: string,
	/**
	 * Detailed description of the task in markdown format
	 */
	markdown?: string,
	/**
	 * Task priority. Higher value = higher priority. Arbitrary integer value, can be negative.
	 */
	priority: number,
	/**
	 * Task completion flag 
	 */
	completed: boolean
}

export interface LLMTaskDescription {
	title: string,
	markdown?: string,
	priority?: number,
	completed?: boolean
}

export class LLMTaskList {
	private list: LLMTask[] = [];

	/**
	 * @returns whole task list
	 */
	get(): LLMTask[] {
		return this.list;
	}

	/**
	 * Replaces whole task list.
	 * @param tasks - new task list. Will be sorted by priority. Missing properties will default to: priority - 0, completed - false
	 * @returns array of indices of inserted tasks
	 */
	set(tasks: LLMTaskDescription[]): number[] {
		let new_tasks: LLMTask[] = tasks.map((task) => ({
			priority: 0,
			completed: false,
			...task
		}));
		this.list = new_tasks.sort((a, b) => b.priority - a.priority);
		return new_tasks.map((v) => this.list.indexOf(v));
	}

	/**
	 * Removes all tasks from the list
	 */
	clear() {
		this.list = [];
	}

	/**
	 * Get index of currently active (not completed) task
	 * @returns index of active task (or -1 if no active tasks found)
	 */
	activeIndex(): number {
		return this.list.findIndex((v) => !v.completed)
	}

	/**
	 * Get currently active (not completed) task
	 * @returns active task
	 */
	active(): LLMTask | undefined {
		return this.list.find((v) => !v.completed)
	}

	/**
	 * Get information about currently active task
	 * @returns task description or title
	 */
	activeInfo(): string | undefined {
		let active_task = this.active();
		if (!active_task) return undefined;
		return active_task.markdown || active_task.title;
	}

	/**
	 * Marks currently active task as completed
	 * @returns index of the task that marked completed
	 */
	markCompleted(): number {
		let i = this.activeIndex();
		if (i >= 0) this.list[i]!.completed = true;
		return i;
	}

	/**
	 * Marks task as incomplete
	 * @param i - index of the task to mark incomplete
	 * @returns task that marked incomplete
	 */
	markIncomplete(i: number): LLMTask | undefined {
		let task = this.list[i];
		if (task) task.completed = false;
		return task;
	}

	/**
	 * Inserts new task before currently active one.
	 * If priority is not provided, it is set to the same value as in currently active task.
	 * @param task - task to insert
	 * @returns index of inserted task (-1 if priority check failed)
	 */
	addFront(task: LLMTaskDescription) {
		let i = this.activeIndex();
		if (i < 0) {
			return this.addBack(task);
		}
		return this.insert(i, task);
	}

	/**
	 * Inserts new task at the end of the list.
	 * If priority is not provided, it is set to the lowest number in the list.
	 * @param task - task to insert
	 * @returns index of inserted task (-1 if priority check failed)
	 */
	addBack(task: LLMTaskDescription): number {
		let last_priority = this.list[this.list.length - 1]?.priority!;
		if (last_priority < task.priority!) return -1;
		let index = this.list.push({
			priority: last_priority || 0,
			completed: false,
			...task
		}) - 1;
		return index
	}

	/**
	 * Inserts new task in the list. Task is inserted based on provided priority.
	 * @param task - task to insert
	 * @returns index of inserted task (-1 if priority check failed)
	 */
	add(task: LLMTaskDescription): number {
		let i = this.list.findIndex((v) => v.priority < task.priority!);
		if (i < 0) {
			return this.addBack(task);
		}
		return this.insert(i, task);
	}

	/**
	 * Inserts new task in the list.
	 * @param i - index in the list to insert task to
	 * @param task - task to insert
	 * @returns index of inserted task (-1 if priority check failed)
	 */
	insert(i: number, task: LLMTaskDescription): number {
		let next_priority = this.list[i]?.priority!;

		if (task.priority !== undefined) { // if priority is provided, check it
			// previous item must have the same or greater priority
			let prev_priority = this.list[i-1]?.priority!;
			if (prev_priority < task.priority) return -1;
			// next item must have the same or lower priority
			if (next_priority > task.priority) return -1;
		}

		let new_task: LLMTask = {
			priority: next_priority || 0,
			completed: false,
			...task
		};
		this.list.splice(i, 0, new_task)
		return this.list.indexOf(new_task);
	}

	/**
	 * Removes task at specified index
	 * @param index - index of the task to remove
	 * @returns removed task
	 */
	remove(index: number): LLMTask | undefined {
		return this.list.splice(index, 1)[0];
	}
}

LLMFunctions.register({
	name: "task_get_active",
	description: "Returns currently active (not completed) task",
	schema: z.object({}),
	handler: async (agent: Agent, args) => {
		let active_task = agent.llm.tasks.active();
		if (!active_task) return "There is no active tasks!";
		return {
			message: active_task
		}
	}
})

LLMFunctions.register({
	name: "task_completed",
	description: "Marks currently active task as completed. Completed tasks become inactive. Use this tool if you are absolutly sure that task is completed successfully.",
	schema: z.object({}),
	handler: async (agent: Agent, args) => {
		let index = agent.llm.tasks.markCompleted();
		if (index < 0) return `There is no active tasks to mark complete!`;
		return `Task at index ${index} marked as completed`;
	}
})

LLMFunctions.register({
	name: "task_revert",
	description: "Revert task at specified index to incomplete state. Use this tool to correct mistakenly completed task.",
	schema: z.object({
		index: z.int().describe("Index of task to mark incomplete.")
	}),
	handler: async (agent: Agent, args) => {
		let task = agent.llm.tasks.markIncomplete(args.index);
		if (!task) return `Task with index ${args.index} is not found!`;
		return `Task '${task.title}' reverted to incomplete state`;
	}
})

LLMFunctions.register({
	name: "task_list",
	description: "Returns list of all tasks, even if they are inactive. Tasks are sorted by priority. Detailed task markdown description is ommited.",
	schema: z.object({}),
	handler: async (agent: Agent, args) => {
		let list = agent.llm.tasks.get();
		if (list.length == 0) return "Task list is empty!";
		return {
			message: list.map(({title, priority, completed}) => ({
				title, priority, completed // don't send detailed description
			}))
		}
	}
})

LLMFunctions.register({
	name: "task_clear",
	description: "Removes all tasks from the list. Use it if you made a big error when creating task list or when you are sure that all tasks are completed.",
	schema: z.object(),
	handler: async (agent: Agent, args) => {
		agent.llm.tasks.clear()
		return "Task list is cleared";
	}
})

LLMFunctions.register({
	name: "task_set",
	description: "Rewrites whole task list. Tasks will be automatically sorted by priority. Order of tasks with the same priority is not changed.",
	schema: z.object({
		tasks: z.array(z.object({
			title: z.string().describe("Short, descriptive title (max 10 words)"),
			markdown: z.string().optional().describe("Detailed task description in markdown"),
			priority: z.int().optional().describe("Task priority. Higher value = higher priority. Default: 0"),
			completed: z.boolean().optional().describe("Task completion flag. Default: false")
		}))
	}),
	handler: async (agent: Agent, args) => {
		if (args.tasks.length == 0) return "No task list provided!";
		let indices = agent.llm.tasks.set(args.tasks);
		return "Task list set. Task indices: " + JSON.stringify(indices);
	}
})

LLMFunctions.register({
	name: "task_add",
	description: "Inserts one task in the task list. Index of the new task will be determined based on provided priority.",
	schema: z.object({
		title: z.string().describe("Short, descriptive title (max 10 words)"),
		markdown: z.string().optional().describe("Detailed task description in markdown"),
		priority: z.int().optional().describe("Task priority. Higher value = higher priority. Default: 0")
	}),
	handler: async (agent: Agent, args) => {
		let index = agent.llm.tasks.add(args);
		if (index < 0) {
			return `Failed to create a task`;
		}
		return `Task inserted at index ${index}`
	}
})

LLMFunctions.register({
	name: "task_insert",
	description: "Inserts one task in the task list by index. Use this function only if necessary.",
	schema: z.object({
		index: z.int().describe("Index in the list to insert task to"),
		title: z.string().describe("Short, descriptive title (max 10 words)"),
		markdown: z.string().optional().describe("Detailed task description in markdown"),
	}),
	handler: async (agent: Agent, args) => {
		let index = agent.llm.tasks.insert(args.index, {
			title: args.title,
			markdown: args.markdown
		});
		if (index < 0) {
			return `Failed to create a task at index ${args.index}`;
		}
		return `Task inserted at index ${index}`
	}
})

LLMFunctions.register({
	name: "task_remove",
	description: "Removes task from the list. Use this function only if necessary. If active task is completed, use 'task_mark_completed'.",
	schema: z.object({
		index: z.int().describe("Index of the task to remove"),
	}),
	handler: async (agent: Agent, args) => {
		let task = agent.llm.tasks.remove(args.index);
		if (!task) return `Task with index ${args.index} is not found!`;
		return `Task '${task.title}' at index ${args.index} is removed`
	}
})

/* not needed, if model is behaving normally
LLMFunctions.register({
	name: "task_add_front",
	description: "Inserts one task before currently active one. Priority is set to the same value as in active task.",
	schema: z.object({
		title: z.string().describe("Short, descriptive title (max 10 words)"),
		markdown: z.string().optional().describe("Detailed task description in markdown")
	}),
	handler: async (agent: Agent, args) => {
		let index = agent.llm.tasks.addFront(args);
		if (index < 0) {
			return `Failed to create a task`;
		}
		return `Task inserted at index ${index}`
	}
})

LLMFunctions.register({
	name: "task_add_back",
	description: "Inserts one task at the end of the task list. Priority is set to the lowest value in the list automatically",
	schema: z.object({
		title: z.string().describe("Short, descriptive title (max 10 words)"),
		markdown: z.string().optional().describe("Detailed task description in markdown")
	}),
	handler: async (agent: Agent, args) => {
		let index = agent.llm.tasks.addBack(args);
		if (index < 0) {
			return `Failed to create a task`;
		}
		return `Task inserted at index ${index}`
	}
})
*/