import { IGetStationByUidItemResponse } from '@/types/externalApi/datakr/IGetStationByUidItemResponse';
import axios, { AxiosResponse } from 'axios';
import DataKoreaService from './DataKoreaService';


export class StationByUidItemService {
    private constructor() { }


    public static async getStationByUid(stationArsId: string): Promise<IGetStationByUidItemResponse | null> {
        return this.getStationByUidByDataKr(stationArsId)
            .then((response) => {
                return response.data;
            })
            .catch((error) => {
                console.error(error);
                return null;
            });
    }


    private static getStationByUidByDataKr(stationArsId: string): Promise<AxiosResponse<IGetStationByUidItemResponse, any>> {
        return axios.get<IGetStationByUidItemResponse>(
            "http://ws.bus.go.kr/api/rest/stationinfo/getStationByUid", {
            params: {
                serviceKey: decodeURIComponent(DataKoreaService.getServiceKey()),
                arsId: stationArsId,
                resultType: "json"
            }
        });
    }
}