export interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'aether-weather-intelligence',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: {
            'content-type': 'application/json;charset=UTF-8',
            'cache-control': 'no-store',
          },
        }
      );
    }

    return env.ASSETS.fetch(request);
  },
};
