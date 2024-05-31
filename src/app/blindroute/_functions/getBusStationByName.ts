import IStation from "@/models/IStation";
import axios from "axios";


type GetBusStationResponse = {
    msg: string;
    data: {
        stations: IStation[];
    };
};


export async function getBusStation(stationName: string): Promise<{
    msg: string;
    data: {
        stations: IStation[];
    };
}> {
    try {
        const response = await axios.get<GetBusStationResponse>('/api/station/getBusStationByName', {
            params: { stationName },
        });

        return response.data;
    }
    catch (error) {
        console.error(error);
        return {
            msg: "API 요청 중 오류가 발생했습니다.",
            data: { stations: [] }
        };
    }
}