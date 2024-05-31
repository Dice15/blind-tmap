import { IGetStaionByRouteResponse } from '@/types/externalApi/datakr/IGetStaionByRouteResponse';
import axios, { AxiosResponse } from 'axios';
import DataKoreaService from './DataKoreaService';


export class StaionByRouteService {
    private constructor() { }


    public static async getStaionByRoute(busRouteId: string): Promise<IGetStaionByRouteResponse | null> {
        return this.getStaionByRouteByDataKr(busRouteId)
            .then((response) => {
                return response.data;
            })
            .catch((error) => {
                console.error(error);
                return null;
            });
    }


    private static getStaionByRouteByDataKr(busRouteId: string): Promise<AxiosResponse<IGetStaionByRouteResponse, any>> {
        return axios.get<IGetStaionByRouteResponse>(
            "http://ws.bus.go.kr/api/rest/busRouteInfo/getStaionByRoute", {
            params: {
                serviceKey: decodeURIComponent(DataKoreaService.getServiceKey()),
                busRouteId: busRouteId,
                resultType: "json"
            }
        });
    }
}