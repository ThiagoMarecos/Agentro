"""
Terminal SSH remota + IA diagnóstico para el panel admin.
WebSocket: /api/v1/admin/terminal/ws
POST: /api/v1/admin/terminal/ai-diagnose
POST: /api/v1/admin/terminal/ai-fix
POST: /api/v1/admin/terminal/exec  (ejecuta un solo comando via SSH)
"""

import asyncio
import json
import logging
import threading
import time

import paramiko
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db, SessionLocal
from app.models.user import User
from app.core.dependencies import require_superadmin
from app.core.security import decode_token
from app.services.platform_settings_service import get_setting_value
from app.config import get_dynamic_setting

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────

def _get_ssh_credentials(db: Session) -> dict:
    """Lee credenciales SSH de la DB."""
    host = get_setting_value(db, "vps_ssh_host")
    port = get_setting_value(db, "vps_ssh_port") or "22"
    user = get_setting_value(db, "vps_ssh_user") or "root"
    password = get_setting_value(db, "vps_ssh_password")

    if not host or not password:
        raise ValueError("Credenciales SSH no configuradas. Ve a Admin > API Keys > VPS / SSH.")

    return {"host": host, "port": int(port), "user": user, "password": password}


def _create_ssh_client(creds: dict) -> paramiko.SSHClient:
    """Crea y conecta un cliente SSH."""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=creds["host"],
        port=creds["port"],
        username=creds["user"],
        password=creds["password"],
        timeout=10,
        look_for_keys=False,
        allow_agent=False,
    )
    return client


def _exec_ssh_command(creds: dict, command: str, timeout: int = 30) -> dict:
    """Ejecuta un comando SSH y retorna stdout + stderr."""
    client = _create_ssh_client(creds)
    try:
        stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
        exit_code = stdout.channel.recv_exit_status()
        return {
            "stdout": stdout.read().decode("utf-8", errors="replace"),
            "stderr": stderr.read().decode("utf-8", errors="replace"),
            "exit_code": exit_code,
        }
    finally:
        client.close()


# ── Exec single command ─────────────────────────────────────────

class ExecRequest(BaseModel):
    command: str


class ExecResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int


@router.post("/exec", response_model=ExecResponse)
def exec_command(
    body: ExecRequest,
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Ejecuta un comando en el VPS vía SSH."""
    try:
        creds = _get_ssh_credentials(db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        result = _exec_ssh_command(creds, body.command)
        return ExecResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error SSH: {str(e)[:300]}")


# ── AI Diagnose ─────────────────────────────────────────────────

class DiagnoseRequest(BaseModel):
    context: str  # info del servicio con error
    service_name: str


class DiagnoseResponse(BaseModel):
    analysis: str
    commands: list[str]
    risk_level: str  # "low" | "medium" | "high"


@router.post("/ai-diagnose", response_model=DiagnoseResponse)
def ai_diagnose(
    body: DiagnoseRequest,
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Usa OpenAI para diagnosticar un problema y sugerir comandos."""
    api_key = get_dynamic_setting("openai_api_key")
    if not api_key:
        raise HTTPException(status_code=400, detail="OpenAI API Key no configurada")

    from openai import OpenAI
    client = OpenAI(api_key=api_key)

    system_prompt = """Eres un administrador de sistemas Linux experto.
Tu trabajo es diagnosticar problemas en un VPS que corre una aplicación Docker.

La infraestructura es:
- VPS Ubuntu 24.04 con Docker (CLI moderna: usar "docker compose" CON ESPACIO, NO "docker-compose")
- Containers: agentro-backend, agentro-frontend, agentro-postgres, agentro-redis, agentro-evolution
- Docker network: agentro_default
- App directory: /var/www/agentro
- Backend: FastAPI (Python) en container agentro-backend
- Frontend: Next.js en container agentro-frontend
- DB: PostgreSQL en container agentro-postgres
- Cache: Redis en container agentro-redis
- WhatsApp: Evolution API en container agentro-evolution
- Reverse proxy: Nginx con SSL Let's Encrypt
- IMPORTANTE: Usar SIEMPRE "docker" (no "docker-compose"). Ejemplo: "docker restart agentro-redis", "docker logs agentro-backend --tail 50"

Responde SIEMPRE en este formato JSON exacto:
{
  "analysis": "Explicación breve del problema en español (2-3 oraciones)",
  "commands": ["comando1", "comando2", ...],
  "risk_level": "low|medium|high"
}

Reglas:
- Los comandos deben ser seguros y no destructivos
- Para riesgo "high", incluir solo comandos de diagnóstico, no de corrección
- Máximo 5 comandos
- Los comandos deben ser específicos para el contexto dado
- Responde SOLO el JSON, sin markdown ni explicación extra"""

    try:
        response = client.chat.completions.create(
            model=get_dynamic_setting("openai_default_model") or "gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Servicio: {body.service_name}\nContexto del error: {body.context}"},
            ],
            temperature=0.3,
            max_tokens=500,
        )

        content = response.choices[0].message.content.strip()
        # Limpiar markdown si viene envuelto
        if content.startswith("```"):
            content = content.split("\n", 1)[1]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

        data = json.loads(content)
        return DiagnoseResponse(
            analysis=data.get("analysis", "No se pudo analizar"),
            commands=data.get("commands", [])[:5],
            risk_level=data.get("risk_level", "medium"),
        )
    except json.JSONDecodeError:
        return DiagnoseResponse(
            analysis="La IA generó una respuesta no válida. Intenta de nuevo.",
            commands=[],
            risk_level="low",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error IA: {str(e)[:300]}")


# ── AI Auto-Fix ─────────────────────────────────────────────────

class AutoFixRequest(BaseModel):
    service_name: str
    context: str
    commands: list[str]  # Comandos sugeridos por AI


class CommandResult(BaseModel):
    command: str
    stdout: str
    stderr: str
    exit_code: int


class AutoFixResponse(BaseModel):
    results: list[CommandResult]
    summary: str


@router.post("/ai-fix", response_model=AutoFixResponse)
def ai_auto_fix(
    body: AutoFixRequest,
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Ejecuta los comandos sugeridos por la IA en el VPS."""
    try:
        creds = _get_ssh_credentials(db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Lista negra de comandos peligrosos
    dangerous = ["rm -rf /", "mkfs", "dd if=", "> /dev/sda", ":(){ :|:& };:", "shutdown", "reboot", "init 0", "halt"]
    for cmd in body.commands:
        cmd_lower = cmd.lower().strip()
        for d in dangerous:
            if d in cmd_lower:
                raise HTTPException(status_code=400, detail=f"Comando bloqueado por seguridad: {cmd}")

    results: list[CommandResult] = []
    for cmd in body.commands[:5]:  # Máximo 5
        try:
            res = _exec_ssh_command(creds, cmd, timeout=30)
            results.append(CommandResult(
                command=cmd,
                stdout=res["stdout"][:2000],  # Limitar output
                stderr=res["stderr"][:1000],
                exit_code=res["exit_code"],
            ))
            # Si un comando falla, parar
            if res["exit_code"] != 0:
                break
        except Exception as e:
            results.append(CommandResult(
                command=cmd,
                stdout="",
                stderr=str(e)[:500],
                exit_code=-1,
            ))
            break

    # Generar resumen
    all_ok = all(r.exit_code == 0 for r in results)
    failed = [r for r in results if r.exit_code != 0]

    if all_ok:
        summary = f"✅ Se ejecutaron {len(results)} comando(s) exitosamente para {body.service_name}."
    else:
        summary = f"⚠️ {len(failed)} comando(s) fallaron. Revisa el output para más detalles."

    return AutoFixResponse(results=results, summary=summary)


# ── WebSocket SSH Terminal ──────────────────────────────────────

@router.websocket("/ws")
async def websocket_ssh_terminal(ws: WebSocket):
    """Terminal SSH interactiva vía WebSocket."""
    await ws.accept()

    # Autenticar: esperamos el token como primer mensaje
    try:
        auth_msg = await asyncio.wait_for(ws.receive_text(), timeout=10)
        auth_data = json.loads(auth_msg)
        token = auth_data.get("token", "")

        # Verificar token
        payload = decode_token(token)
        if not payload:
            await ws.send_text(json.dumps({"type": "error", "data": "Token inválido"}))
            await ws.close()
            return

        user_id = payload.get("sub")
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user or not user.is_superadmin:
                await ws.send_text(json.dumps({"type": "error", "data": "Acceso denegado"}))
                await ws.close()
                return

            creds = _get_ssh_credentials(db)
        except ValueError as e:
            await ws.send_text(json.dumps({"type": "error", "data": str(e)}))
            await ws.close()
            return
        finally:
            db.close()

    except asyncio.TimeoutError:
        await ws.send_text(json.dumps({"type": "error", "data": "Timeout de autenticación"}))
        await ws.close()
        return
    except Exception as e:
        await ws.send_text(json.dumps({"type": "error", "data": f"Error auth: {str(e)[:200]}"}))
        await ws.close()
        return

    # Conectar SSH
    ssh_client = None
    channel = None
    try:
        ssh_client = _create_ssh_client(creds)
        channel = ssh_client.invoke_shell(term="xterm-256color", width=120, height=40)
        channel.settimeout(0.1)

        await ws.send_text(json.dumps({"type": "connected", "data": f"Conectado a {creds['host']}"}))

        # Leer output del SSH en background
        async def read_ssh():
            while True:
                try:
                    if channel.recv_ready():
                        data = channel.recv(4096).decode("utf-8", errors="replace")
                        await ws.send_text(json.dumps({"type": "output", "data": data}))
                    elif channel.recv_stderr_ready():
                        data = channel.recv_stderr(4096).decode("utf-8", errors="replace")
                        await ws.send_text(json.dumps({"type": "output", "data": data}))
                    else:
                        await asyncio.sleep(0.05)

                    if channel.closed:
                        break
                except Exception:
                    break

        read_task = asyncio.create_task(read_ssh())

        # Recibir input del WebSocket
        try:
            while True:
                msg = await ws.receive_text()
                data = json.loads(msg)

                if data.get("type") == "input":
                    channel.send(data["data"])
                elif data.get("type") == "resize":
                    channel.resize_pty(
                        width=data.get("cols", 120),
                        height=data.get("rows", 40),
                    )
        except WebSocketDisconnect:
            pass
        finally:
            read_task.cancel()

    except Exception as e:
        try:
            await ws.send_text(json.dumps({"type": "error", "data": f"Error SSH: {str(e)[:300]}"}))
        except Exception:
            pass
    finally:
        if channel:
            channel.close()
        if ssh_client:
            ssh_client.close()
        try:
            await ws.close()
        except Exception:
            pass
