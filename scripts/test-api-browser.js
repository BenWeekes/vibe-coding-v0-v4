// Paste this entire script into your browser DevTools console while the app is open.
// It will call all four API routes and print the results.

(async function testAPIs() {
  const BASE = window.location.origin;
  const log = (label, ok, status, body) => {
    const style = ok ? "color: #4ade80; font-weight: bold" : "color: #f87171; font-weight: bold";
    console.group(`%c${ok ? "PASS" : "FAIL"} — ${label}`, style);
    console.log("Status:", status);
    console.log("Body:", body);
    console.groupEnd();
  };

  console.log("%c====== Voice AI Agent API Tests ======", "font-size: 14px; font-weight: bold");

  // 1. GET /api/health
  try {
    const r = await fetch(`${BASE}/api/health`);
    const body = await r.json();
    log("GET /api/health", r.ok, r.status, body);
  } catch (e) {
    log("GET /api/health", false, null, e.message);
  }

  // 2. GET /api/check-env
  try {
    const r = await fetch(`${BASE}/api/check-env`);
    const body = await r.json();
    log("GET /api/check-env", r.ok, r.status, body);
  } catch (e) {
    log("GET /api/check-env", false, null, e.message);
  }

  // 3. POST /api/start-agent
  let agentId = null;
  try {
    const r = await fetch(`${BASE}/api/start-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "test-channel-" + Date.now(),
        uid: 12345,
        system_prompt: "You are a helpful assistant.",
        greeting: "Hello, how can I help you today?"
      })
    });
    const body = await r.json();
    agentId = body?.data?.agent_id ?? body?.agent_id ?? null;
    log("POST /api/start-agent", r.ok, r.status, body);
  } catch (e) {
    log("POST /api/start-agent", false, null, e.message);
  }

  // 4. POST /api/hangup-agent
  if (agentId) {
    try {
      const r = await fetch(`${BASE}/api/hangup-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId, channel: "test-channel" })
      });
      const body = await r.json();
      log("POST /api/hangup-agent", r.ok, r.status, body);
    } catch (e) {
      log("POST /api/hangup-agent", false, null, e.message);
    }
  } else {
    console.warn("SKIP — POST /api/hangup-agent (no agent_id from start-agent)");
  }

  console.log("%c====== Tests Complete ======", "font-size: 14px; font-weight: bold");
})();
