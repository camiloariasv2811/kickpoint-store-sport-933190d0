import server from "./.output/server/index.mjs";

async function testRoute(path) {
  console.log(`\n--- Testing ${path} ---`);
  try {
    const request = new Request(`https://preview--kickpoint-store-sport.lovable.app${path}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const env = {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    };

    const ctx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    };

    const res = await server.fetch(request, env, ctx);
    console.log(`Status: ${res.status}`);
    console.log(`Content-Type: ${res.headers.get("content-type")}`);
    const text = await res.text();
    console.log(`Body length: ${text.length}`);
    if (text.includes("This page didn't load")) {
      console.error(`FAILED: ${path} returned "This page didn't load"`);
      console.log("Body snippet:", text.slice(0, 500));
    } else {
      console.log(`SUCCESS: ${path} rendered correctly (preview snippet: ${text.slice(0, 150)}...)`);
    }
  } catch (err) {
    console.error(`EXCEPTION for ${path}:`, err);
  }
}

async function run() {
  await testRoute("/");
  await testRoute("/catalogo");
  await testRoute("/auth");
  await testRoute("/admin");
  await testRoute("/producto/test");
  await testRoute("/pedido");
}

run();
