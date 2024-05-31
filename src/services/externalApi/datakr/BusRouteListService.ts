import { IGetBusRouteListResponse } from '@/types/externalApi/datakr/IGetBusRouteListResponse';
import axios, { AxiosResponse } from 'axios';
import DataKoreaService from './DataKoreaService';


export class BusRouteListService {
    private constructor() { }


    public static async getBusRouteList(busRouteNm: string): Promise<IGetBusRouteListResponse | null> {
        return this.getBusRouteListByDataKr(busRouteNm)
            .then((response) => {
                return response.data;
            })
            .catch((error) => {
                console.error(error);
                return null;
            });
    }


    private static getBusRouteListByDataKr(busRouteNm: string): Promise<AxiosResponse<IGetBusRouteListResponse, any>> {
        return axios.get<IGetBusRouteListResponse>(
            "http://ws.bus.go.kr/api/rest/busRouteInfo/getBusRouteList", {
            params: {
                serviceKey: decodeURIComponent(DataKoreaService.getServiceKey()),
                stSrch: busRouteNm,
                resultType: "json"
            }
        });
    }
}