#!/usr/bin/env node
// A committed entry point: npm drops a `bin` whose file is missing when it reads the manifest,
// which happens before `prepack` builds dist/.
import '../dist/cli.js';
