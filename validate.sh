#!/bin/bash

# Worker validation script
# Checks for common configuration and coding issues

echo "🔍 Validating Dependable Painting Workers..."

# Check if all directories exist
WORKERS=("customer-worker-1" "dependablepainting" "paint-dispatcher")
for worker in "${WORKERS[@]}"; do
    if [ ! -d "$worker" ]; then
        echo "❌ Missing worker directory: $worker"
        exit 1
    else
        echo "✅ Found worker: $worker"
    fi
done

# Check syntax of JS/TS files
echo ""
echo "🔍 Checking syntax..."
cd customer-worker-1 && node -c src/index.js && echo "✅ customer-worker-1 syntax OK" || echo "❌ customer-worker-1 syntax error"
cd ../paint-dispatcher && node -c src/index.js && echo "✅ paint-dispatcher syntax OK" || echo "❌ paint-dispatcher syntax error"
cd ..

# Check for common configuration issues
echo ""
echo "🔍 Checking configurations..."

# Check service binding names match
if grep -q "paint-workers" customer-worker-1/wrangler.jsonc && grep -q "paint-workers" paint-dispatcher/wrangler.jsonc; then
    echo "✅ Service binding names match"
else
    echo "❌ Service binding name mismatch"
fi

# Check for required bindings in customer-worker-1
if grep -q "PAINTER_KVBINDING" customer-worker-1/wrangler.jsonc; then
    echo "✅ KV binding configured in customer-worker-1"
else
    echo "❌ Missing KV binding in customer-worker-1"
fi

# Check for queue binding in paint-dispatcher
if grep -q "TASK_QUEUE" paint-dispatcher/wrangler.jsonc; then
    echo "✅ Queue binding configured correctly"
else
    echo "❌ Queue binding misconfiguration"
fi

# Check that dependablepainting is simplified
if ! grep -q "d1_databases\|queues\|durable_objects" dependablepainting/wrangler.toml; then
    echo "✅ dependablepainting properly simplified"
else
    echo "❌ dependablepainting still has complex bindings"
fi

echo ""
echo "🎉 Validation complete!"