"use client"

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { useSwipeable } from "react-swipeable";
import 'swiper/css';
import styled from "styled-components";
import { PathFinderStep } from "./PathFinder";
import { SpeechOutputProvider } from "@/core/modules/speech/SpeechProviders";
import { VibrationProvider } from "@/core/modules/vibration/VibrationProvider";


interface LocationConfirmProps {
    locations: {
        start: string;
        destination: string;
    } | null;
    setStep: React.Dispatch<React.SetStateAction<PathFinderStep>>;
}


export default function LocationConfirm({ locations, setStep }: LocationConfirmProps) {
    // hook
    const router = useRouter();


    // ref
    const LocationInfoContainerRef = useRef<HTMLDivElement>(null);
    const focusBlank = useRef<HTMLDivElement>(null);


    // handler
    const handleGoBack = useCallback(() => {
        SpeechOutputProvider.speak(" ").then(() => {
            router.replace('/chatbot');
        });
    }, [router]);


    const handleGoNext = useCallback(() => {
        SpeechOutputProvider.speak(" ").then(() => {
            setStep("selectStart");
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


    const handleTouch = useCallback(() => {
        if (locations) {
            SpeechOutputProvider.speak(`출발지 ${locations?.start || ""}, 도착지 ${locations?.destination || ""}로 경로 탐색을 시작하려면 왼쪽으로 스와이프 하세요.`);
        }
    }, [locations]);


    // effect
    useEffect(() => {
        VibrationProvider.vibrate(500);
    }, []);


    useEffect(() => {
        handleTouch();
    }, [handleTouch]);


    // render
    return (
        <Wrapper {...handleHorizontalSwipe}>
            <LocationInfoContainer ref={LocationInfoContainerRef}>
                <LocationInfo onClick={handleTouch}>
                    {locations && <>
                        <LocationName>
                            {`출발지: ${locations?.start || ""}`}
                        </LocationName>
                        <LocationName>
                            {`도착지: ${locations?.destination || ""}`}
                        </LocationName>
                    </>}
                </LocationInfo>
            </LocationInfoContainer>
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

const LocationInfoContainer = styled.div`
    height: 92.5%;
    width: 85%;
    border: 0.7vw solid var(--main-border-color);
    border-radius: 4vw;
    color: var(--main-font-color);
`;

const LocationInfo = styled.div`
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
`;

const LocationName = styled.h3`
    margin-bottom: 8vw;
    text-align: center;
    font-size: 6vw;
    font-weight: bold;
    cursor: pointer;
    user-select: none;
`;