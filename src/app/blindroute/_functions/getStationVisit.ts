import { IForwarding } from "@/models/IForwarding";
import { IStationVisit } from "@/models/IStationVisit";
import axios from "axios";


type GetStationVisitResponse = {
    msg: string;
    data: {
        stationVisit: IStationVisit;
    };
};


export async function getStationVisit(forwarding: IForwarding, busVehId: string): Promise<{
    msg: string;
    data: {
        stationVisit: IStationVisit;
    };
}> {
    try {
        const response = await axios.get<GetStationVisitResponse>('/api/bus/getStationVisit', {
            params: {
                busRouteId: forwarding.busRouteId,
                busVehId: busVehId,
                fromStationSeq: forwarding.fromStationSeq,
                toStationSeq: forwarding.toStationSeq
            },
        });

        return response.data;
    }
    catch (error) {
        console.error(error);
        return {
            msg: "API 요청 중 오류가 발생했습니다.",
            data: {
                stationVisit: {
                    stationVisMsg: "운행종료",
                    stationOrd: "",
                }
            }
        };
    }
}