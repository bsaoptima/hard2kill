#!/bin/bash

echo "🚀 HARD2KILL Setup Script"
echo "=========================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

echo -e "${YELLOW}Step 2: Checking environment variables...${NC}"
if [ ! -f .env ]; then
    echo -e "${RED}✗ .env file not found${NC}"
    echo "Please create .env file with the following variables:"
    echo "  - SUPABASE_URL"
    echo "  - SUPABASE_ANON_KEY"
    echo "  - SUPABASE_SERVICE_KEY"
    echo "  - STRIPE_SECRET_KEY"
    echo "  - STRIPE_WEBHOOK_SECRET"
    exit 1
else
    echo -e "${GREEN}✓ .env file found${NC}"
fi
echo ""

echo -e "${YELLOW}Step 3: Creating build directories...${NC}"
mkdir -p platform/public/gladiatorz
mkdir -p platform/public/wasteland
echo -e "${GREEN}✓ Build directories created${NC}"
echo ""

echo -e "${YELLOW}Step 4: Checking structure...${NC}"
echo "Platform: $([ -d platform/src ] && echo '✓' || echo '✗')"
echo "Server: $([ -d server/src ] && echo '✓' || echo '✗')"
echo "GladiatorZ: $([ -d games/gladiatorz ] && echo '✓' || echo '✗')"
echo "Wasteland: $([ -d games/wasteland ] && echo '✓' || echo '✗')"
echo "Shared: $([ -d shared ] && echo '✓' || echo '✗')"
echo ""

echo -e "${YELLOW}Step 5: Testing imports...${NC}"
echo "Checking for old @tosios imports..."
OLD_IMPORTS=$(grep -r "@tosios" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . 2>/dev/null | wc -l)
if [ "$OLD_IMPORTS" -gt 0 ]; then
    echo -e "${YELLOW}⚠ Found $OLD_IMPORTS files with @tosios imports${NC}"
    echo "Run this to see them:"
    echo "  grep -r '@tosios' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' ."
else
    echo -e "${GREEN}✓ No old imports found${NC}"
fi
echo ""

echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Review MIGRATION.md for import path updates"
echo "2. Run 'npm run dev' to start development servers"
echo "3. Visit http://localhost:3000"
echo ""
echo "Individual services:"
echo "  npm run dev:platform    (React app)"
echo "  npm run dev:server      (Main server)"
echo "  npm run dev:gladiatorz  (GladiatorZ game)"
echo "  npm run dev:wasteland   (Wasteland game)"
