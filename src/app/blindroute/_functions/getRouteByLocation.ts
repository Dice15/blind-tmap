import { IRouting } from "@/core/type/IRouting";
import { Station } from "@/core/type/Station";
import axios from "axios";


type GetRouteResponse = {
    msg: string;
    data: {
        routings: IRouting[];
    }
};


export async function getRoute(start: Station, destination: Station): Promise<{
    msg: string;
    data: {
        routings: IRouting[];
    }
}> {
    try {
        const response = await axios.get<GetRouteResponse>('/api/route/getRouteByLocation', {
            params: {
                startX: start.tmX,
                startY: start.tmY,
                destinationX: destination.tmX,
                destinationY: destination.tmY,
            },
        });

        return response.data;
    }
    catch (error) {
        console.error(error);
        return {
            msg: "API 요청 중 오류가 발생했습니다.",
            data: {
                routings: []
            }
        }
    };
}