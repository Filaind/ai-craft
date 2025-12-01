import mineflayer, { type BotOptions } from 'mineflayer'
import { pathfinder } from 'mineflayer-pathfinder';
import { LLMExtension } from './extensions/llm-extension';
import OpenAI from 'openai';

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

        this.mineflayerBot.on('chat', this.onChatMessage.bind(this))

        // Log errors and kick reasons:
        this.mineflayerBot.on('kicked', console.log)
        this.mineflayerBot.on('error', console.log)
    }


    async onChatMessage(username: string, message: string) {
        console.log('onChatMessage', username, message);

        //Игнорируем сообщения от бота
        if (username === this.mineflayerBot!.username) return

        const response = await this.llm.getResponse(message)

        this.mineflayerBot!.chat(response)

    }
}