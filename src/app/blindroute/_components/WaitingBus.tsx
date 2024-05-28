"use client"

import { useCallback, useEffect, useRef, useState } from "react";
import { useSwipeable } from "react-swipeable";
import 'swiper/css';
import styled from "styled-components";
import { PathFinderStep } from "./PathFinder";
import { SpeechOutputProvider } from "@/core/modules/speech/SpeechProviders";
import { IForwarding } from "@/core/type/IForwarding";
import { IBusArrival } from "@/core/type/IBusArrival";
import { getBusArrival } from "../_functions/getBusArrival";
import LoadingAnimation from "@/app/_components/LoadingAnimation";
import { VibrationProvider } from "@/core/modules/vibration/VibrationProvider";


interface WaitingBusProps {
    setStep: React.Dispatch<React.SetStateAction<PathFinderStep>>;
    forwarding: IForwarding | null;
    setOnBoardVehId: React.Dispatch<React.SetStateAction<string | null>>
}


export default function WaitingBus({ setStep, forwarding, setOnBoardVehId }: WaitingBusProps) {
    // ref
    const WaitingBusInfoContainerRef = useRef<HTMLDivElement>(null);
    const focusBlank = useRef<HTMLDivElement>(null);
    const intervalIdRef = useRef<NodeJS.Timeout | null>(null);


    // state
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [busArrival, setBusArrival] = useState<IBusArrival | null>(null);


    // handler
    const handleGoBack = useCallback(() => {
        if (intervalIdRef.current !== null) {
            clearInterval(intervalIdRef.current);
        }

        SpeechOutputProvider.speak("버스 예약을 취소하였습니다.").then(() => {
            setStep("reservationBusConfirm");
        });

    }, [setStep]);


    const handleGoNext = useCallback(() => {
        if (intervalIdRef.current !== null) {
            clearInterval(intervalIdRef.current);
        }

        if (busArrival) {
            VibrationProvider.vibrate(8000);
            setTimeout(() => {
                setOnBoardVehId(busArrival.busVehId1);
                setStep("reservationDesConfirm");
            }, 8000);
            SpeechOutputProvider.speak("버스가 도착했습니다.");
        }

    }, [setStep, setOnBoardVehId, busArrival]);


    const handleHorizontalSwipe = useSwipeable({
        onSwipedLeft: useCallback(() => {
            handleGoNext();
        }, [handleGoNext]),
        onSwipedRight: useCallback(() => {
            handleGoBack()
        }, [handleGoBack]),
        trackMouse: true
    });


    const handleSpeak = useCallback((init: boolean, forwarding: IForwarding, busArrival: IBusArrival) => {
        const text = `
            ${forwarding.busRouteNm} 버스를 대기중입니다.  
            ${busArrival.busArrMsg1}.
            ${busArrival.busArrMsg2}.
            ${init ? "오른쪽으로 스와이프하면 버스 대기 예약을 취소합니다." : ""}     
        `;
        return SpeechOutputProvider.speak(text);
    }, []);


    const handleTouch = useCallback(() => {
        if (forwarding && busArrival) {
            handleSpeak(false, forwarding, busArrival);
        }
    }, [forwarding, busArrival, handleSpeak]);


    const handleCheckBusArrival = useCallback(async () => {
        if (!forwarding) return;
        getBusArrival(forwarding).then((newBusArrival) => {
            if (busArrival && busArrival.busVehId1 !== '' && newBusArrival.data.busArrival.busVehId1 !== busArrival.busVehId1) {
                handleGoNext();
            }
            else {
                setBusArrival(newBusArrival.data.busArrival);
            }
        });
    }, [forwarding, busArrival, handleGoNext]);


    // effect
    useEffect(() => {
        VibrationProvider.vibrate(500);
    }, []);


    useEffect(() => {
        if (isLoading && forwarding && busArrival) {
            setIsLoading(false);
            handleSpeak(true, forwarding, busArrival);
        }
    }, [forwarding, isLoading, busArrival, handleSpeak])


    useEffect(() => {
        if (intervalIdRef.current !== null) {
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
        }

        if (isLoading) {
            handleCheckBusArrival();
        }
        intervalIdRef.current = setInterval(handleCheckBusArrival, 15000);

        return () => {
            if (intervalIdRef.current !== null) {
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
            }
        }
    }, [isLoading, handleCheckBusArrival])


    // render
    return (
        <Wrapper {...handleHorizontalSwipe}>
            <LoadingAnimation active={isLoading} />
            <WaitingBusInfoContainer ref={WaitingBusInfoContainerRef}>
                <WaitingBusInfo onClick={handleTouch}>
                    {(busArrival && forwarding) &&
                        <BusName>
                            {forwarding.busRouteNm}
                        </BusName>
                    }
                    {busArrival &&
                        <BusArrMsg>
                            {busArrival.busArrMsg1}
                        </BusArrMsg>
                    }
                </WaitingBusInfo>
            </WaitingBusInfoContainer>
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

const WaitingBusInfoContainer = styled.div`
    height: 90%;
    width: 85%;
    border: 1px solid var(--main-border-color);
    border-radius: 8px;
    background-color: var(--main-color);
    color: var(--main-font-color);
`;

const WaitingBusInfo = styled.div`
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
`;

const BusName = styled.h1` 
    text-align: center;
    margin-bottom: 8vw;
    font-size: 7.5vw;
    font-weight: bold;
    cursor: pointer;
    user-select: none;
`;

const BusArrMsg = styled.h3`
    margin-bottom: 5%;
    text-align: center;
    font-size: 5vw;
    font-weight: bold;
    cursor: pointer;
    user-select: none;
`;