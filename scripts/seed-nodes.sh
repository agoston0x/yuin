#!/usr/bin/env bash
# Bring up five nodes and stake each into NodeRegistry. Until those transactions land the
# nodes are running but in no committee, which is a confusing state to debug at 3am.
set -euo pipefail

# TODO
