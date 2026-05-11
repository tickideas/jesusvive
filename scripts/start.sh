#!/bin/sh
# Container entrypoint: run pending DB migrations, then start the Next server.
set -e

node scripts/migrate.mjs
exec node server.js
