#!/usr/bin/env sh

# Fails intentionally to test pre-connect abort behavior.

echo "hook-fail.sh running"
echo "hook-fail.sh failing" 1>&2
exit 1
