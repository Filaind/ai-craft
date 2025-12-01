import mineflayer, { type BotOptions } from 'mineflayer'
import { pathfinder } from 'mineflayer-pathfinder';
import * as pvp from 'mineflayer-pvp';
import { LLMExtension } from './extensions/llm-extension';
import OpenAI from 'openai';
import fs from 'fs';
import type { Entity } from 'prismarine-entity';
import * as collectblockPlugin from 'mineflayer-collectblock'

export class Bot {
    public mineflayerBot?: mineflayer.Bot;
    private llm: LLMExtension;

    private static BOT_DATA_PATH: string = 'bots-data';


    constructor(options: BotOptions, llmClient: OpenAI) {
        this.llm = new LLMExtension(this, llmClient);
        this.start(options)
    }

    async start(options: BotOptions) {

        this.mineflayerBot = mineflayer.createBot({
            ...options,
        })

        this.mineflayerBot.loadPlugin(pathfinder)
        this.mineflayerBot.loadPlugin(pvp.plugin)
        this.mineflayerBot.loadPlugin(collectblockPlugin.plugin)
        
        this.mineflayerBot.on('spawn', this.onSpawn.bind(this))
        this.mineflayerBot.on('chat', this.onChatMessage.bind(this))

        // Log errors and kick reasons:
        this.mineflayerBot.on('kicked', console.log)
        this.mineflayerBot.on('error', console.log)

        //@ts-ignore
        this.mineflayerBot.on('stoppedAttacking', this.onStoppedAttacking.bind(this))
    }

    getBotDataPath() {
        return `${Bot.BOT_DATA_PATH}/${this.mineflayerBot!.username}`;
    }

    async onSpawn() {
        fs.mkdirSync(this.getBotDataPath(), { recursive: true });

        console.log("Bot spawned", this.mineflayerBot!.username);
        const entity = this.mineflayerBot!.nearestEntity()
        if (entity) {
            console.log("Nearest entity", entity.name);
        }
    }


    async onChatMessage(username: string, message: string) {
        console.log('onChatMessage', username, message);

        //Игнорируем сообщения от бота
        if (username === this.mineflayerBot!.username || message.startsWith('%')) return

        const response = await this.llm.getResponse(`User ${username} said: ${message}`)

        this.mineflayerBot!.chat("%" + response)

    }


    async onStoppedAttacking(entity: any) {
        const response = await this.llm.getResponse("End attacking")
        this.mineflayerBot!.chat("%" + response)
    }
}