import axios from "axios";

type SendMessageResponse = {
    msg: string;
    data: {
        message: string;
        chatMode: "chat" | "blindroute";
    }
};

export async function sendMessage(threadId: string, userMessage: string, chatMode: "chat" | "blindroute"): Promise<{
    msg: string;
    data: {
        message: string;
        chatMode: "chat" | "blindroute";
    }
}> {
    try {
        const response = await axios.post<SendMessageResponse>(
            '/api/chat/sendMessage',
            {
                threadId: threadId,
                userMessage: userMessage,
                chatMode: chatMode
            }
        );
        return response.data;
    }
    catch (error) {
        console.error(error);
        return {
            msg: "API 요청 중 오류가 발생했습니다.",
            data: {
                message: "",
                chatMode: "chat"
            }
        };
    }
}