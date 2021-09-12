interface ISPLSync {
    db(path: undefined | string | ArrayBuffer): IDBSync;
    mount(path: string, mountpoint: string): ISPLSync;
    unmount(mountpoint: string): ISPLSync;
    version(): any;
}

interface IDBSync {
    attach(db: string, schema: string): IDB;
    detach(schema: string): IDB;
    exec(sql: string, par?: any): IDB;
    read(sql: string): IDB;
    load(src: string): IDB;
    save(dest?: string): IDB | ArrayBuffer;
    close(): void;
    get: {
        first: any,
        flat: any[],
        rows: any[],
        cols: string[],
        objs: any[],
        sync: IResult
    }
}

interface IResult {
    first: any,
    flat: any[],
    rows: any[],
    cols: string[],
    objs: any[],
    sync: IResult,
    free: undefined
}

interface ISplOptions {
    autoJSON?: boolean;
    autoGeoJSON?: false | {
        precision: number,
        options: number
    }
}

declare const _default: (options?: ISplOptions) => ISPLSync;

export default _default;
