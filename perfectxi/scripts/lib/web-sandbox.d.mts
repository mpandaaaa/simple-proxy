/** Types for web-sandbox.mjs. The web game's globals are untyped by nature. */
export declare const WEB_DIR: string;
export declare function mainScriptSource(): string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export declare function loadWebGame(opts?: { random?: () => number }): any;
