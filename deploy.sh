#!/bin/bash

# Opla Management Script (Bash)
# Usage: ./deploy.sh

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

function show_menu() {
    clear
    echo -e "${CYAN}============================${NC}"
    echo -e "${CYAN}   OPLA PLATFORM MANAGER    ${NC}"
    echo -e "${CYAN}============================${NC}"
    echo -e "${GREEN}Development:${NC}"
    echo "1. Start All (Studio + Mobile + Backend)"
    echo "2. Start Web Studio Only"
    echo "3. Start Mobile App Only"
    echo "4. Start Backend API Only"
    echo ""
    echo -e "${GREEN}Database:${NC}"
    echo "5. Generate Migration (Alembic)"
    echo "6. Run Migrations (Upgrade DB)"
    echo ""
    echo -e "${GREEN}Housekeeping:${NC}"
    echo "7. Install All Dependencies (Frontend + Backend)"
    echo "8. Clean Caches (Turbo, Node, PyCache)"
    echo ""
    echo "Q. Quit"
    echo -e "${CYAN}============================${NC}"
}


# Define Git Bash Path
if [[ -f "C:/Program Files/Git/git-bash.exe" ]]; then
    GIT_BASH="C:/Program Files/Git/git-bash.exe"
else
    GIT_BASH="git-bash.exe"
fi

function start_studio() {
    echo -e "${GREEN}Starting Studio...${NC}"
    # Use pwd -W to get Windows path for /D argument
    PROJECT_ROOT=$(pwd -W)
    
    # Use cmd /c start to properly handle titles and paths with spaces
    if [[ "$OSTYPE" == "msys" ]]; then
        cmd //c start "Opla Studio" //D "$PROJECT_ROOT" "$GIT_BASH" -c "cd opla-frontend/apps/studio && npm run dev; exec bash"
    else 
        (cd opla-frontend/apps/studio && npm run dev) &
    fi
}

function start_mobile() {
    echo -e "${GREEN}Starting Mobile...${NC}"
    PROJECT_ROOT=$(pwd -W)
    
    if [[ "$OSTYPE" == "msys" ]]; then
        cmd //c start "Opla Mobile" //D "$PROJECT_ROOT" "$GIT_BASH" -c "cd opla-frontend/apps/mobile && npx expo start; exec bash"
    else
        (cd opla-frontend/apps/mobile && npx expo start) &
    fi
}

function start_backend() {
    echo -e "${GREEN}Starting Backend...${NC}"
    PROJECT_ROOT=$(pwd -W)
    
    if [[ "$OSTYPE" == "msys" ]]; then
        cmd //c start "Opla Backend" //D "$PROJECT_ROOT" "$GIT_BASH" -c "cd opla-backend && python -m poetry run uvicorn app.main:app --reload --port 8000; exec bash"
    else
        (cd opla-backend && python -m poetry run uvicorn app.main:app --reload --port 8000) &
    fi
}

function db_migrate() {
    echo -e "${GREEN}Database Migration...${NC}"
    read -p "Enter migration message (e.g., 'create_users'): " msg
    (cd opla-backend && python -m poetry run alembic revision --autogenerate -m "$msg")
}

function db_upgrade() {
    echo -e "${GREEN}Applying Migrations...${NC}"
    (cd opla-backend && python -m poetry run alembic upgrade head)
}

function install_deps() {
    echo -e "${GREEN}Installing Backend Dependencies...${NC}"
    (cd opla-backend && pip install poetry && python -m poetry install)
    
    echo -e "${GREEN}Installing Frontend Dependencies...${NC}"
    (cd opla-frontend && npm install)
    
    echo -e "${GREEN}Done!${NC}"
}

function clean_cache() {
    echo -e "${GREEN}Cleaning Caches...${NC}"
    echo "Removing node_modules/.cache..."
    rm -rf opla-frontend/node_modules/.cache
    echo "Removing __pycache__..."
    find . -type d -name "__pycache__" -exec rm -rf {} +
    echo -e "${GREEN}Cleaned!${NC}"
}

# Main Loop
while true; do
    show_menu
    read -p "Select an option: " choice
    case $choice in
        1) start_backend; start_studio; start_mobile ;;
        2) start_studio ;;
        3) start_mobile ;;
        4) start_backend ;;
        5) db_migrate ;;
        6) db_upgrade ;;
        7) install_deps ;;
        8) clean_cache ;;
        [Qq]) exit ;;
        *) echo -e "${RED}Invalid option${NC}"; sleep 1 ;;
    esac
    read -p "Press Enter to continue..."
done
