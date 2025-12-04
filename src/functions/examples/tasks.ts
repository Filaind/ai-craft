

import { z } from "zod"

import { LLMFunctions } from "../llm-functions";
import type { Agent } from "../../agent"
import { fa } from "zod/locales";

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
		this.list = new_tasks.sort((a, b) => a.priority - b.priority);
		return new_tasks.map((v) => this.list.indexOf(v));
	}

	/**
	 * Removes all tasks from the list
	 */
	clear() {
		this.list = [];
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
	active_info(): string | undefined {
		let active_task = this.active();
		if (!active_task) return undefined;
		return active_task.markdown || active_task.title;
	}

	/**
	 * Marks currently active task as completed
	 */
	mark_completed() {
		let task = this.active()
		if (task) task.completed = true;
	}

	/**
	 * Inserts new task at the beginning of the list.
	 * Priority of the new task is set to the highest number in the list automatically.
	 * @param task - task to insert
	 * @returns index of inserted task (-1 if priority check failed)
	 */
	addFront(task: LLMTaskDescription) {
		let first = this.list[0];
		if (first!.priority > task.priority!) return -1;
		this.list.unshift({
			priority: (first && first.priority) || 0,
			completed: false,
			...task
		})
		return 0;
	}

	/**
	 * Inserts new task at the end of the list.
	 * Priority of the new task is set to the lowest number in the list automatically.
	 * @param task - task to insert
	 * @returns index of inserted task (-1 if priority check failed)
	 */
	addBack(task: LLMTaskDescription): number {
		let last = this.list[this.list.length - 1];
		if (last!.priority < task.priority!) return -1;
		return this.list.push({
			priority: (last && last.priority) || 0,
			completed: false,
			...task
		})
	}

	/**
	 * Inserts new task in the list. Task is inserted based on provided priority.
	 * @param task - task to insert
	 * @returns index of inserted task
	 */
	add(task: LLMTaskDescription): number {
		let new_task: LLMTask = {
			priority: 0,
			completed: false,
			...task
		};

		let i = this.list.findIndex((v) => v.priority > new_task.priority);
		if (i < 0) i = this.list.length;
		this.list.splice(i, 0, new_task)
		return i;
	}

	/**
	 * Removes task at specified index
	 * @param index - index of the task to remove
	 * @returns removed task
	 */
	remove(index: number): LLMTask | undefined {
		let removed = this.list.splice(index, 1)
		return (removed && removed.length > 0) ? removed[0] : undefined;
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
	name: "task_mark_completed",
	description: "Mark currently active task as completed. Completed tasks become inactive",
	schema: z.object(),
	handler: async (agent: Agent, args) => {
		agent.llm.tasks.mark_completed()
		return "Task marked as completed";
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
	description: "Removes all tasks from the list",
	schema: z.object(),
	handler: async (agent: Agent, args) => {
		agent.llm.tasks.clear()
		return "Task list is cleared";
	}
})

LLMFunctions.register({
	name: "task_set",
	description: "Rewrite whole task list. Tasks will be automatically sorted by priority",
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
		return `Task inserted at index ${index}`
	}
})

/* not needed, if model is behaving normally
LLMFunctions.register({
	name: "task_add_front",
	description: "Inserts one task at the front of the task list. Priority is set to the highest value in the list automatically",
	schema: z.object({
		title: z.string().describe("Short, descriptive title (max 10 words)"),
		markdown: z.string().optional().describe("Detailed task description in markdown")
	}),
	handler: async (agent: Agent, args) => {
		agent.llm.tasks.addFront(args);
		return `Task inserted at index 0`;
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
		return `Task inserted at index ${index}`
	}
})
*/