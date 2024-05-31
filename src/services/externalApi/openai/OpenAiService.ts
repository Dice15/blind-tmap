import OpenAI from "openai";


export default class OpenAiService {
    private constructor() { }


    public static getApiKey(): string {
        return process.env.OPENAI_API_KEY;
    }


    public static getClient(): OpenAI {
        return new OpenAI({ apiKey: this.getApiKey() });
    }
}