#!/bin/bash

echo "🔧 Fixing import paths in hard2kill project..."
echo ""

# Fix @tosios/common -> @hard2kill/gladiatorz-common
echo "1. Replacing @tosios/common with @hard2kill/gladiatorz-common..."
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  ! -path "*/node_modules/*" \
  -exec sed -i '' 's/@tosios\/common/@hard2kill\/gladiatorz-common/g' {} +

# Fix @tosios/server -> @hard2kill/server
echo "2. Replacing @tosios/server with @hard2kill/server..."
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  ! -path "*/node_modules/*" \
  -exec sed -i '' 's/@tosios\/server/@hard2kill\/server/g' {} +

# Fix @tosios/client -> @hard2kill/platform
echo "3. Replacing @tosios/client with @hard2kill/platform..."
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  ! -path "*/node_modules/*" \
  -exec sed -i '' 's/@tosios\/client/@hard2kill\/platform/g' {} +

# Fix local supabase imports to use shared
echo "4. Replacing local supabase imports with @hard2kill/shared..."
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/shared/*" \
  -exec sed -i '' "s/from '\.\/supabase'/from '@hard2kill\/shared'/g" {} +

find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/shared/*" \
  -exec sed -i '' 's/from "\.\/supabase"/from "@hard2kill\/shared"/g' {} +

find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/shared/*" \
  -exec sed -i '' "s/from '\.\.\/supabase'/from '@hard2kill\/shared'/g" {} +

echo ""
echo "✅ Import paths fixed!"
echo ""
echo "Verifying..."
REMAINING=$(grep -r "@tosios" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . 2>/dev/null | grep -v node_modules | wc -l)

if [ "$REMAINING" -gt 0 ]; then
    echo "⚠️  Found $REMAINING remaining @tosios references:"
    grep -r "@tosios" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . 2>/dev/null | grep -v node_modules
else
    echo "✓ All @tosios imports have been replaced!"
fi
