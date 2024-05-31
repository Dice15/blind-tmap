export default class TMapService {
    private constructor() { }


    public static getAppKey(): string {
        return process.env.TMAP_APP_KEY;
    }
}