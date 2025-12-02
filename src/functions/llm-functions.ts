import fs from 'fs'

import z from 'zod'

import type { Bot } from "../bot";


interface LLMFunctionResult {
    message: string
    stop_calling?: boolean
}

/**
 * LLM Function groups. Used to limit the tools available for LLM to call.
 */
type LLMFunctionGroup = "mining" | "fighting" | "creative"

/**
 * LLM function. If result is a string, it is treated as 'message' in LLMFunctionResult with 'stop_calling' set to false.
 */
type LLMFunctionHandler<T extends z.ZodObject<any>> = (args: { bot: Bot } & z.infer<T>) => Promise<LLMFunctionResult | string>

type LLMFunctionArgs = { [key: string]: any }

interface LLMFunctionInfo<T> {
    /**
     * Group to which this function is assigned to.
     */
    group?: LLMFunctionGroup;

    /**
     * The name of the function to call.
     */
    name: string;

    /**
     * A description of the function. Used by the model to determine whether or not to
     * call the function.
     */
    description?: string | null;

    /**
     * A JSON schema object describing the parameters of the function.
     */
    schema: T

    /**
     * Function to invoke when tool is called
     */
    handler: (args: { bot: Bot } & z.infer<T>) => any

}

export class LLMFunctions {
    private static llmFunctions: LLMFunctionInfo<any>[] = []

    /**
     * Register all TS functions from the given path.
     * @param path - The path to the functions.
     */
    public static async registerFunctions(path: string) {

        const files = fs.readdirSync(path);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file && file.endsWith('.ts')) {
                await import(`./examples/${file}`)
            }
        }
    }


    /**
     * Returns tool list in Ollama/LM Studio format
     * @param groups - list of function groups to include in tools
     * @returns list to pass into 'tools'
     */
    public static getTools(groups: Set<LLMFunctionGroup>): object[] {
        // getting functions that have no group, or it's group is listed in "groups"
        let filtered = this.llmFunctions.filter((v) => (v.group == undefined || groups.has(v.group)))
        // converting to Ollama schema
        return filtered.map(({ name, description, schema }) => ({
            type: "function",
            function: {
                name,
                description,
                parameters: z.toJSONSchema(schema)
            }
        }));
    }

    private static checkFunction(info: LLMFunctionInfo<any>) {
        // parse parameters of the function
        const paramMatch = info.handler.toString().match(/\(([^)]*)\)/);
        let params = paramMatch && paramMatch[1] ? paramMatch[1].split(',').map((v) => v.trim()) : ["bot"];

        // first parameter is always 'bot'
        if (params.length < 1) {
            throw TypeError(`Function must have at least 1 parameter`);
        }
        params = params.slice(1);

        const schema = Object.entries(info.properties).map(v => v[0]);
        if (params.length != schema.length) {
            throw TypeError(`Function parameter count mismatch: schema - ${schema.length}, actual - ${params.length}`);
        }

        // Check for missing required parameters (optional parameters are allowed to be missing)
        const missingParams = params.filter((v) => !schema.includes(v))
        if (missingParams.length > 0) {
            throw TypeError(`Missing schema parameters: ${missingParams.join(', ')}`);
        }

        const extraParams = schema.filter((v) => !params.includes(v))
        if (extraParams.length > 0) {
            throw TypeError(`Extra schema parameters: ${extraParams.join(', ')}`);
        }
    }

    public static register<T>(config: LLMFunctionInfo<T>) {
        console.log(`Registering function ${config.name}`)

        if (this.llmFunctions.filter((v) => v.name == config.name).length > 0) {
            throw Error(`Function already exists!`);
        }
        this.checkFunction(config);
        this.llmFunctions.push(config)
    }

    /**
     * Searches function 'name', checks it's schema against 'args' using zod, and then calls it. 
     * @param bot llm bot context
     * @param name function name
     * @param args arguments to pass function
     * @returns error text or function result
     */
    public static invokeFunction(bot: Bot, name: string, args: LLMFunctionArgs) {
        const info = this.llmFunctions.filter((v) => v.name == name)[0];
        if (info == undefined) {
            return `Function '${name}' not found!`
        }

        // Validate arguments against the function's schema
        const schema = z.object(Object.fromEntries(
            Object.entries(info.properties).map(([key, prop]) => [
                key, prop.type
            ])
        ));

        try {
            schema.parse(args);
        } catch (error) {
            return `Invalid arguments: ${error}`;
        }

        // get parameters of function to invoke (except first 'bot')
        const paramMatch = info.handler.toString().match(/\(([^)]*)\)/);
        let paramNames = paramMatch && paramMatch[1] ? paramMatch[1].split(',').map((v) => v.trim()).slice(1) : [];

        const values = paramNames.map(name => args[name]);
        return info.handler(bot, ...values);
    }
}

/**
 * This class is used by Bot just to avoid tool conversion to Ollama format each time generation is requested
 */
export class LLMFunctionsCache {
    private activeGroups: Set<LLMFunctionGroup>;
    private cachedTools: object[];

    constructor(groups: Set<LLMFunctionGroup> = new Set()) {
        this.activeGroups = groups;
        this.cachedTools = LLMFunctions.getTools(groups);
    }

    add(group: LLMFunctionGroup) {
        this.activeGroups.add(group)
    }

    delete(group: LLMFunctionGroup) {
        this.activeGroups.delete(group)
    }

    get groups() {
        return this.activeGroups;
    }

    set groups(new_groups: Set<LLMFunctionGroup>) {
        this.activeGroups = new_groups;
        this.cachedTools = LLMFunctions.getTools(this.activeGroups);
    }

    get tools() {
        return this.cachedTools;
    }
}
