import urllib.request
import urllib.error
import json
import time

BASE = "http://localhost:3000"

def request(method, path, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            raw = res.read().decode()
            try:
                return res.status, json.loads(raw)
            except Exception:
                return res.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw
    except Exception as ex:
        return None, str(ex)

def check(label, status, body, expect_status=200):
    ok = status == expect_status
    icon = "PASS" if ok else "FAIL"
    print(f"[{icon}] {label}")
    print(f"       Status : {status}")
    if isinstance(body, dict):
        print(f"       Body   : {json.dumps(body, indent=2)}")
    else:
        print(f"       Body   : {body}")
    print()
    return ok

print("=" * 52)
print("  Voice AI Agent — Backend API Test Suite")
print("=" * 52)
print()

# 1. Health check
status, body = request("GET", "/api/health")
check("GET /api/health", status, body)

# 2. Check env
status, body = request("GET", "/api/check-env")
check("GET /api/check-env", status, body)

# 3. Start agent (expects the Agora ConvoAI call to work if env vars set)
start_payload = {
    "channel": "test-channel-123",
    "uid": 12345
}
status, body = request("POST", "/api/start-agent", start_payload)
# 200 = success, 500 = missing env vars or Agora error — both are informative
agent_id = None
if isinstance(body, dict) and body.get("agent_id"):
    agent_id = body["agent_id"]
check("POST /api/start-agent", status, body, expect_status=status)

# 4. Hangup agent (only if we got an agent_id back)
if agent_id:
    time.sleep(1)
    hangup_payload = {"agent_id": agent_id, "channel": "test-channel-123"}
    status, body = request("POST", "/api/hangup-agent", hangup_payload)
    check("POST /api/hangup-agent", status, body, expect_status=status)
else:
    print("[SKIP] POST /api/hangup-agent — no agent_id returned from start-agent")
    print()

print("=" * 52)
print("  Test run complete")
print("=" * 52)
