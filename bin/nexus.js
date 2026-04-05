#!/usr/bin/env bun
import('../dist/main.js').catch(err => {
  console.error('Failed to start Nexus CLI:', err);
  process.exit(1);
});
