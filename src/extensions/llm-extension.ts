import OpenAI from "openai";
import { type LLMFunctionResult, LLMFunctions } from "../functions/llm-functions";
import type { ChatCompletionMessageParam } from "openai/resources";
import { BaseAgentExtension } from "./base-agent-extension";
import type { Agent } from "../agent";
import type { GameMode } from "mineflayer"
import fs from 'fs';


type ChatMessage = ChatCompletionMessageParam & {
    tool_name?: string;
}

const defaultSystemMessage: string = `
You are a minecraft player.
Just play the game and help other players.
Use tools to interact with the game.
Tools always print out results from your point of view in the game (e.g. if tool says YOU have 100% health, it is YOUR health and not user's).
Also, don't use multiline answers, minecraft chat does not support them.
Parallel tool calling is not supported!!!

For task execution, use the TODO LIST. Break tasks into subtasks and execute them one by one.
Modify the TODO LIST through the set_todo_list function.
`;

export class LLMExtension extends BaseAgentExtension {
    private client: OpenAI;
    private messages: ChatMessage[] = [];
    private functionCallHistory: string[] = [];

    private gameModeTools: Record<GameMode | "any", any[]> = {
        "survival": [],
        "creative": [],
        "adventure": [],
        "spectator": [],
        "any": []
    }

    public systemMessage: string = defaultSystemMessage;

    constructor(agent: Agent, client: OpenAI) {
        super(agent);
        this.client = client;

        this.messages.push({
            role: "system",
            content: this.systemMessage
        })

        const allTools = LLMFunctions.getOpenAiTools();
        allTools.forEach((tool) => {
            if(tool.gameMode) {
                this.gameModeTools[tool.gameMode].push(tool);
            }
            else {
                this.gameModeTools["any"].push(tool);
            }
        });

        //this.loadMemory();
    }


    loadMemory() {
        if (fs.existsSync(`${this.agent.getBotDataPath()}/memory.json`)) {
            this.messages = JSON.parse(fs.readFileSync(`${this.agent.getBotDataPath()}/memory.json`, 'utf8'));
        }
    }

    saveMemory() {
        fs.writeFileSync(`${this.agent.getBotDataPath()}/memory.json`, JSON.stringify(this.messages, null, 2));
    }

    saveTools() {
        fs.writeFileSync(`${this.agent.getBotDataPath()}/tools.json`, JSON.stringify(this.gameModeTools, null, 2));
    }

    //Удаляем из памяти сообщения о функциях get nearby entities. Иначе он будет старые сообщения о позициях объектов юзать.
    tidyMemory() {
        this.messages = this.messages.filter((message) => message.tool_name != "get_nearby_entities");
        this.messages = this.messages.filter((message) => message.tool_name != "show_inventory");
        //Очищаем историю вызовов функций
        this.functionCallHistory = [];
    }


    async getResponse(newMessage?: string): Promise<string> {
        if (newMessage) {
            this.messages.push({
                role: "user",
                content: newMessage
            })
        }

        const inventory = this.agent.mineflayerBot!.inventory.items().map((item) => {
            return {
                name: item.name,
                count: item.count,
                type: item.type
            }
        })

        console.log('LLM request');
        try {


            let tools = this.gameModeTools[this.agent.mineflayerBot?.player.gamemode as unknown as GameMode]
            tools = tools.concat(this.gameModeTools["any"])

            const response = await this.client.chat.completions.create({
                model: process.env.LLM_MODEL || "openai/gpt-oss-20b",
                tool_choice: "auto",
                tools: tools,
                messages: [
                    {
                        role: "user",
                        content: `Your inventory: ${JSON.stringify(inventory)}
                        Your position: ${this.agent.mineflayerBot!.entity.position}
                        Your todo list: ${this.agent.todoList}
                        `
                    },
                    ...this.messages
                ],
            });
            const choice = response.choices[0]!

            //Если есть tool calls, то вызываем функции
            if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
                
                //Добавляем сообщение ассистента с tool_calls в историю
                this.messages.push({
                    role: "assistant",
                    content: choice.message.content || "",
                    tool_calls: choice.message.tool_calls
                })

                for (const tool_call of choice.message.tool_calls) {
                    if (tool_call.type == "function") {

                        console.log(tool_call)

                        const function_name = tool_call.function.name

                        //Проверка на 3 подряд вызова одной функции
                        if (this.functionCallHistory.length >= 2 &&
                            this.functionCallHistory[this.functionCallHistory.length - 1] === function_name &&
                            this.functionCallHistory[this.functionCallHistory.length - 2] === function_name) {
                            console.log(`Penalty: Function ${function_name} called 3 times in a row, skipping`)
                            this.messages.push({
                                role: "assistant",
                                content: `I can't call ${function_name} again, it's been called 3 times in a row`
                            })
                            continue
                        }

                        let function_arguments = JSON.parse(tool_call.function.arguments)

                        // this.bot.mineflayerBot!.chat("Calling function: " + function_name + " with arguments: " + tool_call.function.arguments)

                        const ret = await LLMFunctions.invokeFunction(function_name, this.agent, function_arguments)
                        const result: LLMFunctionResult = (typeof(ret) == "string") ? { message: ret } : ret;

                        this.messages.push({
                            role: "tool",
                            tool_call_id: tool_call.id,
                            tool_name: function_name,
                            content: JSON.stringify(result.message)
                        })

                        //Добавляем функцию в историю вызовов
                        this.functionCallHistory.push(function_name)
                        //Ограничиваем историю последними 3 вызовами
                        if (this.functionCallHistory.length > 3) {
                            this.functionCallHistory.shift()
                        }

                        this.saveMemory();

                        //Костыль для остановки вызова функций. Например если боту надо сначала дойти до цели, то мы останавливаем вызов функций и возвращаем сообщение.
                        if (result.stop_calling) {
                            console.log("Stop calling functions")
                            return result.message
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

                //this.tidyMemory();
                this.saveMemory();

                //Если нет tool calls, то возвращаем ответ
                return choice.message.content!
            }

        } catch (error) {
            console.error('Error in LLM request', JSON.stringify(error, null, 2))
            return 'Error in LLM request'
        }
    }
}