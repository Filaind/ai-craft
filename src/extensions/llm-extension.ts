import OpenAI from "openai";
import { LLMFunctions } from "../functions/llm-functions";
import type { ChatCompletionMessageParam } from "openai/resources";
import { BaseBotExtension } from "./base-bot-extension";
import type { Bot } from "../bot";
import fs from 'fs';

type ChatMessage = ChatCompletionMessageParam & {
    tool_name?: string;
}

export class LLMExtension extends BaseBotExtension {
    private client: OpenAI;
    private messages: ChatMessage[] = [];


    public systemMessage: string = "You are a minecraft player. Just play the game and help other players. Use tools to interact with the game.";

    constructor(bot: Bot, client: OpenAI) {
        super(bot);
        this.client = client;

        this.messages.push({
            role: "system",
            content: this.systemMessage
        })

        //this.loadMemory();

    }

    loadMemory() {
        if (fs.existsSync(`${this.bot.getBotDataPath()}/memory.json`)) {
            this.messages = JSON.parse(fs.readFileSync(`${this.bot.getBotDataPath()}/memory.json`, 'utf8'));
        }
    }

    saveMemory() {
        fs.writeFileSync(`${this.bot.getBotDataPath()}/memory.json`, JSON.stringify(this.messages, null, 2));
    }

    //Удаляем из памяти сообщения о функциях get nearby entities. Иначе он будет старые сообщения о позициях объектов юзать.
    tidyMemory() {
        this.messages = this.messages.filter((message) => message.tool_name != "get_nearby_entities");
        this.messages = this.messages.filter((message) => message.tool_name != "show_inventory");
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
            model: process.env.LLM_MODEL || "openai/gpt-oss-20b",
            tool_choice: "auto",
            tools: LLMFunctions.getFunctionList() as any,
            messages: this.messages,
        });

        const choice = response.choices[0]!

        //Если есть tool calls, то вызываем функции
        if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
            for (const tool_call of choice.message.tool_calls) {
                if (tool_call.type == "function") {

                    console.log(tool_call)

                    const function_name = tool_call.function.name

                    let function_arguments = JSON.parse(tool_call.function.arguments)
                    //Добавляем класс бота в аргументы функции
                    function_arguments.bot = this.bot;
 //                   this.bot.mineflayerBot!.chat("Calling function: " + function_name + " with arguments: " + tool_call.function.arguments)

                    const function_result = await LLMFunctions.invokeFunction(function_name, function_arguments)
                    
                    this.messages.push({
                        role: "tool",
                        tool_call_id: tool_call.id,
                        tool_name: function_name,
                        content: JSON.stringify(function_result)
                    })

                    this.saveMemory();

                    //Костыль для остановки вызова функций. Например если боту надо сначала дойти до цели, то мы останавливаем вызов функций и возвращаем сообщение.
                    if (function_result.stop_calling) {
                        console.log("Stop calling functions")
                        return function_result.message
                    }
                }
            }
            //Рекурсивно вызываем дальше для получения следующего ответа
            return this.getResponse()
        }
        else {
            this.messages.push({
                role: "assistant",
                content: choice.message.content!
            })

            this.tidyMemory();
            this.saveMemory();

            //Если нет tool calls, то возвращаем ответ
            return choice.message.content!
        }

    }
}