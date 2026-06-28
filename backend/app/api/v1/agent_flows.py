"""
Agent Flows API — CRUD del editor visual de flujo (Enterprise feature).

Gated por feature `flow_editor`. Solo Enterprise tier accede.

Endpoints:
  GET    /agent-flows           — listar flows de la store
  POST   /agent-flows           — crear nuevo flow
  GET    /agent-flows/{id}      — obtener flow específico
  PUT    /agent-flows/{id}      — actualizar nodes/edges/metadata
  POST   /agent-flows/{id}/activate  — marcar como activo (desactiva los otros)
  DELETE /agent-flows/{id}      — borrar flow
"""

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.feature_gating import requires_feature
from app.db.session import get_db
from app.models.agent_flow import AgentFlow
from app.models.store import Store

logger = logging.getLogger(__name__)

router = APIRouter()


# ════════════════════════════════════════════════════════════════════
#  Schemas
# ════════════════════════════════════════════════════════════════════

class FlowCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)


class FlowUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    nodes: list[dict[str, Any]] | None = None
    edges: list[dict[str, Any]] | None = None


class FlowResponse(BaseModel):
    id: str
    store_id: str
    name: str
    description: str | None
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    is_active: bool
    version: int
    parent_flow_id: str | None
    created_at: str
    updated_at: str


def _serialize(flow: AgentFlow) -> FlowResponse:
    return FlowResponse(
        id=flow.id,
        store_id=flow.store_id,
        name=flow.name,
        description=flow.description,
        nodes=flow.nodes_list(),
        edges=flow.edges_list(),
        is_active=flow.is_active,
        version=flow.version,
        parent_flow_id=flow.parent_flow_id,
        created_at=flow.created_at.isoformat() if flow.created_at else "",
        updated_at=flow.updated_at.isoformat() if flow.updated_at else "",
    )


# ════════════════════════════════════════════════════════════════════
#  Endpoints
# ════════════════════════════════════════════════════════════════════

@router.get("", response_model=list[FlowResponse])
def list_flows(
    store: Store = requires_feature("flow_editor"),
    db: Session = Depends(get_db),
):
    """Lista todos los flows de la store, más recientes primero."""
    flows = (
        db.query(AgentFlow)
        .filter(AgentFlow.store_id == store.id)
        .order_by(AgentFlow.updated_at.desc())
        .all()
    )
    return [_serialize(f) for f in flows]


@router.post("", response_model=FlowResponse)
def create_flow(
    payload: FlowCreateRequest,
    store: Store = requires_feature("flow_editor"),
    db: Session = Depends(get_db),
):
    """Crea un nuevo flow (no se activa automáticamente)."""
    flow = AgentFlow(
        store_id=store.id,
        name=payload.name,
        description=payload.description,
        nodes=json.dumps(payload.nodes),
        edges=json.dumps(payload.edges),
        is_active=False,
        version=1,
    )
    db.add(flow)
    db.commit()
    db.refresh(flow)
    return _serialize(flow)


# ════════════════════════════════════════════════════════════════════
#  Generación de flow por IA (widget "describí tu negocio")
# ════════════════════════════════════════════════════════════════════

class GenerateFlowRequest(BaseModel):
    prompt: str = Field(min_length=5, max_length=1500, description="Descripción del negocio y lo que el agente debe hacer")
    name: str | None = None


_FLOW_GEN_SYSTEM_PROMPT = """Sos un diseñador de flujos conversacionales para agentes de venta de e-commerce.
Recibís la descripción de un negocio y generás un diagrama de flujo en JSON para su agente.

Devolvés SOLO un JSON válido con esta forma:
{
  "name": "nombre corto del flujo",
  "description": "una línea de qué hace",
  "nodes": [ { "id": "...", "type": "...", "position": {"x":N,"y":N}, "data": {...} } ],
  "edges": [ { "id": "...", "source": "nodeId", "target": "nodeId", "sourceHandle": "opcional" } ]
}

TIPOS DE NODO disponibles y su `data`:
- trigger: { "intent": "<intent>", "label": "..." } — punto de entrada. UN trigger con intent "any" como mínimo.
    intents válidos: greeting, price, stock, shipping, discount, catalog, wants_to_buy, wants_human, any
- message: { "variants": ["texto 1", "texto 2"] } — el agente elige una variante al azar. Poné 2-3 variantes.
- branch_response: { "branches": [ {"id":"b-x","intent":"price","label":"..."} ] } — espera respuesta y ramifica por intent.
    Cada branch sale por un edge con sourceHandle = el id del branch.
- tool_call: { "tool_name": "...", "input": "" } — tools: product_search, product_detail, recommend_product, check_availability, estimate_shipping, create_payment_link, create_order, notify_owner, update_notebook
- collect_data: { "field": "email|phone|address|name", "prompt": "pregunta al cliente" }
- escalate: { "reason": "..." } — pasa a un humano. Es terminal (sin salida).
- wait: { "wait_for": "customer|supplier|payment|delivery", "timeout_minutes": N, "max_attempts": N, "on_timeout": "escalate|pause|continue" }
- rule: { "rule_kind": "...", "description": "...", "enabled": true } — regla dura. kinds: no_confirm_without_supplier, discounts_from_db_only, recalc_on_change, supplier_silence_wait, customer_silence_3_attempts, injection_to_escalation
- stage: { "stage_name": "...", "display_name": "...", "stage_description": "...", "stage_tools": [...] } — etiqueta de etapa (opcional)

REGLAS:
1. Empezá SIEMPRE con un trigger (intent "any" o el más relevante al negocio).
2. Posicioná los nodos para que se lean de arriba hacia abajo (y crecientes ~160px) y en columnas si ramifica (x crecientes ~320px).
3. Adaptá el flujo AL NEGOCIO: una farmacia pide receta, un restaurante toma pedido + dirección, una tienda de ropa pregunta talle/color, un servicio agenda turno, etc.
4. Si el negocio cobra online, usá create_payment_link + create_order. Si no, terminá en escalate (pasa a humano para cerrar).
5. Usá ids únicos y descriptivos (ej "msg-saludo", "branch-1", "tool-stock").
6. Mensajes en español rioplatense, cálidos y naturales. NADA de sonar robótico.
7. Entre 6 y 14 nodos. Ni muy simple ni gigante."""


def _openai_client_for_flowgen(db: Session):
    from app.config import get_dynamic_setting
    from openai import OpenAI
    api_key = get_dynamic_setting("openai_api_key")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY no configurada en el servidor.")
    return OpenAI(api_key=api_key, max_retries=2, timeout=60.0)


@router.post("/generate", response_model=FlowResponse)
def generate_flow(
    payload: GenerateFlowRequest,
    store: Store = requires_feature("flow_editor"),
    db: Session = Depends(get_db),
):
    """
    Genera un AgentFlow con IA a partir de una descripción en lenguaje natural
    del negocio. El flow se crea (inactivo) y queda listo para editar/activar.
    """
    try:
        client = _openai_client_for_flowgen(db)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Contexto del negocio para que el flow sea relevante
    business_ctx = (
        f"Tienda: {store.name}\n"
        f"Rubro: {store.industry or 'no especificado'}\n"
        f"País: {store.country or 'no especificado'}\n"
        f"Pedido del dueño: {payload.prompt}"
    )

    try:
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": _FLOW_GEN_SYSTEM_PROMPT},
                {"role": "user", "content": business_ctx},
            ],
            temperature=0.4,
            response_format={"type": "json_object"},
            max_tokens=3000,
        )
        raw = resp.choices[0].message.content or "{}"
        data = json.loads(raw)
    except Exception as e:
        logger.error(f"[flow-gen] error generando flow: {e}", exc_info=True)
        raise HTTPException(status_code=502, detail="La IA no pudo generar el flujo. Reintentá con otra descripción.")

    nodes = data.get("nodes") or []
    edges = data.get("edges") or []
    if not isinstance(nodes, list) or not nodes:
        raise HTTPException(status_code=502, detail="La IA devolvió un flujo vacío. Reintentá.")

    # Sanitizar: asegurar que cada nodo tenga id/type/position/data
    clean_nodes = []
    for i, n in enumerate(nodes):
        if not isinstance(n, dict) or not n.get("id"):
            continue
        clean_nodes.append({
            "id": str(n["id"]),
            "type": n.get("type", "message"),
            "position": n.get("position") or {"x": 250, "y": 80 + i * 150},
            "data": n.get("data") or {},
        })
    clean_edges = []
    for e in edges:
        if isinstance(e, dict) and e.get("source") and e.get("target"):
            clean_edges.append({
                "id": str(e.get("id") or f"e-{e['source']}-{e['target']}"),
                "source": str(e["source"]),
                "target": str(e["target"]),
                **({"sourceHandle": e["sourceHandle"]} if e.get("sourceHandle") else {}),
            })

    flow = AgentFlow(
        store_id=store.id,
        name=(payload.name or data.get("name") or "Flujo generado por IA")[:255],
        description=(data.get("description") or payload.prompt)[:500],
        nodes=json.dumps(clean_nodes),
        edges=json.dumps(clean_edges),
        is_active=False,
        version=1,
    )
    db.add(flow)
    db.commit()
    db.refresh(flow)
    logger.info(f"[flow-gen] flow generado para store {store.id[:8]}: {len(clean_nodes)} nodos")
    return _serialize(flow)


@router.get("/{flow_id}", response_model=FlowResponse)
def get_flow(
    flow_id: str,
    store: Store = requires_feature("flow_editor"),
    db: Session = Depends(get_db),
):
    flow = (
        db.query(AgentFlow)
        .filter(AgentFlow.id == flow_id, AgentFlow.store_id == store.id)
        .first()
    )
    if not flow:
        raise HTTPException(status_code=404, detail="Flow no encontrado")
    return _serialize(flow)


@router.put("/{flow_id}", response_model=FlowResponse)
def update_flow(
    flow_id: str,
    payload: FlowUpdateRequest,
    store: Store = requires_feature("flow_editor"),
    db: Session = Depends(get_db),
):
    """Actualiza nodes/edges/metadata. Incrementa version."""
    flow = (
        db.query(AgentFlow)
        .filter(AgentFlow.id == flow_id, AgentFlow.store_id == store.id)
        .first()
    )
    if not flow:
        raise HTTPException(status_code=404, detail="Flow no encontrado")

    if payload.name is not None:
        flow.name = payload.name
    if payload.description is not None:
        flow.description = payload.description
    if payload.nodes is not None:
        flow.nodes = json.dumps(payload.nodes)
    if payload.edges is not None:
        flow.edges = json.dumps(payload.edges)

    flow.version = (flow.version or 0) + 1
    db.add(flow)
    db.commit()
    db.refresh(flow)
    return _serialize(flow)


@router.post("/{flow_id}/activate", response_model=FlowResponse)
def activate_flow(
    flow_id: str,
    store: Store = requires_feature("flow_editor"),
    db: Session = Depends(get_db),
):
    """
    Marca este flow como activo. Desactiva todos los demás flows de la store.
    El agent_runtime usa el flow activo al ejecutar (cuando exista la
    integración — por ahora solo se guarda el estado).
    """
    flow = (
        db.query(AgentFlow)
        .filter(AgentFlow.id == flow_id, AgentFlow.store_id == store.id)
        .first()
    )
    if not flow:
        raise HTTPException(status_code=404, detail="Flow no encontrado")

    # Desactivar todos los demás flows de esta store
    db.query(AgentFlow).filter(
        AgentFlow.store_id == store.id,
        AgentFlow.id != flow.id,
        AgentFlow.is_active.is_(True),
    ).update({"is_active": False})

    flow.is_active = True
    db.add(flow)
    db.commit()
    db.refresh(flow)
    return _serialize(flow)


@router.delete("/{flow_id}", status_code=204)
def delete_flow(
    flow_id: str,
    store: Store = requires_feature("flow_editor"),
    db: Session = Depends(get_db),
):
    flow = (
        db.query(AgentFlow)
        .filter(AgentFlow.id == flow_id, AgentFlow.store_id == store.id)
        .first()
    )
    if not flow:
        raise HTTPException(status_code=404, detail="Flow no encontrado")
    db.delete(flow)
    db.commit()
