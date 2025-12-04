

import { z } from "zod"

import { LLMFunctions } from "../llm-functions";
import type { Agent } from "../../agent"
import { fa } from "zod/locales";

export interface LLMTask {
	markdown: string,
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
	 */
	set(tasks: LLMTask[]) {
		this.list = tasks.map((task) => ({
			priority: 0,
			completed: false,
			...task
		})).sort((a, b) => b.priority - a.priority);
	}

	/**
	 * Removes all tasks from the list
	 */
	clear() {
		this.list = [];
	}

	/**
	 * Get active task
	 * @returns currently active (not completed) task
	 */
	active(): LLMTask | undefined {
		return this.list.find((v) => !v.completed)
	}

	/**
	 * Marks currently active task as completed
	 * @returns next active task
	 */
	mark_completed(): LLMTask | undefined {
		let task = this.active()
		if (task) {
			task.completed = true;
			return this.active(); // next active task
		}
		return undefined;
	}

	/**
	 * Inserts new task at the beginning of the list.
	 * Priority of the new task is set to the highest number in the list automatically.
	 * @param markdown - task text string in markdown format
	 * no return, because active task is always changed here
	 */
	addFront(markdown: string) {
		let first = this.list[0];
		this.list.unshift({
			markdown,
			priority: (first && first.priority) || 0,
			completed: false
		})
	}

	/**
	 * Inserts new task at the end of the list.
	 * Priority of the new task is set to the lowest number in the list automatically.
	 * @param markdown - task text string in markdown format
	 * @returns true - active task is changed, false - active task is not changed
	 */
	addBack(markdown: string): boolean {
		let last = this.list[this.list.length - 1];
		this.list.push({
			markdown,
			priority: (last && last.priority) || 0,
			completed: false
		})
		return last === undefined;
	}

	/**
	 * Inserts new task in the list. Task is inserted based on provided priority.
	 * @param markdown - task text string in markdown format
	 * @param priority - task priority
	 * @returns true - active task is changed, false - active task is not changed
	 */
	add(markdown: string, priority: number = 0): boolean {
		let task = {
			markdown,
			priority: priority || 0,
			completed: false
		};

		let i = this.list.findIndex((v) => v.priority! > task.priority!);
		if (i < 0) i = this.list.length;
		this.list.splice(i, 0, task)
		return i == 0;
	}
}

LLMFunctions.register({
	name: "task_active",
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
		let new_active = agent.llm.tasks.mark_completed()
		let message = new_active ? `New active task is:\n${new_active.markdown}` : "There is no active tasks left!";
		return "Task marked as completed.\n" + message;
	}
})

LLMFunctions.register({
	name: "task_list",
	description: "Returns all tasks, even if they are inactive. Tasks are sorted by priority.",
	schema: z.object({}),
	handler: async (agent: Agent, args) => {
		let list = agent.llm.tasks.get();
		if (list.length == 0) return "Task list is empty!";
		return {
			message: list
		}
	}
})

LLMFunctions.register({
	name: "task_set",
	description: "Rewrite whole task list. List will be automatically sorted by priority",
	schema: z.object({
		tasks: z.array(z.object({
			markdown: z.string().describe("Detailed task description in markdown format"),
			priority: z.int().optional().describe("Task priority. Higher value = higher priority. Default: 0")
		}))
	}),
	handler: async (agent: Agent, args) => {
		if (args.tasks.length == 0) return "No task list provided!";
		agent.llm.tasks.set(args.tasks);
		let active = agent.llm.tasks.active()!;
		return "Task list updated.\nNew active task is:\n" + JSON.stringify(active);
	}
})

LLMFunctions.register({
	name: "task_add",
	description: "Inserts one task in the task list. Index of the new task will be determined based on provided priority.",
	schema: z.object({
		markdown: z.string().describe("Detailed task description in markdown format"),
		priority: z.int().optional().describe("Task priority. Lower value = higher priority. Default: 0")
	}),
	handler: async (agent: Agent, args) => {
		let active_changed = agent.llm.tasks.add(args.markdown, args.priority);
		return `Task inserted.\nActive task ${active_changed ? "changed" : "not changed"}.`
	}
})

LLMFunctions.register({
	name: "task_add_front",
	description: "Inserts one task at the front of the task list. Priority is set to the highest value in the list automatically",
	schema: z.object({
		markdown: z.string().describe("Detailed task description in markdown format")
	}),
	handler: async (agent: Agent, args) => {
		agent.llm.tasks.addFront(args.markdown);
		return `Task inserted.\nActive task changed.`
	}
})

LLMFunctions.register({
	name: "task_add_back",
	description: "Inserts one task at the end of the task list. Priority is set to the lowest value in the list automatically",
	schema: z.object({
		markdown: z.string().describe("Detailed task description in markdown format")
	}),
	handler: async (agent: Agent, args) => {
		let active_changed = agent.llm.tasks.addBack(args.markdown);
		return `Task inserted.\nActive task ${active_changed ? "changed" : "not changed"}.`
	}
})