import fs from 'fs'
import z from 'zod'

import OpenAI from 'openai'

import type { Agent } from "../agent";
import type { GameMode } from "mineflayer"

export type LLMFunctionTool = {group?: LLMFunctionGroup, gameMode?: GameMode} & OpenAI.ChatCompletionFunctionTool

/**
 * LLM Function groups. Used to limit the tools available for LLM to call.
 */
export type LLMFunctionGroup = "mining" | "fighting" | "unsafe"

export type LLMFunctionGroups = LLMFunctionGroup | LLMFunctionGroup[]

export interface LLMFunctionResult {
    result?: "success" | "error";
    message: any;
    stop_calling?: boolean;
}

/**
 * LLM function. If result is a string, it is treated as 'message' in LLMFunctionResult with 'stop_calling' set to false.
 */
type LLMFunctionHandler<T extends z.ZodObject> = (agent: Agent, args: z.infer<T>) => Promise<LLMFunctionResult | string>

interface LLMFunctionInfo<T extends z.ZodObject> {
    /**
     * Group to which this function is assigned to.
     */
    group?: LLMFunctionGroup;
    /**
     * If true, the function is only available in the given game mode.
     */
    gameMode?: GameMode;

    /**
     * The name of the function to call.
     */
    name: string;

    /**
     * A description of the function. Used by the model to determine whether or not to
     * call the function.
     */
    description?: string | undefined;

    /**
     * A JSON schema object describing the parameters of the function.
     */
    schema: T;

    /**
     * Function to invoke when tool is called
     */
    handler: LLMFunctionHandler<T>;

}

export class LLMFunctions {
    private static llmFunctions: LLMFunctionInfo<z.ZodObject>[] = []

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

    private static toJSONSchema(schema: z.ZodObject) {
        let json = z.toJSONSchema(schema, { target: "openapi-3.0" })
        if (json) {
            // trim schema to save some tokens
            delete json["$schema"];
            let properties = json["properties"];
            if (properties) {
                for (let value of (Object.values(properties) as any[])) {
                    if (value["type"] == "integer") {
                        if (value["minimum"] <= -9007199254740991) {
                            delete value["minimum"]
                        }
                        if (value["maximum"] >= 9007199254740991) {
                            delete value["maximum"]
                        }
                    }
                }
            }
        }
        return json;
    }

    /**
     * Returns tool list in OpenAI format
     * @param groups - list of function groups to include in tools
     * @returns list to pass into 'tools'
     */
    public static getOpenAiTools(): LLMFunctionTool[] {
        // getting functions that have no group, or it's group is listed in "groups"
        return this.llmFunctions.map(({ name, description, schema, group, gameMode }) => {
            let function_tool: LLMFunctionTool = {
                type: "function",
                function: {
                    name: name,
                    parameters: this.toJSONSchema(schema),
                    description: description
                }
            }
            if (group != undefined) function_tool.group = group;
            if (gameMode != undefined) function_tool.gameMode = gameMode;
            return function_tool;
        });
    }

    public static register<T extends z.ZodObject>(config: LLMFunctionInfo<T>) {
        console.log(`Registering function ${config.name}`)

        if (this.llmFunctions.filter((v) => v.name == config.name).length > 0) {
            throw Error(`Function already exists!`);
        }
        this.llmFunctions.push(config)
    }

    /**
     * Searches function 'name', checks it's schema against 'args' using zod, and then calls it. 
     * @param name function name
     * @param agent llm agent context
     * @param args arguments to pass function
     * @returns error text or function result
     */
    public static async invokeFunction(name: string, agent: Agent, args: { [key: string]: any }): Promise<LLMFunctionResult> {
        const info = this.llmFunctions.filter((v) => v.name == name)[0];
        if (info == undefined) {
            return {
                result: "error",
                message: `Function '${name}' is not found!`
            }
        }

        try {
            // Validate arguments against the function's schema
            info.schema.parse(args);
            // Call function
            let ret = await info.handler(agent, args);
            if (typeof(ret) === "string") {
                // string is returned, treat as error
                let result: LLMFunctionResult = {
                    result: "error",
                    message: ret
                }
                return result;
            }
            // If result is not specified, treat as success
            if (!ret.result) ret.result = "success";
            return ret;
        } catch (e) {
            return {
                result: "error",
                message: e
            }
        }
    }
}
