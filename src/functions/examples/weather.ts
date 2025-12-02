import { LLMFunctions } from "../llm-functions";

LLMFunctions.register({
    name: "weather",
    description: "Get the current weather",
    parameters: {
        type: "object",
        properties: {
            city: { type: "string", description: "The city to get the weather for" }
        }
    },
    handler: (args: { format: string }) => {
        return {
            temperature: 20,
            humidity: 50,
            pressure: 1013,
            wind_speed: 5,
            wind_direction: "N"
        }
    },
    strict: true,
    type: 'function'
})