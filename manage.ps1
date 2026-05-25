# Powershell Management Script for Opla
param (
    [string]$Action
)

$OplaPorts = @(8000, 5173, 4173, 4174, 4175, 8081, 19000, 19001, 19002)

function Show-Menu {
    Clear-Host
    Write-Host "============================" -ForegroundColor Cyan
    Write-Host "   OPLA PLATFORM MANAGER    " -ForegroundColor Cyan
    Write-Host "============================" -ForegroundColor Cyan
    Write-Host "1. Start All (Studio + Backend)"
    Write-Host "2. Start Web Studio + Backend"
    Write-Host "3. Start Mobile App + Backend"
    Write-Host "4. Start Backend API"
    Write-Host "5. Database: Generate Migration"
    Write-Host "6. Database: Run Migrations"
    Write-Host "7. Stop All Opla Services (Free Ports)"
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

function Stop-OplaServices {
    Write-Host "Stopping Opla services and freeing known ports..." -ForegroundColor Green

    foreach ($port in $OplaPorts) {
        $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if (-not $connections) {
            continue
        }

        $connections |
            Select-Object -ExpandProperty OwningProcess -Unique |
            ForEach-Object {
                try {
                    Stop-Process -Id $_ -Force -ErrorAction Stop
                    Write-Host "Stopped PID $_ on port $port"
                }
                catch {
                    Write-Warning "Failed to stop PID $_ on port ${port}: $($_.Exception.Message)"
                }
            }
    }
}

# Main Loop
if ($Action) {
    switch ($Action) {
        "studio" { Start-Backend; Start-Studio }
        "mobile" { Start-Backend; Start-Mobile }
        "backend" { Start-Backend }
        "stop" { Stop-OplaServices }
        Default { Write-Error "Unknown action" }
    }
}
else {
    do {
        Show-Menu
        $input = Read-Host "Select an option"
        switch ($input) {
            "1" { Start-Backend; Start-Studio }
            "2" { Start-Backend; Start-Studio }
            "3" { Start-Backend; Start-Mobile }
            "4" { Start-Backend }
            "5" { DB-Migrate }
            "6" { DB-Upgrade }
            "7" { Stop-OplaServices }
            "q" { exit }
            "Q" { exit }
        }
        if ($input -ne "q") { pause }
    } until ($input -eq "q")
}
