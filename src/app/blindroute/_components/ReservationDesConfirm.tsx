"use client"

import { useCallback, useEffect, useRef } from "react";
import { useSwipeable } from "react-swipeable";
import 'swiper/css';
import styled from "styled-components";
import { PathFinderStep } from "./PathFinder";
import { SpeechOutputProvider } from "@/core/modules/speech/SpeechProviders";
import { IForwarding } from "@/core/type/IForwarding";
import { VibrationProvider } from "@/core/modules/vibration/VibrationProvider";


interface ReservationDesConfirmProps {
    setStep: React.Dispatch<React.SetStateAction<PathFinderStep>>;
    forwarding: IForwarding | null;
}


export default function ReservationDesConfirm({ setStep, forwarding }: ReservationDesConfirmProps) {
    // ref
    const ReservationInfoContainerRef = useRef<HTMLDivElement>(null);
    const focusBlank = useRef<HTMLDivElement>(null);


    // handler
    const handleGoBack = useCallback(() => {
        SpeechOutputProvider.speak(" ").then(() => {
            setStep("reservationBusConfirm");
        });
    }, [setStep]);


    const handleGoNext = useCallback(() => {
        SpeechOutputProvider.speak(" ").then(() => {
            setStep("waitingDestination");
        });
    }, [setStep]);


    const handleHorizontalSwipe = useSwipeable({
        onSwipedLeft: useCallback(() => {
            handleGoNext();
        }, [handleGoNext]),
        onSwipedRight: useCallback(() => {
            handleGoBack()
        }, [handleGoBack]),
        trackMouse: true
    });


    const handleSpeak = useCallback((forwarding: IForwarding) => {
        const text = `
            ${forwarding.busRouteNm} 버스를 탑승하셨으면,
            왼쪽으로 스와이프하여
            ${forwarding.toStationNm} 정류장 하차 예약을 하세요.
        `;
        return SpeechOutputProvider.speak(text);
    }, []);


    const handleTouch = useCallback(() => {
        if (forwarding) {
            handleSpeak(forwarding);
        }
    }, [forwarding, handleSpeak]);


    // effect
    useEffect(() => {
        VibrationProvider.vibrate(500);
    }, []);


    useEffect(() => {
        handleTouch();
    }, [handleTouch])


    // render
    return (
        <Wrapper {...handleHorizontalSwipe}>
            <ReservationInfoContainer ref={ReservationInfoContainerRef}>
                <ReservationInfo onClick={handleTouch}>
                    {forwarding && <>
                        <StationInfo>
                            {`하차: ${forwarding.toStationNm}`}
                        </StationInfo>
                        <BusInfo>
                            {`${forwarding.busRouteNm}, ${forwarding.busRouteDir} 방면`}
                        </BusInfo>
                    </>}
                </ReservationInfo>
            </ReservationInfoContainer>
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

const ReservationInfoContainer = styled.div`
    height: 92.5%;
    width: 85%;
    border: 0.7vw solid var(--main-border-color);
    border-radius: 4vw;
    color: var(--main-font-color);
`;

const ReservationInfo = styled.div`
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
`;

const StationInfo = styled.h1` 
    text-align: center;
    margin-bottom: 8vw;
    font-size: 7.5vw;
    font-weight: bold;
    cursor: pointer;
    user-select: none;
`;

const BusInfo = styled.h3`
    margin-bottom: 5%;
    text-align: center;
    font-size: 5vw;
    font-weight: bold;
    cursor: pointer;
    user-select: none;
`;