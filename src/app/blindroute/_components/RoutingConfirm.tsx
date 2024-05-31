"use client"

import { useCallback, useEffect, useRef, useState } from "react";
import { useSwipeable } from "react-swipeable";
import { Swiper, SwiperClass, SwiperSlide } from "swiper/react";
import 'swiper/css';
import styled from "styled-components";
import { PathFinderStep } from "./PathFinder";
import { SpeechOutputProvider } from "@/core/modules/speech/SpeechProviders";
import { IRouting } from "@/models/IRouting";
import LoadingAnimation from "@/app/_components/LoadingAnimation";
import { getRoute } from "../_functions/getRouteByLocation";
import { VibrationProvider } from "@/core/modules/vibration/VibrationProvider";
import { numberToKorean } from "../_functions/numberToKorean";
import IStation from "@/models/IStation";


interface RoutingConfirmProps {
    setStep: React.Dispatch<React.SetStateAction<PathFinderStep>>;
    start: IStation | null;
    destination: IStation | null;
    setRouting: React.Dispatch<React.SetStateAction<IRouting | null>>;
    setForwardIndex: React.Dispatch<React.SetStateAction<number>>
}


export default function RoutingConfirm({ setStep, start, destination, setRouting, setForwardIndex }: RoutingConfirmProps) {
    // ref
    const LocationInfoContainerRef = useRef<HTMLDivElement>(null);
    const focusBlank = useRef<HTMLDivElement>(null);
    const routingInfoIndex = useRef<number>(0);
    const isSliding = useRef<boolean>(false);
    const initSpeak = useRef<boolean>(true);


    // state
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [routings, setRoutings] = useState<IRouting[]>([]);


    // handler
    const handleGoBack = useCallback(() => {
        SpeechOutputProvider.speak(" ").then(() => {
            setStep("locationConfirm");
        });
    }, [setStep]);


    const handleGoNext = useCallback(() => {
        SpeechOutputProvider.speak(" ").then(() => {
            setRouting(routings[routingInfoIndex.current])
            setStep("reservationBusConfirm");
        });
    }, [setStep, setRouting, routings]);


    const handleSpeak = useCallback((init: boolean, index: number, routing: IRouting) => {
        const text = `
            ${init ? "경로를 선택하세요. 위아래 스와이프로 경로를 선택할 수 있습니다." : ""}
            ${numberToKorean(index + 1)} 경로,
            ${routing.forwarding.length}개의 버스를 탑승하며,
            비용은 ${routing.fare}원,
            시간은 ${Math.round(parseFloat(routing.time) / 60)}분이 소요됩니다.
            ${routing.forwarding.map((forwarding, index) => `${numberToKorean(index + 1)} 탑승 정류장: ${forwarding.fromStationNm}`).join(',')}
            왼쪽으로 스와이프하면 이 경로를 선택합니다.
        `;
        return SpeechOutputProvider.speak(text);
    }, []);


    const handleInitSpeak = useCallback((swiper: SwiperClass) => {
        VibrationProvider.vibrate(200);
        handleSpeak(true, swiper.realIndex, routings[swiper.realIndex]).then(() => { initSpeak.current = false });
    }, [routings, handleSpeak]);


    const handleVerticalSwipe = useCallback((swiper: SwiperClass) => {
        VibrationProvider.vibrate(200);
        isSliding.current = true;
        routingInfoIndex.current = swiper.realIndex;
        if (!initSpeak.current) {
            handleSpeak(false, swiper.realIndex, routings[swiper.realIndex]).then(() => { initSpeak.current = false });
        }
        setTimeout(() => isSliding.current = false, 250); // 300ms는 애니메이션 시간에 맞게 조정
    }, [routings, handleSpeak]);


    const handleVerticalSliding = useCallback((swiper: SwiperClass) => {
        initSpeak.current = false;
    }, []);

    const handleHorizontalSwipe = useSwipeable({
        onSwipedLeft: useCallback(() => {
            handleGoNext();
        }, [handleGoNext]),
        onSwipedRight: useCallback(() => {
            handleGoBack()
        }, [handleGoBack]),
        trackMouse: true
    });


    const handleTouchSwipe = useCallback(() => {
        if (routings) {
            handleSpeak(false, routingInfoIndex.current, routings[routingInfoIndex.current]).then(() => { initSpeak.current = false });
        }
    }, [routings, handleSpeak]);


    // effect
    useEffect(() => {
        VibrationProvider.vibrate(500);
    }, []);


    useEffect(() => {
        setRouting(null);
        if (start && destination) {
            getRoute(start, destination).then((response) => {
                if (response.data.routings.length > 0) {
                    setRoutings(response.data.routings);
                    setForwardIndex(0);
                    setIsLoading(false);
                }
                else {
                    SpeechOutputProvider.speak(`검색된 경로가 없습니다`);
                    handleGoBack();
                }
            })
        }
    }, [start, destination, setRouting, handleGoBack, setForwardIndex])


    // render
    return (
        <Wrapper {...handleHorizontalSwipe}>
            <LoadingAnimation active={isLoading} />
            <RoutingInfoContainer ref={LocationInfoContainerRef}>
                {routings.length > 0 &&
                    <Swiper
                        slidesPerView={1}
                        spaceBetween={50}
                        onInit={handleInitSpeak}
                        onSlideChangeTransitionEnd={handleVerticalSwipe}
                        onSliderMove={handleVerticalSliding}
                        speed={300}
                        loop={routings.length > 1 ? true : false}
                        direction="vertical"
                        style={{ height: "100%", width: "100%" }}
                    >
                        {routings.map((routing, index) => (
                            <SwiperSlide key={index} style={{ height: "100%", width: "100%" }}>
                                <RoutingInfo
                                    onClick={handleTouchSwipe}
                                    tabIndex={1}
                                >
                                    <ForwardingInfo>
                                        {`${routing.forwarding.length}개의 버스 탑승`}
                                    </ForwardingInfo>
                                    <CostInfo>
                                        {`${routing.fare}원, ${Math.round(parseFloat(routing.time) / 60)}분`}
                                    </CostInfo>
                                    {routing.forwarding.map((forwarding, index) => (
                                        <StationInfo key={index}>
                                            {`${index + 1}) ${forwarding.fromStationNm}`}
                                        </StationInfo>
                                    ))}
                                </RoutingInfo>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                }
            </RoutingInfoContainer>
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

const RoutingInfoContainer = styled.div`
    height: 92.5%;
    width: 85%;
    border: 0.7vw solid var(--main-border-color);
    border-radius: 4vw;
    color: var(--main-font-color);
`;

const RoutingInfo = styled.div`
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
`;

const ForwardingInfo = styled.h1` 
    text-align: center;
    margin-bottom: 8vw;
    font-size: 7.5vw;
    font-weight: bold;
    cursor: pointer;
    user-select: none;
`;

const CostInfo = styled.h3`
    margin-bottom: 8vw;
    text-align: center;
    font-size: 5vw;
    font-weight: bold;
    cursor: pointer;
    user-select: none;
`;

const StationInfo = styled.h3`
    margin-bottom: 2vw;
    text-align: center;
    font-size: 5vw;
    font-weight: bold;
    cursor: pointer;
    user-select: none;
`;