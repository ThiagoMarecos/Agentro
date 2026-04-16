# Nexora Security Test Matrix

## Coverage Map

| Test File | Vulnerability ID | Severity | Description |
|---|---|---|---|
| `test_auth_security.py` | C4 | Critical | JWT forgery with default SECRET_KEY |
| `test_auth_security.py` | A1 | High | No token revocation / no logout |
| `test_auth_security.py` | A2 | High | OAuth CSRF + email enumeration + brute force |
| `test_multitenant_security.py` | MT-1 | Critical | Cross-tenant data access via X-Store-ID |
| `test_multitenant_security.py` | C2 | Critical | IDOR in order_tools (no store_id filter) |
| `test_multitenant_security.py` | A5 | Medium | Storefront accepts inactive product orders |
| `test_multitenant_security.py` | ENUM-1 | Medium | Unauthenticated catalog enumeration |
| `test_webhook_security.py` | C1 | Critical | Webhook secret bypass (falsy empty string) |
| `test_webhook_security.py` | WH-1 | High | CONNECTION_UPDATE pre-auth bypass |
| `test_upload_security.py` | A3 | High | Extension-only MIME validation (magic bytes bypass) |
| `test_upload_security.py` | UPL-1 | High | SVG XSS upload |
| `test_ai_agent_security.py` | AI-1 | High | Prompt injection via notebook |
| `test_ai_agent_security.py` | AI-2 | High | Customer session hijack via identifier |
| `test_ai_agent_security.py` | AI-3 | High | Tool loop OpenAI cost bomb |
| `test_ai_agent_security.py` | AI-5 | High | All tools enabled by default |
| `test_ai_agent_security.py` | A4 | High | Chat endpoint: no rate limit / no controls |
| `test_platform_settings_security.py` | M4 | High | real_value exposes decrypted secrets in API |
| `test_platform_settings_security.py` | C4+M4 | Critical | Fernet key derivable from default SECRET_KEY |
| `test_rate_limiting_security.py` | C3 | High | RateLimitMiddleware never registered |
| `test_authorization_security.py` | RBAC | High | Role-based access control enforcement |
| `test_authorization_security.py` | IDOR | High | Product/order cross-tenant IDOR |
| `test_infrastructure_security.py` | INFRA | Critical | Hardcoded Docker credentials |
| `test_infrastructure_security.py` | UPL-2 | High | SSRF on product image import |
| `test_infrastructure_security.py` | - | Medium | Security headers, debug mode, CORS |

## Running the Suite

```bash
# Install test dependencies (from backend/ directory)
pip install pytest pytest-asyncio httpx

# Run all security tests
pytest tests/ -v --tb=short

# Run by category
pytest tests/test_auth_security.py -v
pytest tests/test_multitenant_security.py -v
pytest tests/test_webhook_security.py -v
pytest tests/test_upload_security.py -v
pytest tests/test_ai_agent_security.py -v
pytest tests/test_platform_settings_security.py -v
pytest tests/test_rate_limiting_security.py -v
pytest tests/test_authorization_security.py -v
pytest tests/test_infrastructure_security.py -v

# Run only tests for a specific vulnerability
pytest tests/ -k "C1 or WH1" -v
pytest tests/ -k "M4" -v

# Stop on first failure
pytest tests/ -x -v
```

## Expected Results

### Pre-patch (current state)
Most tests will **FAIL** — this is correct and expected. Failing tests document
confirmed vulnerabilities. Tests that PASS document correctly working controls.

### Post-patch (after remediation)
All tests should PASS. Tests marked `xfail` document accepted risks.

## Test Design Principles

1. **Every test maps to an exact vulnerability ID** from the audit
2. **Failure messages name the exact file and line** to fix
3. **No mocked security** — database queries and auth flows are real
4. **OpenAI calls are mocked** — tests don't require live credentials
5. **SQLite in-memory DB** — no PostgreSQL required to run tests
6. **Isolated transactions** — each test rolls back changes

## Dependencies

```
pytest>=7.0.0
httpx>=0.24.0
python-jose[cryptography]>=3.3.0  # already in requirements.txt
pyyaml>=6.0  # for docker-compose.yml parsing in infra tests
```
