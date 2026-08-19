# Load Testing

## Checkout Flow Load Test

The `load-test-checkout.js` script uses [autocannon](https://github.com/mcollina/autocannon) to measure throughput, latency, and error rates against the API.

### Prerequisites

```bash
npm i -g autocannon
```

### Running against local dev

```bash
# Terminal 1: start the dev server
bun run dev

# Terminal 2: get a JWT token (sign in via the app, then copy from Network tab)
TOKEN=<your-jwt-access-token> node scripts/load-test-checkout.js
```

### Running against staging

```bash
BASE_URL=https://staging.snackpod.in \
TOKEN=<staging-jwt> \
CONNECTIONS=20 \
DURATION=60 \
node scripts/load-test-checkout.js
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3000` | Target server |
| `TOKEN` | (required) | JWT Bearer token for auth |
| `DURATION` | `30` | Test duration in seconds |
| `CONNECTIONS` | `10` | Number of concurrent connections |

### What to look for

- **Req/sec** should be stable (no sudden drops)
- **p99 latency** should be under 2s for acceptable UX
- **Errors** and **Non-2xx** should be 0
- **Timeouts** should be 0

### Pre-launch checklist

- [ ] Run against staging with TOKEN from a real customer account
- [ ] Increase CONNECTIONS to 50+ for a stress test
- [ ] Run for at least 60 seconds to get stable numbers
- [ ] Verify no memory leaks (run 2x back-to-back, compare latencies)
