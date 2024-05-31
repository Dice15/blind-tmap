import axios from "axios";

type GetGptMessageResponse = {
    msg: string;
    data: {
        message: string;
        chatMode: "chat" | "blindroute";
    }
};

export async function getGptMessage(userMessage: string, chatMode: "chat" | "blindroute"): Promise<{
    msg: string;
    data: {
        message: string;
        chatMode: "chat" | "blindroute";
    }
}> {
    try {
        const response = await axios.post<GetGptMessageResponse>(
            '/api/chat/getGptMessage',
            {
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