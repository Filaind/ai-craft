
import fs from 'fs';
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources";
import type { GameMode } from "mineflayer"

import { BaseAgentExtension } from "./base-agent-extension";
import type { Agent } from "../agent";
import { logger } from "../../index";

import { type LLMFunctionTool, type LLMFunctionGroup, type LLMFunctionGroups, type LLMFunctionResult, LLMFunctions } from "../functions/llm-functions";
import { LLMTaskList, type LLMTask } from '../functions/examples/tasks';
import { sleep } from 'bun';
import { Content } from 'openai/resources/containers/files.mjs';
import { property } from 'zod';

type ChatMessage = ChatCompletionMessageParam & {
    tool_name?: string;
}

const defaultSystemMessage: string = `
You are a minecraft bot player. Your username is: {username}.
Just play the game and help other players. Use tools to interact with the game.
Tools always print out results from your point of view in the game (e.g. if tool says YOU have 100% health, it is YOUR (bot) health).
Everything you say is sent to minecraft chat, so keep it short and don't use multiline answers.

Use the task list for complex task execution (like building a house or keeping a farm running)! Break tasks into subtasks and execute them one by one.
Don't use task list for tasks that can be completed by only one tool call.
Task list can be modified by tools that start with "task_*".
`;

const isLastMessageForMeTool: OpenAI.ChatCompletionFunctionTool = {
    type: "function",
    function: {
        name: "last_message_is_for_assistant_or_not",
        description: "Analyse the message history and call this function to notify the application whether the last message was addressed to the assistant or not",
        parameters: {
            type: "object", // use "boolean"?
            properties: {
                is_for_assistant: {
                    type: "boolean",
                    description: "true if last message was addressed to assistant, otherwise false"
                }
            },
            required: ["is_for_assistant"],
            additionalProperties: false
        },
        strict: true
    }
}

function formatString(template: string, values: Record<string, any>): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => 
        values[key] !== undefined ? values[key] : `{${key}}`
    );
}

export class LLMExtension extends BaseAgentExtension {
    private readonly client: OpenAI;
    private messages: ChatMessage[] = [];
    private functionCallHistory: string[] = [];

    private gameModeTools: Record<GameMode, LLMFunctionTool[]> = {
        "survival": [],
        "creative": [],
        "adventure": [],
        "spectator": []
    }

    public model: string = process.env.LLM_MODEL || "openai/gpt-oss-20b";
    public temperature: number = parseFloat(process.env.LLM_TEMPERATURE || "1.0");
    public systemMessage: string = defaultSystemMessage;

    public readonly groups: Set<LLMFunctionGroup> = new Set();
    public readonly tasks: LLMTaskList = new LLMTaskList();

    constructor(agent: Agent, client: OpenAI) {
        super(agent);
        this.client = client;

        const allTools = LLMFunctions.getOpenAiTools();
        logger.info(`[LLM] Loading ${allTools.length} available tools`);

        allTools.forEach((tool) => {
            if (tool.gameMode) {
                this.gameModeTools[tool.gameMode].push(tool);
            } else {
                for (let value of Object.values(this.gameModeTools)) {
                    value.push(tool);
                }
            }
        });

        logger.debug(`[LLM] Tools by game mode: survival=${this.gameModeTools.survival.length}, creative=${this.gameModeTools.creative.length}, adventure=${this.gameModeTools.adventure.length}, spectator=${this.gameModeTools.spectator.length}`);

        //this.saveTools();

        //this.loadMemory();
    }

    loadMemory() {
        const memoryPath = `${this.agent.getBotDataPath()}/memory.json`;
        if (fs.existsSync(memoryPath)) {
            this.messages = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
            logger.info(`[Memory] Loaded ${this.messages.length} messages from memory`);
        } else {
            logger.info('[Memory] No existing memory file found, starting fresh');
        }
    }

    saveMemory() {
        const memoryPath = `${this.agent.getBotDataPath()}/memory.json`;
        fs.writeFileSync(memoryPath, JSON.stringify(this.messages, null, 2));
        logger.debug(`[Memory] Saved ${this.messages.length} messages to memory`);
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

    canCall(group?: LLMFunctionGroups) {
        if (!group) return true;
        if (this.groups.size == 0) false;
        if (Array.isArray(group)) {
            for (let g of group) {
                if (!this.groups.has(g)) return false
            }
            return true;
        }
        return this.groups.has(group);
    }

    public pushSystemPrompt() {
        if (this.messages.length == 0) {
            this.messages.push({
                role: "system",
                content: formatString(this.systemMessage, {
                    username: this.agent.bot!.username
                })
            })
        }
    }

    public pushChatMessage(message: string, username?: string) {
        let llmMessage: OpenAI.ChatCompletionUserMessageParam = {
            role: "user",
            content: message
        }
        if (username) llmMessage.name = username;
        return this.messages.push(llmMessage);
    }

    private pushBotInfo() {
        let task_info = this.tasks.activeInfo();
        this.messages.push({
            role: "developer",
            content: `
            Your position: ${this.agent.bot!.entity.position}
            ${task_info ? `Your active task is:\n${task_info}` : "You have no active tasks"}
            `
        })
    }

    async isMessageAddressedToMe(): Promise<boolean> {
        let messages = this.messages.filter((message) => message.role != "system" && message.role != "tool").slice(-5);

        logger.debug(`[LLM] Messages to analyze: ${messages.map((message) => message.content).join('\n')}`);
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages,

            // force model to call isLastMessageForMeTool 
            tools: [ isLastMessageForMeTool ],
            //tool_choice: { type: "function", function: { name: isLastMessageForMeTool.function.name } },
            tool_choice: "required"
        });
        const message = response.choices[0]?.message;
        if (message) {
            if (message.tool_calls && message.tool_calls.length > 0) {
                let tool_call = message.tool_calls[0]!;
                if (tool_call.type == "function" && tool_call.function.name == isLastMessageForMeTool.function.name) {
                    try {
                        let args = JSON.parse(tool_call.function.arguments);
                        return args["is_for_assistant"] ?? true;
                    } catch (e) {
                        logger.warn(`[LLM] Failed to parse JSON: ${tool_call.function.arguments}`)
                    }
                } else {
                    logger.warn(`[LLM] Model called invalid tool: ${tool_call}`)
                }
            } else {
                logger.warn(`[LLM] Tool ${isLastMessageForMeTool.function.name} is not used`)
            }
            // fallback to content
            return message.content!.includes("true");
        }
        return false;
    }

    async generateSimple(messages: OpenAI.ChatCompletionMessageParam[]): Promise<OpenAI.ChatCompletion> {
        return await this.client.chat.completions.create({
            model: this.model,
            //tool_choice: "none",
            //temperature: this.temperature,
            messages: messages,
            parallel_tool_calls: false,
            reasoning_effort: "medium"
        });
    }

    async getResponse(): Promise<string> {
        logger.info('[LLM] Starting request');
        const startTime = Date.now();
        try {
            let tools = this.gameModeTools[this.agent.bot!.game.gameMode]
            tools = tools.filter((t) => this.canCall(t.group)).map((t) => ({
                type: "function",
                function: t.function
            }));

            logger.debug(`[LLM] Available tools: ${tools.map((t) => t.function.name).join(', ')}`);

            while (true) {
                this.pushBotInfo();

                const response = await this.client.chat.completions.create({
                    model: this.model,
                    tool_choice: this.tasks.active() ? "required" : "auto",
                    tools: tools,
                    temperature: this.temperature,
                    messages: this.messages,
                    parallel_tool_calls: false
                });
                logger.info(`[LLM] Request completed in ${Date.now() - startTime}ms`);

                const choice = response.choices[0]!

                //Если есть tool calls, то вызываем функции
                if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
                    logger.info(`[LLM] Processing ${choice.message.tool_calls.length} tool call(s)`);

                    for (const tool_call of choice.message.tool_calls) {
                        if (tool_call.type == "function") {

                            logger.debug({ tool_call }, `[Tool call] Executing: `);

                            const function_name = tool_call.function.name

                            // //Проверка на 3 подряд вызова одной функции
                            // if (this.functionCallHistory.length >= 2 &&
                            //     this.functionCallHistory[this.functionCallHistory.length - 1] === function_name &&
                            //     this.functionCallHistory[this.functionCallHistory.length - 2] === function_name) {
                            //     console.log(`Penalty: Function ${function_name} called 3 times in a row, skipping`)
                            //     this.messages.push({
                            //         role: "assistant",
                            //         content: `I can't call ${function_name} again, it's been called 3 times in a row`
                            //     })
                            //     continue
                            // }

                            let function_arguments = JSON.parse(tool_call.function.arguments)

                            // this.bot.bot!.chat("Calling function: " + function_name + " with arguments: " + tool_call.function.arguments)

                            const ret = await LLMFunctions.invokeFunction(function_name, this.agent, function_arguments);
                            logger.debug({ ret }, `[Tool call] Result: `);

                            this.messages.push({
                                name: this.agent.bot!.username,
                                role: "assistant",
                                content: choice.message.content || "",
                                tool_calls: [ tool_call ]
                            }, {
                                role: "tool",
                                tool_call_id: tool_call.id,
                                tool_name: function_name,
                                content: JSON.stringify({
                                    result: ret.result,
                                    message: ret.message
                                    // remove "stop_calling"
                                })
                            })
                            choice.message.content = ""; //костыль, что бы убрать сообщение из следующих инструментов

                            //Добавляем функцию в историю вызовов
                            this.functionCallHistory.push(function_name)
                            //Ограничиваем историю последними 3 вызовами
                            if (this.functionCallHistory.length > 3) {
                                this.functionCallHistory.shift()
                            }

                            this.saveMemory();

                            //Костыль для остановки вызова функций. Например если боту надо сначала дойти до цели, то мы останавливаем вызов функций и возвращаем сообщение.
                            if (ret.stop_calling) {
                                logger.warn(`[Tool call] Stopping function calls due to stop_calling flag from ${function_name}`)
                                return ret.message
                            }
                        }
                    }
                    //Рекурсивно вызываем дальше для получения следующего ответа
                    
                    if (!this.tasks.active()) {
                        return this.getResponse()
                    }
                }
                else {

                    //Модель обосралась на вызовы функций, иногда возвращает reasoning вместо content
                    //choice.message.reasoning - не существует в openai
                    //@ts-ignore
                    if (choice.message.role == "assistant" && choice.message.content == null) {
                        this.messages.push({
                            name: this.agent.bot!.username,
                            role: "assistant",
                            //@ts-ignore
                            content: choice.message.reasoning!
                        })
                        //Повторяем запрос, чтобы модель могла пофиксила свою ошибку
                        return this.getResponse()
                    }


                    this.messages.push({
                        name: this.agent.bot!.username,
                        role: "assistant",
                        content: choice.message.content!
                    })

                    //this.tidyMemory();
                    this.saveMemory();

                    //Если нет tool calls, то возвращаем ответ
                    logger.info(`[LLM] Finish response: ${choice.message.content!}`);
                    if (!this.tasks.active()) {
                        return choice.message.content!
                    }
                }
            }
        } catch (error) {
            logger.error(`[LLM] Error: ${JSON.stringify(error, null, 2)}`);
            return 'Error in LLM request'
        }
    }
}