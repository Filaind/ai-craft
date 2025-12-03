import fs from 'fs'
import z from 'zod'

import type { Bot } from "../bot";
import type { GameMode } from "mineflayer"

/**
 * LLM Function groups. Used to limit the tools available for LLM to call.
 */
export type LLMFunctionGroup = "mining" | "fighting" | "unsafe"

export interface LLMFunctionResult {
    message: any
    stop_calling?: boolean
}

/**
 * LLM function. If result is a string, it is treated as 'message' in LLMFunctionResult with 'stop_calling' set to false.
 */
type LLMFunctionHandler<T extends z.ZodObject> = (bot: Bot, args: z.infer<T>) => Promise<LLMFunctionResult | string>

interface LLMFunctionInfo<T extends z.ZodObject> {
    /**
     * Group to which this function is assigned to.
     */
    group?: LLMFunctionGroup;
    /**
     * If true, the function is only available in the given game mode.
     */
    gameMode?: GameMode | "any";

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
    public static getOpenAiTools(): { name: string, group?: LLMFunctionGroup, gameMode?: GameMode | "any", description?: string, parameters: object }[] {
        // getting functions that have no group, or it's group is listed in "groups"
        return this.llmFunctions.map(({ name, description, schema, group, gameMode }) => ({
            name: name,
            group: group,
            gameMode: gameMode,
            description: description,
            parameters: this.toJSONSchema(schema)
        }));
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
     * @param bot llm bot context
     * @param args arguments to pass function
     * @returns error text or function result
     */
    public static invokeFunction(name: string, bot: Bot, args: { [key: string]: any }) {
        const info = this.llmFunctions.filter((v) => v.name == name)[0];
        if (info == undefined) {
            return `Function '${name}' is not found!`
        }

        // Validate arguments against the function's schema
        try {
            info.schema.parse(args);
        } catch (error) {
            return `Invalid arguments: ${error}`;
        }

        return info.handler(bot, args);
    }
}
