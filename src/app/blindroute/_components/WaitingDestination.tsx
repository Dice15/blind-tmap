"use client"

import { useCallback, useEffect, useRef, useState } from "react";
import { useSwipeable } from "react-swipeable";
import 'swiper/css';
import styled from "styled-components";
import { PathFinderStep } from "./PathFinder";
import { SpeechOutputProvider } from "@/core/modules/speech/SpeechProviders";
import { IForwarding } from "@/core/type/IForwarding";
import LoadingAnimation from "@/app/_components/LoadingAnimation";
import { IStationVisit } from "@/core/type/IStationVisit";
import { getStationVisit } from "../_functions/getStationVisit";
import { useRouter } from "next/navigation";


interface WaitingDesProps {
    setStep: React.Dispatch<React.SetStateAction<PathFinderStep>>;
    forwarding: IForwarding | null;
    setForwardIndex: React.Dispatch<React.SetStateAction<number>>;
    onBoardVehId: string | null;
    lastForwarding: boolean;
}


export default function WaitingDestination({ setStep, forwarding, setForwardIndex, onBoardVehId, lastForwarding }: WaitingDesProps) {
    // hook
    const router = useRouter();


    // ref
    const WaitingDesInfoContainerRef = useRef<HTMLDivElement>(null);
    const focusBlank = useRef<HTMLDivElement>(null);
    const intervalIdRef = useRef<NodeJS.Timeout | null>(null);


    // state
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [stationVisit, setStationVisit] = useState<IStationVisit | null>(null);


    // handler
    const handleGoBack = useCallback(() => {
        if (intervalIdRef.current !== null) {
            clearInterval(intervalIdRef.current);
        }

        SpeechOutputProvider.speak("정류장 하차을 취소하였습니다.").then(() => {
            setStep("reservationDesConfirm");
        });

    }, [setStep]);


    const handleGoNext = useCallback(() => {
        if (intervalIdRef.current !== null) {
            clearInterval(intervalIdRef.current);
        }

        if (lastForwarding) {
            SpeechOutputProvider.speak('정류장에 도착했습니다.')
                .then(async () => { await await SpeechOutputProvider.speak(`최종 목적지 ${forwarding?.toStationNm}에 도착했습니다.`) })
                .then(async () => { await SpeechOutputProvider.speak("경로 탐색을 종료하고 챗봇으로 돌아갑니다.") })
                .then(() => { router.replace('/chatbot') });
        }
        else {
            SpeechOutputProvider.speak("정류장에 도착했습니다.").then(() => {
                setForwardIndex(prev => prev + 1);
                setStep("reservationBusConfirm");
            });
        }

    }, [setStep, forwarding, setForwardIndex, lastForwarding, router]);


    const handleHorizontalSwipe = useSwipeable({
        onSwipedLeft: useCallback(() => {
            handleGoNext();
        }, [handleGoNext]),
        onSwipedRight: useCallback(() => {
            handleGoBack()
        }, [handleGoBack]),
        trackMouse: true
    });


    const handleSpeak = useCallback((init: boolean, forwarding: IForwarding, stationVisit: IStationVisit) => {
        const text = `
            ${forwarding.toStationNm} 로 이동 중 입니다.
            ${stationVisit.stationVisMsg}.
            ${init ? "오른쪽으로 스와이프하면 정류장 하차 예약을 취소합니다." : ""}     
        `;
        return SpeechOutputProvider.speak(text);
    }, []);


    const handleTouch = useCallback(() => {
        if (forwarding && stationVisit) {
            handleSpeak(false, forwarding, stationVisit);
        }
    }, [forwarding, stationVisit, handleSpeak]);


    const handleCheckStationVisit = useCallback(async () => {
        if (!forwarding || !onBoardVehId) return;
        getStationVisit(forwarding, onBoardVehId).then((newStationVisit) => {
            if (newStationVisit.data.stationVisit.stationVisMsg === "목적지에 도착했습니다.") {
                handleGoNext();
            } else {
                setStationVisit(newStationVisit.data.stationVisit);
            }
        });
    }, [forwarding, handleGoNext, onBoardVehId]);


    // effect
    useEffect(() => {
        if (isLoading && forwarding && stationVisit) {
            setIsLoading(false);
            handleSpeak(false, forwarding, stationVisit);
        }
    }, [forwarding, isLoading, stationVisit, handleSpeak]);


    useEffect(() => {
        if (intervalIdRef.current !== null) {
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
        }

        if (isLoading) {
            handleCheckStationVisit();
        }
        intervalIdRef.current = setInterval(handleCheckStationVisit, 15000);

        return () => {
            if (intervalIdRef.current !== null) {
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
            }
        }
    }, [isLoading, handleCheckStationVisit])


    // render
    return (
        <Wrapper {...handleHorizontalSwipe}>
            <LoadingAnimation active={isLoading} />
            <WaitingDesInfoContainer ref={WaitingDesInfoContainerRef}>
                <WaitingDesInfo onClick={handleTouch}>
                    {forwarding &&
                        <StationName>
                            {forwarding.toStationNm}
                        </StationName>
                    }
                    {stationVisit &&
                        <StaitonVisMsg>
                            {stationVisit.stationVisMsg}
                        </StaitonVisMsg>
                    }
                </WaitingDesInfo>
            </WaitingDesInfoContainer>
            <FocusBlank ref={focusBlank} tabIndex={0} />
        </Wrapper >
    );
}


const Wrapper = styled.div`
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
`;

const FocusBlank = styled.div`
    height:0px;
    width: 85%;
`;

const WaitingDesInfoContainer = styled.div`
    height: 90%;
    width: 85%;
    border: 1px solid var(--main-border-color);
    border-radius: 8px;
    background-color: var(--main-color);
    color: var(--main-font-color);
`;

const WaitingDesInfo = styled.div`
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
`;

const StationName = styled.h1` 
    text-align: center;
    margin-bottom: 8vw;
    font-size: 6.5vw;
    font-weight: bold;
    cursor: pointer;
    user-select: none;
`;

const StaitonVisMsg = styled.h3`
    margin-bottom: 5%;
    text-align: center;
    font-size: 4vw;
    font-weight: bold;
    cursor: pointer;
    user-select: none;
`;