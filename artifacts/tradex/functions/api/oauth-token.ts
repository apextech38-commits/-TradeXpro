interface Env {}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json<{
      code: string;
      code_verifier: string;
      redirect_uri: string;
    }>();

    const { code, code_verifier, redirect_uri } = body;
    if (!code || !code_verifier || !redirect_uri) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const tokenRes = await fetch("https://auth.deriv.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: "33ughhvgtxloGwBQQZEeD",
        code,
        code_verifier,
        redirect_uri,
      }),
    });

    const tokenData = await tokenRes.json();
    return new Response(JSON.stringify(tokenData), {
      status: tokenRes.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Token exchange failed", detail: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
