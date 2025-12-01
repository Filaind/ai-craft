import OpenAI from "openai";
import { LLMFunctions } from "./functions/llm-functions";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
    baseURL: "http://192.168.1.204:1234/v1",
});

await LLMFunctions.registerAllFunctions();

const response = await client.chat.completions.create({
    model: "openai/gpt-oss-20b",
    tool_choice: "auto",
    tools: LLMFunctions.getFunctionList() as any,
    messages: [{
        role: "user",
        content: "Get current time"
    }]
});

const choice = response.choices[0]!
choice.message.tool_calls?.forEach((tool_call) => {
    if (tool_call.type == "function") {
        const function_name = tool_call.function.name
        const function_arguments = JSON.parse(tool_call.function.arguments)
        const function_result = LLMFunctions.invokeFunction(function_name, function_arguments)
        console.log(function_result)
    }
})