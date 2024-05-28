import axios from "axios";

type LoadChatResponse = {
    msg: string;
    data: { threadId: string; };
};

export async function loadChat(): Promise<{
    msg: string;
    data: { threadId: string; }
}> {
    try {
        const response = await axios.get<LoadChatResponse>('/api/chat/loadChat');
        return response.data;
    }
    catch (error) {
        console.error(error);
        return {
            msg: "API 요청 중 오류가 발생했습니다.",
            data: { threadId: "" }
        };
    }
}