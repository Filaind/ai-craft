import fs from 'fs'

interface LLMFunction {
    function: any, //link to the function

    /**
     * The name of the function to call.
     */
    name: string;

    /**
     * A JSON schema object describing the parameters of the function.
     */
    parameters: { [key: string]: unknown } | null;

    /**
     * Whether to enforce strict parameter validation. Default `true`.
     */
    strict: boolean | null;

    /**
     * The type of the function tool. Always `function`.
     */
    type: 'function';

    /**
     * A description of the function. Used by the model to determine whether or not to
     * call the function.
     */
    description?: string | null;
}


export class LLMFunctions {
    private static llmFunctions: LLMFunction[] = []

    private static registered: boolean = false

    /**
     * Register all TS functions from the given path.
     * @param path - The path to the functions.
     */
    public static async registerFunctions(path: string) {
        if (this.registered) return

        const files = fs.readdirSync(path);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file && file.endsWith('.ts')) {
                await import(`${path}/${file}`)
            }
        }

        this.registered = true
    }


    public static getFunctionList() {
        return this.llmFunctions.map((func) => ({
            type: "function",
            function: func
        }))
    }

    public static register(func: LLMFunction) {
        console.log(`Registering function ${func.name}`)
        this.llmFunctions.push(func)
    }

    //deprecated
    //     public static prompt() {
    //         return `AS AI YOU can use the functions
    // Don't say you don't know or can't do something. Try to find out or do it through the functions.
    // Don't talk about what features you know about. Just use them.

    // Rules for using functions:
    // If you decide to use one, respond in the format
    // {
    // "function_name": "FUNCTION NAME",
    // "arg": "FUNCTION ARGUMENTS IN JSON FORMAT"
    // }
    // and don't write anything else, no explanations.
    // After executing the function, I will send you its result.
    // You can call functions multiple times."

    // Functions list:
    // ${JSON.stringify(this.getFunctionList().map((e: LLMFunction) => e.description))}
    //         `
    //     }

    public static invokeFunction(name: string, args: any) {
        const func = this.llmFunctions.find((e: LLMFunction) => e.name == name)
        if (func == undefined) {
            return `Function ${name} not found`
        }
        return func.function(args)
    }
}