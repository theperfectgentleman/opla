# Powershell Management Script for Opla
param (
    [string]$Action
)

function Show-Menu {
    Clear-Host
    Write-Host "============================" -ForegroundColor Cyan
    Write-Host "   OPLA PLATFORM MANAGER    " -ForegroundColor Cyan
    Write-Host "============================" -ForegroundColor Cyan
    Write-Host "1. Start All (Studio + Backend)"
    Write-Host "2. Start Web Studio Only"
    Write-Host "3. Start Mobile App"
    Write-Host "4. Start Backend API"
    Write-Host "5. Database: Generate Migration"
    Write-Host "6. Database: Run Migrations"
    Write-Host "Q. Quit"
    Write-Host "============================" -ForegroundColor Cyan
}

function Start-Studio {
    Write-Host "Starting Studio..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'opla-frontend/apps/studio'; npm run dev"
}

function Start-Mobile {
    Write-Host "Starting Mobile..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'opla-frontend/apps/mobile'; npx expo start"
}

function Start-Backend {
    Write-Host "Starting Backend..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'opla-backend'; python -m poetry run uvicorn app.main:app --reload --port 8000"
}

function DB-Migrate {
    $msg = Read-Host "Enter migration message"
    cd opla-backend
    python -m poetry run alembic revision --autogenerate -m "$msg"
    cd ..
}

function DB-Upgrade {
    cd opla-backend
    python -m poetry run alembic upgrade head
    cd ..
}

# Main Loop
if ($Action) {
    switch ($Action) {
        "studio" { Start-Studio }
        "mobile" { Start-Mobile }
        "backend" { Start-Backend }
        Default { Write-Error "Unknown action" }
    }
}
else {
    do {
        Show-Menu
        $input = Read-Host "Select an option"
        switch ($input) {
            "1" { Start-Backend; Start-Studio }
            "2" { Start-Studio }
            "3" { Start-Mobile }
            "4" { Start-Backend }
            "5" { DB-Migrate }
            "6" { DB-Upgrade }
            "q" { exit }
            "Q" { exit }
        }
        if ($input -ne "q") { pause }
    } until ($input -eq "q")
}
