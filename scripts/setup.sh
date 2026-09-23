#!/bin/bash
# Environment setup for Claude Code cloud sessions: builds the Stellar CLI from
# GitHub `main`, as the "Stellar CLI for Agents" quickstart requires while the
# agent features are in developer preview.
set -euo pipefail

# The secure-store (dbus) and Ledger (udev) crates need these headers on Linux.
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq libdbus-1-dev libudev-dev

# Needs Rust 1.93.0+. Keep --branch main (cargo can otherwise install a stale
# cached commit) and --root (keeps it apart from any release `stellar`).
cargo install --locked --git https://github.com/stellar/stellar-cli --branch main stellar-cli \
  --root ~/.stellar-main

# A main build prints help here; a release exits 2 with "unrecognized subcommand".
~/.stellar-main/bin/stellar token decimals --help > /dev/null
