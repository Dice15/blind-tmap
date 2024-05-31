"use client"

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import SelectStart from "./SelectStart";
import { useRouter, useSearchParams } from "next/navigation";
import LocationConfirm from "./LocationConfirm";
import SelectDestination from "./SelectDestination";
import { IRouting } from "@/models/IRouting";
import RoutingConfirm from "./RoutingConfirm";
import ReservationBusConfirm from "./ReservationBusConfirm";
import WaitingBus from "./WaitingBus";
import ReservationDesConfirm from "./ReservationDesConfirm";
import WaitingDestination from "./WaitingDestination";
import { SpeechOutputProvider } from "@/core/modules/speech/SpeechProviders";
import IStation from "@/models/IStation";


export type PathFinderStep = "locationConfirm" | "selectStart" | "selectDestination" | "routingConfirm" | "reservationBusConfirm" | "waitingBus" | "reservationDesConfirm" | "waitingDestination";


function stepTitle(step: PathFinderStep): string {
    switch (step) {
        case "locationConfirm": return "출발지 및 도착지 확인";
        case "selectStart": return "출발지 선택";
        case "selectDestination": return "도착지 선택";
        case "routingConfirm": return "경로 선택";
        case "reservationBusConfirm": return "버스 예약";
        case "waitingBus": return "버스 대기";
        case "reservationDesConfirm": return "하차 예약";
        case "waitingDestination": return "하차 대기";
        default: return "알 수 없는 단계";
    }
}


export default function PathFinder() {
    // hook
    const searchParams = useSearchParams();
    const router = useRouter();


    // state
    const [step, setStep] = useState<PathFinderStep>("locationConfirm");
    const [locations, setLocations] = useState<{ start: string; destination: string; } | null>(null);
    const [start, setStart] = useState<IStation | null>(null);
    const [destination, setDestination] = useState<IStation | null>(null);
    const [routing, setRouting] = useState<IRouting | null>(null);
    const [forwardIndex, setForwardIndex] = useState<number>(0);
    const [onBoardVehId, setOnBoardVehId] = useState<string | null>(null);


    // handler
    const getControllerForm = useCallback(() => {
        switch (step) {
            case "locationConfirm": {
                return <LocationConfirm
                    locations={locations}
                    setStep={setStep}
                />;
            }
            case "selectStart": {
                return <SelectStart
                    locations={locations}
                    setStep={setStep}
                    setStart={setStart}
                />;
            }
            case "selectDestination": {
                return <SelectDestination
                    locations={locations}
                    setStep={setStep}
                    setDestination={setDestination}
                />;
            }
            case "routingConfirm": {
                return <RoutingConfirm
                    setStep={setStep}
                    start={start}
                    destination={destination}
                    setRouting={setRouting}
                    setForwardIndex={setForwardIndex}
                />;
            }
            case "reservationBusConfirm": {
                return <ReservationBusConfirm
                    setStep={setStep}
                    forwarding={routing ? routing.forwarding[forwardIndex] : null}
                />
            }
            case "waitingBus": {
                return <WaitingBus
                    setStep={setStep}
                    forwarding={routing ? routing.forwarding[forwardIndex] : null}
                    setOnBoardVehId={setOnBoardVehId}
                />
            }
            case "reservationDesConfirm": {
                return <ReservationDesConfirm
                    setStep={setStep}
                    forwarding={routing ? routing.forwarding[forwardIndex] : null}
                />
            }
            case "waitingDestination": {
                return <WaitingDestination
                    setStep={setStep}
                    forwarding={routing ? routing.forwarding[forwardIndex] : null}
                    setForwardIndex={setForwardIndex}
                    onBoardVehId={onBoardVehId}
                    lastForwarding={(routing?.forwarding.length || 1) - 1 === forwardIndex}
                />
            }
            default: {
                return <></>;
            }
        }
    }, [locations, step, start, destination, routing, forwardIndex, onBoardVehId]);


    // effect
    useEffect(() => {
        if (searchParams) {
            const locationParam = {
                start: searchParams.get('start') ?? "",
                destination: searchParams.get('destination') ?? ""
            }
            if (locationParam.start === "" || locationParam.destination === "") {
                SpeechOutputProvider.speak("잘못된 접근입니다. 챗봇으로 돌가압니다.");
                router.replace('/chatbot');
            }
            else {
                setLocations(locationParam);
            }
        }
    }, [searchParams, router]);


    // render
    return (
        <Wrapper>
            <Title tabIndex={10}>
                {stepTitle(step)}
            </Title>
            <Contents>
                {getControllerForm()}
            </Contents>
        </Wrapper>
    );
}

const Wrapper = styled.div`
    height: 100%;
    width: 100%;
    background-color: var(--main-color);
`;

const Title = styled.div`
    height: 10vw;
    border-bottom: 0.25vw dashed var(--main-border-color);
    padding: 10px;
    font-size: 7vw;
    font-weight: bold;
    text-align: center;
    cursor: pointer;
    user-select: none;    
`;

const Contents = styled.div`
    height: calc(100% - 65px);
    width: 100%;
`;