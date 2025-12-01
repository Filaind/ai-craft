import mineflayer, { type BotOptions } from 'mineflayer'
import { pathfinder } from 'mineflayer-pathfinder';
import { LLMExtension } from './extensions/llm-extension';
import OpenAI from 'openai';

export class BaseBotExtension {
    protected bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }
}

export class Bot {
    private mineflayerBot?: mineflayer.Bot;
    private llm: LLMExtension;

    constructor(options: BotOptions, llmClient: OpenAI) {
        this.llm = new LLMExtension(this, llmClient);
        this.start(options)
    }

    async start(options: BotOptions) {

        this.mineflayerBot = mineflayer.createBot({
            ...options,
        })

        this.mineflayerBot.loadPlugin(pathfinder)

        this.mineflayerBot.on('chat', (username: string, message: string) => {
            if (username === this.mineflayerBot!.username) return
            this.mineflayerBot!.chat(message)
        })

        // Log errors and kick reasons:
        this.mineflayerBot.on('kicked', console.log)
        this.mineflayerBot.on('error', console.log)
    }


    async process() {

    }
}