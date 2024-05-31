import { IGetStationByNameResponse } from '@/types/externalApi/datakr/IGetStationByNameResponse';
import axios, { AxiosResponse } from 'axios';
import DataKoreaService from './DataKoreaService';


export class StationByNameService {
    private constructor() { }


    public static async getStationByName(stationName: string): Promise<IGetStationByNameResponse | null> {
        return this.getStationByNameByDataKr(stationName)
            .then((response) => {
                return response.data;
            })
            .catch((error) => {
                console.error(error);
                return null;
            });
    }


    private static getStationByNameByDataKr(stationName: string): Promise<AxiosResponse<IGetStationByNameResponse, any>> {
        return axios.get<IGetStationByNameResponse>(
            "http://ws.bus.go.kr/api/rest/stationinfo/getStationByName", {
            params: {
                serviceKey: decodeURIComponent(DataKoreaService.getServiceKey()),
                stSrch: stationName,
                resultType: "json"
            }
        });
    }
}