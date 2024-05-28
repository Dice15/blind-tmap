"use client"

import styled from "styled-components";
import Image from 'next/image';
import { useState, useCallback, useEffect } from 'react';
import { SpeechInputProvider, SpeechOutputProvider } from "@/core/modules/speech/SpeechProviders";
import LoadingAnimation from "@/app/_components/LoadingAnimation";
import { loadChat } from "../_functions/loadChat";
import { sendMessage } from "../_functions/sendMessage";
import { useRouter } from "next/navigation";


export default function ChatAdot() {
    // hook
    const router = useRouter();


    // state
    const [threadId, setThreadId] = useState<string | null>(null);
    const [chatMode, setChatMode] = useState<"chat" | "blindroute">("chat");
    const [userMessage, setUserMessage] = useState<string | null>(null);
    const [gptMessage, setGptMessage] = useState<string | null>(null);


    // handler
    const handleNavigation = useCallback((start: string, destination: string) => {
        const params = new URLSearchParams({
            start: start,
            destination: destination,
        });
        router.push(`/blindroute?${params.toString()}`);
    }, [router]);


    const handleSendMessage = useCallback((message: string) => {
        if (!threadId) return;
        switch (chatMode) {
            case "chat": {
                sendMessage(threadId, message, chatMode).then(async (value) => {
                    if (value.data.chatMode === "blindroute") {
                        setGptMessage("시각장애인 전용 길안내를 시작하겠습니다. 출발지와 목적지를 말해주세요.");
                        setChatMode("blindroute");
                    }
                    else {
                        setGptMessage(value.data.message);
                    }
                });
                break;
            }
            case "blindroute": {
                sendMessage(threadId, message, chatMode).then(async (value) => {
                    const route = value.data.message.split(',');
                    if (route.length === 2) {
                        handleNavigation(route[0], route[1]);
                        // SpeechOutputProvider.speak(`출발지 ${route[0]}와 목적지 ${route[1]}가 입력되었습니다. 상세 목적지를 검색하겠습니다.`).then(() => {
                        //     setTimeout(() => {
                        //         handleNavigation(route[0], route[1])
                        //     }, 500);
                        // });
                    }
                    else {
                        setGptMessage("출발지와 도착지를 다시 말해주세요.");
                    }
                });
                break;
            }
        }
    }, [threadId, chatMode, handleNavigation]);


    const handleSubmitText = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            setUserMessage(event.currentTarget.value);
            setGptMessage("");
            handleSendMessage(event.currentTarget.value);
            event.currentTarget.value = "";
            event.preventDefault();
        }
    }, [handleSendMessage]);


    const handleSubmitSpeak = useCallback(() => {
        SpeechOutputProvider.stopSpeak();
        SpeechInputProvider.startRecognition((result: string) => {
            const maxLength = 30;
            const inputText = Array.from(result).slice(0, maxLength).join('');
            setUserMessage(inputText);
            setGptMessage("");
            handleSendMessage(inputText);
            if (inputText.length === maxLength) SpeechInputProvider.stopRecognition();
        });
    }, [handleSendMessage]);


    // effect
    useEffect(() => {
        SpeechOutputProvider.speak("")
            .then(() => {
                loadChat().then(value => {
                    setThreadId(value.data.threadId);
                });
            })
            .then(() => {
                setGptMessage("안녕하세요! 무엇을 도와드릴까요?");
            });
    }, []);


    useEffect(() => {
        if (gptMessage) {
            SpeechOutputProvider.speak(gptMessage);
        }
    }, [gptMessage])


    // render
    return (!threadId ? <LoadingAnimation active={!threadId} /> :
        <Wrapper>
            < BackImage >
                <Image src="/images/chat_adot_background.png" alt="guide01" fill priority />
            </BackImage >

            <UserMessage>{userMessage || ""}</UserMessage>
            <ReturnMessage>{gptMessage || ""}</ReturnMessage>

            <MessageInputField>
                <TextInputField>
                    <input
                        type="text"
                        placeholder="메시지를 입력하세요..."
                        onKeyDown={handleSubmitText}
                        style={{ width: '100%', height: '100%', fontSize: "1.3em" }}
                    />
                </TextInputField>
                <SpeakInputField
                    onClick={handleSubmitSpeak}>
                </SpeakInputField>
            </MessageInputField>
        </Wrapper >
    );
}

const Wrapper = styled.div`
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
`;

const BackImage = styled.div`
    position: fixed;
    width: 100%;
    height: 100%;
    z-index: 100;
`;

const UserMessage = styled.p`
    position: fixed;
    top: 25%;
    width: calc(100% - 14%);
    margin: 2% 7%;
    z-index: 101;
    font-size: 1.3em;
    font-weight: bold;
    color: #666e7e;
    white-space: normal; 
    overflow-wrap: break-word;
`;

const ReturnMessage = styled.p`
    position: fixed;
    top: 35%;
    width: calc(100% - 14% - 3%);
    margin: 2% 7%;
    padding-left: 3%;
    border-left: 0.2em solid #666e7e;
    z-index: 101;
    font-size: 1.3em;
    font-weight: bold;
    color: #666e7e;
    white-space: normal;
    overflow-wrap: break-word;
`;


const MessageInputField = styled.div`
    position: fixed;
    top: 82%;
    height: 6.5%;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 101;
`;

const TextInputField = styled.div`
    margin-left: 10%;
    height: 100%;
    width: 65%;
    padding: 0;
    z-index: 101;
`;

const SpeakInputField = styled.div`
    height: 100%;
    width: 10%;
    z-index: 101;
`;