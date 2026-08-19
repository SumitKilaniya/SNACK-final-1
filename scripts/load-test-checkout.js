#!/usr/bin/env node
/**
 * autocannon load test for the Snack-Pod checkout flow.
 *
 * Usage:
 *   1. Install autocannon:  npm i -g autocannon
 *   2. Start the dev server: bun run dev
 *   3. Run:  node scripts/load-test-checkout.js
 *
 * For staging:
 *   BASE_URL=https://staging.snackpod.in TOKEN=<jwt> node scripts/load-test-checkout.js
 *
 * NOTE: This script targets the /api/checkout endpoint with a pre-authenticated
 * token. It measures throughput, latency, and error rates under concurrent load.
 * Do NOT run against production without explicit permission.
 */

const autocannon = require('autocannon');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TOKEN = process.env.TOKEN || '';
const DURATION = parseInt(process.env.DURATION || '30', 10); // seconds
const CONNECTIONS = parseInt(process.env.CONNECTIONS || '10', 10);

if (!TOKEN) {
  console.error('Error: Set TOKEN env var to a valid JWT access token.');
  console.error('  TOKEN=<jwt> node scripts/load-test-checkout.js');
  process.exit(1);
}

const instance = autocannon(
  {
    url: `${BASE_URL}/api/cart`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
    connections: CONNECTIONS,
    duration: DURATION,
    pipelining: 1,
  },
  (err, result) => {
    if (err) {
      console.error('Load test error:', err);
      process.exit(1);
    }
    console.log('\n=== Load Test Results ===');
    console.log(`URL:            ${result.url}`);
    console.log(`Duration:       ${result.duration}s`);
    console.log(`Connections:    ${result.connections}`);
    console.log(`Total Requests: ${result.requests.total}`);
    console.log(`Req/sec:        ${result.requests.average}`);
    console.log(`Latency (avg):  ${result.latency.average}ms`);
    console.log(`Latency (p50):  ${result.latency.p50}ms`);
    console.log(`Latency (p99):  ${result.latency.p99}ms`);
    console.log(`Throughput:     ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/s`);
    console.log(`Errors:         ${result.errors.total}`);
    console.log(`Timeouts:       ${result.timeouts}`);
    console.log(`Non-2xx:        ${result.non2xx}`);
    console.log('========================\n');
  }
);

// Print live progress
autocannon.track(instance, { renderProgressBar: true });
