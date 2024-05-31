export default class DataKoreaService {
    private constructor() { }


    private static getRandomInt(min: number, max: number): number {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min)) + min;
    }


    public static getServiceKey(): string {
        return [
            process.env.DATA_API_ENCODING_KEY1,
            process.env.DATA_API_ENCODING_KEY2,
            process.env.DATA_API_ENCODING_KEY3,
            process.env.DATA_API_ENCODING_KEY4,
        ][this.getRandomInt(0, 4)];
    }
}