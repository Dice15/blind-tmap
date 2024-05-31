export class GptAssistantService {
    private constructor() { }


    public static getGptAssistantId(): string {
        return process.env.BLINDROUTE_ASSISTANT_V2;
    }
}