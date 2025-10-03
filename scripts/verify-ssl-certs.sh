#!/bin/bash
# Verify SSL certificates for Nagare Edge Server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CERT_DIR="${PROJECT_ROOT}/ssl/certs"
PRIVATE_DIR="${PROJECT_ROOT}/ssl/private"

echo "🔍 Verifying SSL certificates..."

# Check if files exist
if [ ! -f "${CERT_DIR}/ca.crt" ]; then
    echo "❌ CA certificate not found: ${CERT_DIR}/ca.crt"
    exit 1
fi

if [ ! -f "${CERT_DIR}/nginx.crt" ]; then
    echo "❌ nginx certificate not found: ${CERT_DIR}/nginx.crt"
    exit 1
fi

# Verify CA certificate
echo ""
echo "📄 CA Certificate:"
openssl x509 -in "${CERT_DIR}/ca.crt" -text -noout | grep -A 2 "Subject:"
openssl x509 -in "${CERT_DIR}/ca.crt" -text -noout | grep -A 2 "Validity"
openssl x509 -in "${CERT_DIR}/ca.crt" -text -noout | grep "CA:TRUE"

# Verify nginx certificate
echo ""
echo "📄 nginx Certificate:"
openssl x509 -in "${CERT_DIR}/nginx.crt" -text -noout | grep -A 2 "Subject:"
openssl x509 -in "${CERT_DIR}/nginx.crt" -text -noout | grep -A 2 "Validity"
openssl x509 -in "${CERT_DIR}/nginx.crt" -text -noout | grep -A 5 "Subject Alternative Name"

# Verify certificate chain
echo ""
echo "🔗 Verifying certificate chain:"
openssl verify -CAfile "${CERT_DIR}/ca.crt" "${CERT_DIR}/nginx.crt"

# Check certificate format
echo ""
echo "📋 Certificate formats:"
file "${CERT_DIR}/ca.crt"
file "${CERT_DIR}/nginx.crt"

echo ""
echo "✅ All certificates verified successfully!"
echo ""
echo "To install on macOS:"
echo "  1. Download: http://verbumcare-lab:8888/ca.crt"
echo "  2. Or use: scp q@verbumcare-lab:/opt/verbumcare/ssl/certs/ca.crt ~/Downloads/"
echo "  3. Double-click to install in Keychain Access"
echo "  4. Trust: Always Trust for SSL"
echo ""
echo "To install on iOS:"
echo "  1. Visit: http://verbumcare-lab:8888/ca.crt in Safari"
echo "  2. Settings → Profile Downloaded → Install"
echo "  3. Settings → General → About → Certificate Trust Settings"
echo "  4. Enable trust for 'Nagare Edge CA'"
