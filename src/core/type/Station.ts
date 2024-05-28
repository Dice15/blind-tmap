export default interface IStation {
    seq: string;
    stId: string;
    stNm: string;
    tmX: string;
    tmY: string;
    posX: string;
    posY: string;
    arsId: string;
    stDir: string;
}


export class Station implements IStation {
    private _seq: string;
    private _stId: string;
    private _stNm: string;
    private _tmX: string;
    private _tmY: string;
    private _posX: string;
    private _posY: string;
    private _arsId: string;
    private _stDir: string;

    constructor(seq: string, stId: string, stNm: string, tmX: string, tmY: string, posX: string, posY: string, arsId: string, stDir: string) {
        this._seq = seq;
        this._stId = stId;
        this._stNm = stNm;
        this._tmX = tmX;
        this._tmY = tmY;
        this._posX = posX;
        this._posY = posY;
        this._arsId = arsId;
        this._stDir = stDir
    }

    get seq(): string {
        return this._seq;
    }

    set seq(value: string) {
        this._seq = value;
    }

    get stId(): string {
        return this._stId;
    }

    set stId(value: string) {
        this._stId = value;
    }

    get stNm(): string {
        return this._stNm;
    }

    set stNm(value: string) {
        this._stNm = value;
    }

    get tmX(): string {
        return this._tmX;
    }

    set tmX(value: string) {
        this._tmX = value;
    }

    get tmY(): string {
        return this._tmY;
    }

    set tmY(value: string) {
        this._tmY = value;
    }

    get posX(): string {
        return this._posX;
    }

    set posX(value: string) {
        this._posX = value;
    }

    get posY(): string {
        return this._posY;
    }

    set posY(value: string) {
        this._posY = value;
    }

    get arsId(): string {
        return this._arsId;
    }

    set arsId(value: string) {
        this._arsId = value;
    }

    get stDir(): string {
        return this._stDir;
    }

    set stDir(value: string) {
        this._stDir = value;
    }

    /**
     * Station 인스턴스를 IStation 객체로 변환합니다.
     * @returns {IStation} IStation 객체
     */
    toObject(): IStation {
        return {
            seq: this.seq,
            stId: this.stId,
            stNm: this.stNm,
            tmX: this.tmX,
            tmY: this.tmY,
            posX: this.posX,
            posY: this.posY,
            arsId: this.arsId,
            stDir: this._stDir
        };
    }

    /**
     * IStation 객체를 사용하여 Station 클래스의 인스턴스를 생성합니다.
     * @param {IStation} obj IStation 객체
     * @returns {Station} Station 클래스의 인스턴스
     */
    static fromObject(obj: IStation): Station {
        return new Station(obj.seq, obj.stId, obj.stNm, obj.tmX, obj.tmY, obj.posX, obj.posY, obj.arsId, obj.stDir);
    }
}