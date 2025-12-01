import OpenAI from "openai";
import { LLMFunctions } from "../functions/llm-functions";
import type { ChatCompletionMessageParam } from "openai/resources";
import { BaseBotExtension } from "./base-bot-extension";
import type { Bot } from "../bot";
import fs from 'fs';

export class LLMExtension extends BaseBotExtension {
    private client: OpenAI;
    private messages: ChatCompletionMessageParam[] = [];
    

    public systemMessage: string = "You are a helpful assistant that can help with Minecraft tasks.";

    constructor(bot: Bot, client: OpenAI) {
        super(bot);
        this.client = client;


    }

    saveMemory() {
        fs.writeFileSync('memory.json', JSON.stringify(this.messages, null, 2));
    }


    async getResponse(newMessage?: string): Promise<string> {
        if (newMessage) {
            this.messages.push({
                role: "user",
                content: newMessage
            })
        }

        console.log('LLM request');
        const response = await this.client.chat.completions.create({
            model: "qwen/qwen3-coder-30b",
            tool_choice: "auto",
            tools: LLMFunctions.getFunctionList() as any,
            messages: this.messages
        });

        const choice = response.choices[0]!

        //Если есть tool calls, то вызываем функции
        if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
            choice.message.tool_calls?.forEach((tool_call) => {
                if (tool_call.type == "function") {

                    console.log(tool_call)

                    const function_name = tool_call.function.name
                    const function_arguments = JSON.parse(tool_call.function.arguments)
                    const function_result = LLMFunctions.invokeFunction(function_name, function_arguments)

                    this.messages.push({
                        role: "tool",
                        tool_call_id: tool_call.id,
                        content: JSON.stringify(function_result)
                    })
                }
            })
            //Рекурсивно вызываем дальше для получения следующего ответа
            return this.getResponse()
        }
        else {
            this.messages.push({
                role: "assistant",
                content: choice.message.content!
            })
            //Если нет tool calls, то возвращаем ответ
            return choice.message.content!
        }

    }
}