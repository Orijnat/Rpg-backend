import test from "node:test";
import assert from "node:assert/strict";
import { getAllowedOrigins } from "../src/middlewares/security.js";
import { app } from "../src/server.js";

test("CORS aceita somente a allowlist e rejeita wildcard", () => {
  assert.deepEqual(
    getAllowedOrigins({ FRONTEND_URL: "https://app.example, https://admin.example" }),
    ["https://app.example", "https://admin.example"],
  );
  assert.throws(() => getAllowedOrigins({ CORS_ORIGIN: "*" }), /wildcard/);
});

test("health HTTP não depende do PostgreSQL", async () => {
  const server = app.listen(0);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, "ok");
    assert.ok(response.headers.get("content-security-policy"));
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("payload acima de 2 MB é rejeitado", async () => {
  const server = app.listen(0);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: "x".repeat(2 * 1024 * 1024) }),
    });
    assert.equal(response.status, 413);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
