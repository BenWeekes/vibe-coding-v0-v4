/**
 * test-api.mjs
 * Tests all four backend API routes: /health, /check-env, /start-agent, /hangup-agent
 * Run via: node scripts/test-api.mjs
 */

const BASE_URL = "http://localhost:3000";

function pass(label) {
  console.log(`[PASS] ${label}`);
}

function fail(label, reason) {
  console.log(`[FAIL] ${label} — ${reason}`);
}

function info(label, data) {
  console.log(`[INFO] ${label}:`, JSON.stringify(data, null, 2));
}

async function testHealth() {
  console.log("\n--- GET /api/health ---");
  const res = await fetch(`${BASE_URL}/api/health`);
  const body = await res.json();
  info("Response", body);
  if (res.status === 200 && body.status === "ok") {
    pass("Health endpoint returns 200 with { status: 'ok' }");
    return true;
  } else {
    fail("Health endpoint", `Expected 200 + status:ok, got ${res.status} / ${JSON.stringify(body)}`);
    return false;
  }
}

async function testCheckEnv() {
  console.log("\n--- GET /api/check-env ---");
  const res = await fetch(`${BASE_URL}/api/check-env`);
  const body = await res.json();
  info("Response", body);

  if (res.status !== 200) {
    fail("check-env", `Expected HTTP 200, got ${res.status}`);
    return { ready: false };
  }

  pass("check-env returns HTTP 200");

  if (body.ready) {
    pass("All required env vars are configured");
  } else {
    fail("check-env", `Missing required env vars: ${JSON.stringify(body.missing)}`);
  }

  return body;
}

async function testStartAgent(envReady) {
  console.log("\n--- POST /api/start-agent ---");

  if (!envReady) {
    console.log("[SKIP] Skipping start-agent — env vars not ready");
    return null;
  }

  const res = await fetch(`${BASE_URL}/api/start-agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "You are a test assistant. Respond with 'Test successful' to any message.",
      greeting: "Hello, I am the test agent.",
    }),
  });

  const body = await res.json();
  info("Response", body);

  if (res.status === 200 && body.success) {
    pass(`start-agent created agent (id: ${body.agentId}, channel: ${body.channel})`);
    return body;
  } else if (res.status === 502) {
    fail("start-agent", `Agora API rejected the request: ${JSON.stringify(body.error)}`);
    return null;
  } else {
    fail("start-agent", `HTTP ${res.status} — ${JSON.stringify(body)}`);
    return null;
  }
}

async function testHangupAgent(agentData) {
  console.log("\n--- POST /api/hangup-agent ---");

  if (!agentData) {
    console.log("[SKIP] Skipping hangup-agent — no agent session to hang up");
    return;
  }

  const { agentId, appId } = agentData;

  if (!agentId) {
    console.log("[SKIP] Skipping hangup-agent — agentId not returned from start-agent");
    return;
  }

  const res = await fetch(`${BASE_URL}/api/hangup-agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, appId }),
  });

  const body = await res.json().catch(() => ({}));
  info("Response", body);

  if (res.status === 200) {
    pass(`hangup-agent successfully stopped agent ${agentId}`);
  } else {
    fail("hangup-agent", `HTTP ${res.status} — ${JSON.stringify(body)}`);
  }
}

async function run() {
  console.log(`\n========================================`);
  console.log(`  Voice AI Agent — Backend API Test`);
  console.log(`  Target: ${BASE_URL}`);
  console.log(`========================================`);

  // 1. Health check
  const healthOk = await testHealth().catch((e) => {
    fail("health (connection error)", e.message);
    return false;
  });

  if (!healthOk) {
    console.log("\n[ERROR] Could not reach the server. Is 'pnpm dev' running on port 3000?");
    process.exit(1);
  }

  // 2. Check env vars
  const envStatus = await testCheckEnv().catch((e) => {
    fail("check-env (connection error)", e.message);
    return { ready: false };
  });

  // 3. Start agent (only if env is ready)
  const agentData = await testStartAgent(envStatus.ready).catch((e) => {
    fail("start-agent (connection error)", e.message);
    return null;
  });

  // 4. Hang up agent (only if start succeeded)
  await testHangupAgent(agentData).catch((e) => {
    fail("hangup-agent (connection error)", e.message);
  });

  console.log("\n========================================");
  console.log("  Test run complete.");
  console.log("========================================\n");
}

run();
