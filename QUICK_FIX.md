# Quick Fix Summary

## ✅ Fixed Issues

1. **Colyseus Version** - Updated wasteland server to use `@colyseus/schema@^1.0.3`
2. **Package Names** - Changed `@tosios/*` to `@hard2kill/*`
3. **Dev Scripts** - Added `dev` scripts to platform and server
4. **Dependencies** - Reinstalled with correct versions
5. **Port Conflict** - Killed old process on port 2567

## ⚠️ Remaining Issues

### 1. Import Path Updates (67 files)

Many files still reference old `@tosios` imports. Need to update:

```typescript
// OLD
import { Constants } from '@tosios/common';
import { supabase } from './supabase';

// NEW
import { Constants } from '@hard2kill/gladiatorz-common';
import { supabase } from '@hard2kill/shared';
```

**To see all files that need updates:**
```bash
cd hard2kill
grep -r "@tosios" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" .
```

### 2. Platform Dev Script

The platform needs a proper build setup. Options:

**Option A: Use existing TOSIOS build scripts**
```bash
# Copy build scripts from parent
cp ../scripts/* platform/scripts/ 2>/dev/null
```

**Option B: Add esbuild**
```bash
npm install --save-dev esbuild
```

Then update `platform/package.json`:
```json
"scripts": {
  "dev": "node ../scripts/dev.sh"
}
```

### 3. Server Index Path Issue

The server is trying to find files at the wrong path. Check:
```
hard2kill/server/src/src/index.ts  ❌ (wrong - double src)
hard2kill/server/src/index.ts      ✅ (correct)
```

Looks like the copy created `server/src/src/`. Let's fix:
```bash
mv hard2kill/server/src/src/* hard2kill/server/src/
rmdir hard2kill/server/src/src
```

## 🚀 Quick Start (After Fixes)

1. **Fix the double src directory:**
```bash
cd hard2kill/server
mv src/src/* src/
rmdir src/src
```

2. **Test just the game servers:**
```bash
npm run dev:gladiatorz  # Port 3001
npm run dev:wasteland   # Port 2567
```

3. **Once imports are fixed, test full stack:**
```bash
npm run dev
```

## 📝 Next Steps

1. Run the import replacement script (see below)
2. Fix server directory structure
3. Set up platform build process
4. Test each service individually
5. Test full integrated stack

## 🔧 Automated Import Fix Script

Create `fix-imports.sh`:

```bash
#!/bin/bash

echo "Fixing import paths..."

# Fix @tosios/common -> @hard2kill/gladiatorz-common
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  ! -path "*/node_modules/*" \
  -exec sed -i '' 's/@tosios\/common/@hard2kill\/gladiatorz-common/g' {} +

# Fix @tosios/server -> @hard2kill/server
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  ! -path "*/node_modules/*" \
  -exec sed -i '' 's/@tosios\/server/@hard2kill\/server/g' {} +

# Fix @tosios/client -> @hard2kill/platform
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  ! -path "*/node_modules/*" \
  -exec sed -i '' 's/@tosios\/client/@hard2kill\/platform/g' {} +

# Fix local supabase imports in platform
find platform -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -exec sed -i '' "s/from '\.\/supabase'/from '@hard2kill\/shared'/g" {} +
find platform -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -exec sed -i '' 's/from "\.\/supabase"/from "@hard2kill\/shared"/g' {} +

echo "✓ Import paths fixed!"
echo "Run 'grep -r \"@tosios\" .' to verify"
```

Make it executable and run:
```bash
chmod +x fix-imports.sh
./fix-imports.sh
```
