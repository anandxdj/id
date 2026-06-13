#!/usr/bin/env bash
# Generate an RSA keypair for OIDC ID-token signing.
# Output: backend/cert/private-key.pem (gitignored) + public-key.pub
set -euo pipefail

CERT_DIR="$(cd "$(dirname "$0")/.." && pwd)/cert"
mkdir -p "$CERT_DIR"

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$CERT_DIR/private-key.pem"
openssl rsa -in "$CERT_DIR/private-key.pem" -pubout -out "$CERT_DIR/public-key.pub"

echo "Wrote:"
echo "  $CERT_DIR/private-key.pem (keep secret — gitignored)"
echo "  $CERT_DIR/public-key.pub"
