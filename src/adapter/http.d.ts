export type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export type Request = {
    method: Method;
    path: string;
    query?: Record<string, string | undefined>;
    headers?: Record<string, string | undefined>;
    body?: unknown;
};
export type Response<T = any> = {
    status: number;
    body?: T;
    headers?: Record<string, string>;
};
type Handler = (_req: Request, _params: Record<string, string>) => Response | Promise<Response>;
type Route = {
    method: Method;
    pattern: string;
    handler: Handler;
};
export declare function handleRequest(_req: Request): Promise<Response>;
export declare const __routes: Route[];
export {};
