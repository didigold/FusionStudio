import os
import sys
import logging
from contextlib import asynccontextmanager

# Ensure stdout and stderr handle UTF-8 output safely
if sys.stdout is not None:
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
if sys.stderr is not None:
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.ws.system import system_monitor_loop
from backend.routers import fuse, analysis, classification, reporting, om


logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    task = asyncio.create_task(system_monitor_loop())
    yield
    task.cancel()


DEV_MODE = os.getenv("FUSIONSTUDIO_DEV", "0") == "1"

app = FastAPI(
    title="FusionStudio API",
    docs_url="/docs" if DEV_MODE else None,
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:8000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

from starlette.requests import Request
from starlette.responses import Response

@app.middleware("http")
async def no_cache_html(request: Request, call_next):
    response: Response = await call_next(request)
    if response.headers.get("content-type", "").startswith("text/html"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


app.include_router(fuse.router, prefix="/api/fuse")
app.include_router(analysis.router, prefix="/api/analysis")
app.include_router(classification.router, prefix="/api/classification")
app.include_router(reporting.router, prefix="/api/reporting")
app.include_router(om.router, prefix="/api/om")
from backend.routers import system
app.include_router(system.router, prefix="/api/system")

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "FusionStudio API"}


from fastapi import WebSocket
from backend.ws.manager import manager_system

@app.websocket("/api/brain/ws/system")
async def websocket_system(websocket: WebSocket):
    await manager_system.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        await manager_system.disconnect(websocket)

import subprocess
import json

def get_corporate_user_identity(timeout=8):
    ps_script = r'''
    $ErrorActionPreference = "Stop"

    function Emit-Json($obj) {
        $obj | ConvertTo-Json -Compress -Depth 3
    }

    try {
        $adsi = $null
        $adSystemInfo = New-Object -ComObject ADSystemInfo
        $dn = $adSystemInfo.GetType().InvokeMember("UserName", "GetProperty", $null, $adSystemInfo, $null)

        $adsi = [ADSI]("LDAP://" + $dn)

        $mail = if ($adsi.Properties["mail"].Count -gt 0) { [string]$adsi.Properties["mail"][0] } else { $null }
        $upn = if ($adsi.Properties["userPrincipalName"].Count -gt 0) { [string]$adsi.Properties["userPrincipalName"][0] } else { $null }
        $displayName = if ($adsi.Properties["displayName"].Count -gt 0) { [string]$adsi.Properties["displayName"][0] } else { $null }
        $sam = if ($adsi.Properties["sAMAccountName"].Count -gt 0) { [string]$adsi.Properties["sAMAccountName"][0] } else { [string]$env:USERNAME }

        $resolved = $null
        $source = $null
        $confirmed = $false

        if ($mail) {
            $resolved = $mail
            $source = "mail"
            $confirmed = $true
        }
        elseif ($upn) {
            $resolved = $upn
            $source = "upn"
        }
        else {
            try {
                $whoamiUpn = (whoami /upn).Trim()
            } catch {
                $whoamiUpn = $null
            }

            if ($whoamiUpn -and $whoamiUpn.Contains("@")) {
                $resolved = $whoamiUpn
                $source = "whoami_upn"
            }
            else {
                $resolved = $sam
                $source = "username"
            }
        }

        # Try to read thumbnailPhoto from ADSI
        $avatarBase64 = $null
        try {
            if ($adsi -and $adsi.Properties["thumbnailPhoto"].Count -gt 0) {
                $bytes = $adsi.Properties["thumbnailPhoto"][0]
                if ($bytes) {
                    $avatarBase64 = [Convert]::ToBase64String($bytes)
                }
            }
        } catch {}

        # Fallback to Windows Account Picture in registry
        if (-not $avatarBase64) {
            try {
                $sid = (New-Object System.Security.Principal.NTAccount($env:USERNAME)).Translate([System.Security.Principal.SecurityIdentifier]).Value
                $regPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AccountPicture\Users\$sid"
                if (Test-Path $regPath) {
                    $imgPath = $null
                    foreach ($val in @("Image448", "Image208", "Image192", "Image1080")) {
                        $prop = Get-ItemProperty -Path $regPath -Name $val -ErrorAction SilentlyContinue
                        if ($prop -and $prop.$val) {
                            $imgPath = $prop.$val
                            break
                        }
                    }
                    if ($imgPath -and (Test-Path $imgPath)) {
                        $bytes = [System.IO.File]::ReadAllBytes($imgPath)
                        $avatarBase64 = [Convert]::ToBase64String($bytes)
                    }
                }
            } catch {}
        }

        Emit-Json([PSCustomObject]@{
            username = $sam
            display_name = $displayName
            email = $mail
            upn = $upn
            resolved_identity = $resolved
            identity_source = $source
            is_email_confirmed = $confirmed
            avatar_base64 = $avatarBase64
        })
    }
    catch {
        $username = [string]$env:USERNAME
        $whoamiUpn = $null

        try {
            $whoamiUpn = (whoami /upn).Trim()
        } catch {}

        # Fallback to Windows Account Picture in registry
        $avatarBase64 = $null
        try {
            $sid = (New-Object System.Security.Principal.NTAccount($env:USERNAME)).Translate([System.Security.Principal.SecurityIdentifier]).Value
            $regPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AccountPicture\Users\$sid"
            if (Test-Path $regPath) {
                $imgPath = $null
                foreach ($val in @("Image448", "Image208", "Image192", "Image1080")) {
                    $prop = Get-ItemProperty -Path $regPath -Name $val -ErrorAction SilentlyContinue
                    if ($prop -and $prop.$val) {
                        $imgPath = $prop.$val
                        break
                    }
                }
                if ($imgPath -and (Test-Path $imgPath)) {
                    $bytes = [System.IO.File]::ReadAllBytes($imgPath)
                    $avatarBase64 = [Convert]::ToBase64String($bytes)
                }
            }
        } catch {}

        if ($whoamiUpn -and $whoamiUpn.Contains("@")) {
            Emit-Json([PSCustomObject]@{
                username = $username
                display_name = $null
                email = $null
                upn = $whoamiUpn
                resolved_identity = $whoamiUpn
                identity_source = "whoami_upn"
                is_email_confirmed = $false
                avatar_base64 = $avatarBase64
            })
        }
        else {
            Emit-Json([PSCustomObject]@{
                username = $username
                display_name = $null
                email = $null
                upn = $null
                resolved_identity = $username
                identity_source = "username"
                is_email_confirmed = $false
                avatar_base64 = $avatarBase64
            })
        }
    }
    '''

    result = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_script],
        capture_output=True,
        text=True,
        timeout=timeout
    )

    if result.returncode != 0 or not result.stdout.strip():
        return {
            "username": None,
            "display_name": None,
            "email": None,
            "upn": None,
            "resolved_identity": None,
            "identity_source": "error",
            "is_email_confirmed": False,
            "avatar_base64": None
        }

    return json.loads(result.stdout)

_cached_identity = None

@app.get("/api/user/me")
async def get_current_user():
    global _cached_identity
    if _cached_identity is None:
        _cached_identity = get_corporate_user_identity()
    return _cached_identity


FRONTEND_DIST = os.getenv("FUSIONSTUDIO_FRONTEND_DIST")

if not FRONTEND_DIST:
    # Check next to executable (fallback)
    import sys
    exe_dir = os.path.dirname(sys.executable)
    FRONTEND_DIST = os.path.join(exe_dir, "frontend", "dist")

if not FRONTEND_DIST or not os.path.exists(FRONTEND_DIST):
    # Fallback to source-relative path (dev mode)
    FRONTEND_DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist")

if os.path.exists(FRONTEND_DIST):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="static")