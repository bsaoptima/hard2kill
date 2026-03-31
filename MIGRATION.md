# Migration Guide

This document explains the reorganization from the old TOSIOS structure to the new HARD2KILL structure.

## What Changed

### Old Structure
```
TOSIOS/
├── packages/
│   ├── client/     (Platform + GladiatorZ UI mixed together)
│   ├── server/     (Main server + GladiatorZ server mixed)
│   └── common/     (GladiatorZ shared code)
└── ...

three-fps/          (Separate repo/folder)
└── ...
```

### New Structure
```
hard2kill/
├── platform/       (Just the platform: routing, auth, landing)
├── server/         (Just the main server: API, proxies)
├── games/
│   ├── gladiatorz/ (2D game, extracted from TOSIOS)
│   └── wasteland/  (3D game, renamed from three-fps)
└── shared/         (Code used everywhere)
```

## Key Changes

### 1. Platform Code Separation
**Old:**
- `packages/client/` contained both platform AND game code mixed together

**New:**
- `platform/` contains ONLY routing, auth, landing page
- `games/gladiatorz/client/` contains the 2D game code

### 2. Shared Supabase Client
**Old:**
- `packages/client/src/supabase.ts` (only for TOSIOS)
- `three-fps/src/supabase.js` (duplicate code)

**New:**
- `shared/supabase.ts` (used by everything)

**Migration:**
```typescript
// Old import
import { supabase } from './supabase';

// New import
import { supabase } from '@hard2kill/shared';
```

### 3. Game Naming
- **TOSIOS 2D game** → **GladiatorZ**
- **three-fps** → **Wasteland**

### 4. Workspace Names
**Old package names:**
- `@tosios/client`
- `@tosios/server`
- `@tosios/common`

**New package names:**
- `@hard2kill/platform`
- `@hard2kill/server`
- `@hard2kill/gladiatorz-client`
- `@hard2kill/gladiatorz-server`
- `@hard2kill/gladiatorz-common`
- `@hard2kill/wasteland-client`
- `@hard2kill/wasteland-server`
- `@hard2kill/shared`

## Import Path Updates Needed

### Platform Files
Update imports in `platform/src/`:

```typescript
// Old
import { Constants } from '@tosios/common';

// New
import { Constants } from '@hard2kill/gladiatorz-common';
```

```typescript
// Old
import { supabase } from './supabase';

// New
import { supabase } from '@hard2kill/shared';
```

### GladiatorZ Client
Update imports in `games/gladiatorz/client/src/`:

```typescript
// Old
import { Constants } from '@tosios/common';

// New
import { Constants } from '@hard2kill/gladiatorz-common';
```

### GladiatorZ Server
Update imports in `games/gladiatorz/server/src/`:

```typescript
// Old
import { Constants } from '@tosios/common';

// New
import { Constants } from '@hard2kill/gladiatorz-common';
```

```typescript
// Old
import { creditBalance, supabase } from './supabase';

// New
import { creditBalance, supabase } from '@hard2kill/shared';
```

### Wasteland
Update imports in `games/wasteland/client/src/`:

```typescript
// Old
import { supabase } from './supabase';

// New
import { supabase } from '@hard2kill/shared';
```

## Files That Need Updates

Run this to find files with old imports:

```bash
# Find @tosios references
grep -r "@tosios" hard2kill/ --exclude-dir=node_modules

# Find local supabase imports
grep -r "from './supabase'" hard2kill/ --exclude-dir=node_modules
grep -r 'from "./supabase"' hard2kill/ --exclude-dir=node_modules
```

## Testing After Migration

1. **Install dependencies:**
```bash
cd hard2kill
npm install
```

2. **Check for import errors:**
```bash
npm run dev
```

3. **Test each game:**
   - Visit `http://localhost:3000/` (landing)
   - Visit `http://localhost:3000/lobby` (GladiatorZ)
   - Visit `http://localhost:3000/three-fps` (Wasteland iframe)

4. **Verify shared code works:**
   - Login/logout (Supabase auth)
   - Check balance display
   - Play a game and verify pot updates

## Rollback Plan

If something breaks, the old structure is still intact at:
- `packages/` (old TOSIOS code)
- `../three-fps/` (old three-fps code)

Just delete `hard2kill/` and continue using the old structure.

## Benefits of New Structure

✅ **Clearer separation** - Platform vs Games
✅ **Easier to add games** - Just add to `games/`
✅ **No code duplication** - Shared code in one place
✅ **Better organization** - Each game is self-contained
✅ **Easier onboarding** - Structure is self-explanatory

## Next Steps

1. Update all import paths (see above)
2. Test thoroughly
3. Update deployment scripts
4. Update documentation
5. Delete old `packages/` directory
6. Commit the new structure
