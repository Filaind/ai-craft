import { LLMFunctions } from "../llm-functions";

LLMFunctions.register({
    name: "time",
    description: "Get the current time",
    parameters: {
        type: "object",
        properties: {
            format: { type: "string", description: "The format of the time" }
        }
    },
    function: (args: { format: string }) => {
        return new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    },
    strict: true,
    type: 'function'
})
