import OpenAI from "openai";
import { LLMFunctions } from "./functions/llm-functions";
import type { ChatCompletionMessageParam } from "openai/resources";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
    baseURL: "http://192.168.1.204:1234/v1",
});

await LLMFunctions.registerAllFunctions();

let chat: Array<ChatCompletionMessageParam> = [];
chat.push({
    role: "user",
    content: "Get current time and weather"
})

async function getResponse() {
    const response = await client.chat.completions.create({
        model: "qwen/qwen3-coder-30b",
        tool_choice: "auto",
        tools: LLMFunctions.getFunctionList() as any,
        messages: chat
    });

    const choice = response.choices[0]!
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        console.log("Tool calls", choice.message.tool_calls.length)
        choice.message.tool_calls?.forEach((tool_call) => {
            if (tool_call.type == "function") {
                console.log(tool_call)
                const function_name = tool_call.function.name
                const function_arguments = JSON.parse(tool_call.function.arguments)
                const function_result = LLMFunctions.invokeFunction(function_name, function_arguments)
                console.log(function_result)
                chat.push({
                    role: "tool",
                    tool_call_id: tool_call.id,
                    content: JSON.stringify(function_result)
                })
            }
        })
        return getResponse()
    }
    else{
        console.log(choice.message.content)
        return choice.message.content
    }

}

getResponse()