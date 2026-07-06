declare module "ms" {
    function ms(val: string | number, options?: { long?: boolean }): string | number;
    export = ms;
}
