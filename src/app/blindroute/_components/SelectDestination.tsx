"use client"

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSwipeable } from "react-swipeable";
import { Swiper, SwiperClass, SwiperSlide } from "swiper/react";
import 'swiper/css';
import styled from "styled-components";
import { SpeechOutputProvider } from "@/core/modules/speech/SpeechProviders";
import { PathFinderStep } from "./PathFinder";
import { Station } from "@/core/type/Station";
import LoadingAnimation from "@/app/_components/LoadingAnimation";
import { getBusStation } from "../_functions/getBusStationByName";
import { VibrationProvider } from "@/core/modules/vibration/VibrationProvider";


interface SelectDestinationProps {
    locations: {
        start: string;
        destination: string;
    } | null;
    setStep: React.Dispatch<React.SetStateAction<PathFinderStep>>;
    setDestination: React.Dispatch<React.SetStateAction<Station | null>>
}


export default function SelectDestination({ locations, setStep, setDestination }: SelectDestinationProps) {
    // hook
    const router = useRouter();


    // ref
    const stationInfoContainerRef = useRef<HTMLDivElement>(null);
    const stationInfoIndex = useRef<number>(0);
    const isSliding = useRef<boolean>(false);
    const focusBlankRef = useRef<HTMLDivElement>(null);
    const initSpeak = useRef<boolean>(true);


    // state
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [stations, setStations] = useState<Station[]>([]);


    // handler
    const handleGoBack = useCallback(() => {
        setStep("selectStart");
    }, [setStep]);


    const handleGoNext = useCallback(() => {
        setDestination(stations[stationInfoIndex.current]);
        setStep("routingConfirm");
    }, [setDestination, setStep, stations]);


    const handleSpeak = useCallback((init: boolean, station: Station) => {
        const text = `
            ${init ? "도착 정류장을 선택하세요. 위아래 스와이프로 정류장을 선택할 수 있습니다." : ""}
            ${station.stNm}, ${station.stDir} 방면.
            왼쪽으로 스와이프하면 정류장을 선택합니다.
        `;
        return SpeechOutputProvider.speak(text);
    }, []);



    const handleInitSpeak = useCallback((swiper: SwiperClass) => {
        VibrationProvider.vibrate(200);
        handleSpeak(true, stations[swiper.realIndex]).then(() => { initSpeak.current = false });
    }, [stations, handleSpeak]);


    const handleVerticalSwipe = useCallback((swiper: SwiperClass) => {
        VibrationProvider.vibrate(200);
        isSliding.current = true;
        stationInfoIndex.current = swiper.realIndex;
        if (!initSpeak.current) {
            handleSpeak(false, stations[swiper.realIndex]).then(() => { initSpeak.current = false });
        }
        setTimeout(() => isSliding.current = false, 250); // 300ms는 애니메이션 시간에 맞게 조정
    }, [stations, handleSpeak]);


    const handleVerticalSliding = useCallback((swiper: SwiperClass) => {
        initSpeak.current = false;
    }, []);


    const handleHorizontalSwipe = useSwipeable({
        onSwipedLeft: useCallback(() => {
            setTimeout(() => { handleGoNext(); }, 1000)
        }, [handleGoNext]),
        onSwipedRight: useCallback(() => {
            handleGoBack()
        }, [handleGoBack]),
        trackMouse: true
    });


    const handleTouchSwipe = useCallback(() => {
        handleSpeak(false, stations[stationInfoIndex.current]).then(() => { initSpeak.current = false });
    }, [stations, handleSpeak]);


    // effect
    useEffect(() => {
        if (locations && locations.destination !== "") {
            getBusStation(locations.destination).then((value) => {
                if (value.data.stations.length > 0) {
                    setStations(value.data.stations);
                    setIsLoading(false);
                }
                else {
                    SpeechOutputProvider.speak(`검색된 정류장이 없습니다`);
                    handleGoBack();
                }
            })
        }
    }, [locations, handleGoBack]);


    useEffect(() => {
        if (focusBlankRef.current) {
            focusBlankRef.current.focus();
        }
    }, []);


    // render
    return (
        <Wrapper {...handleHorizontalSwipe}>
            <LoadingAnimation active={isLoading} />
            <StationInfoContainer ref={stationInfoContainerRef}>
                {stations.length > 0 &&
                    <Swiper
                        slidesPerView={1}
                        spaceBetween={50}
                        onInit={handleInitSpeak}
                        onSlideChange={handleVerticalSwipe}
                        onSliderMove={handleVerticalSliding}
                        speed={300}
                        loop={stations.length > 1 ? true : false}
                        direction="vertical"
                        style={{ height: "100%", width: "100%" }}
                    >
                        {stations.map((station, index) => (
                            <SwiperSlide key={index} style={{ height: "100%", width: "100%" }}>
                                <StationInfo
                                    onClick={handleTouchSwipe}
                                    tabIndex={1}
                                >
                                    <StationName>{station.stNm}</StationName>
                                    <StationDirection>{`${station.stDir} 방면`}</StationDirection>
                                </StationInfo>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                }
            </StationInfoContainer>
            <FocusBlank ref={focusBlankRef} tabIndex={0} />
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


const StationInfoContainer = styled.div`
    height: 90%;
    width: 85%;
    border: 1px solid var(--main-border-color);
    border-radius: 8px;
    background-color: var(--main-color);
    color: var(--main-font-color);
`;


const StationInfo = styled.div`
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


const StationDirection = styled.h3`
    text-align: center;
    font-size: 4vw;
    font-weight: bold;
    cursor: pointer;
    user-select: none;
`;