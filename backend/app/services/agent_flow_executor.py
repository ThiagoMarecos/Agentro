"""
Agent Flow Executor — ejecuta un AgentFlow custom en respuesta a un mensaje.

Se activa cuando Store.agent_mode == 'custom_flow' Y hay un AgentFlow con
is_active=True para esa store. En cualquier otro caso, el agent_runtime
tradicional (state machine de 9 stages) sigue tomando control.

## Diseño

El executor es un intérprete de un grafo dirigido (nodes + edges):
  - Mantiene `current_node_id` en el notebook de la SalesSession.
  - En cada mensaje del cliente:
      1. Si no hay current_node → buscar el TRIGGER que matchea el intent
         del mensaje, ejecutar desde ahí.
      2. Si hay current_node y es un `branch_response` → clasificar la
         respuesta del cliente, elegir la rama matching, transicionar.
      3. Si hay current_node y es un `collect_data` → guardar el dato del
         cliente en notebook + transicionar al siguiente.
      4. Ejecutar nodos en secuencia hasta llegar a uno que requiera otra
         respuesta del cliente (`branch_response`, `collect_data`) o
         terminal (`escalate` sin salida).

## Tipos de nodo soportados

  - trigger          → punto de entrada (matchea por `data.intent`)
  - message          → envía texto (elige variante random de `data.variants[]`)
  - branch_response  → pausa, espera respuesta, ramifica por intent
  - condition        → evalúa expresión simple, ramifica Sí/No
  - tool_call        → ejecuta tool del catálogo de agent_tools
  - collect_data     → pide dato al cliente, persiste en notebook
  - escalate         → pausa el agente, marca conversation.needs_seller_assignment
  - delay            → no-op (en v1 ignoramos el delay real)
  - stage            → trata como message descriptiva (representa stage del FSM)

## Limitaciones de v1

  - No interpola variables tipo `{price}` en los textos (TODO próxima iter)
  - El `condition` evalúa solo igualdad simple `var == 'literal'`
  - El `delay` no espera realmente (solo log)
  - No hay loop guard — si el flow tiene un ciclo infinito de mensajes sin
    branch_response, va a iterar MAX_NODES_PER_TURN y cortar.
"""

import json
import logging
import random
from typing import Any

from sqlalchemy.orm import Session

from app.models.agent_flow import AgentFlow
from app.models.ai import Conversation, Message
from app.models.sales_session import SalesSession
from app.models.store import Store
from app.services.intent_extractor import extract as extract_intent

logger = logging.getLogger(__name__)

MAX_NODES_PER_TURN = 20  # límite de hops por turno para evitar loops infinitos
NOTEBOOK_FLOW_KEY = "_flow_state"  # clave en notebook donde guardamos el estado


# ════════════════════════════════════════════════════════════════════
#  Helpers de estado (persistencia en notebook)
# ════════════════════════════════════════════════════════════════════

def _get_flow_state(session: SalesSession) -> dict:
    """Lee el estado del flow desde el notebook (current_node_id, etc.)."""
    nb = session.get_notebook()
    return nb.get(NOTEBOOK_FLOW_KEY, {}) or {}


def _set_flow_state(session: SalesSession, state: dict) -> None:
    """Persiste el estado del flow en el notebook."""
    nb = session.get_notebook()
    nb[NOTEBOOK_FLOW_KEY] = state
    session.set_notebook(nb)


def _save_collected(session: SalesSession, field: str, value: str) -> None:
    """Guarda un dato recolectado en notebook.customer."""
    nb = session.get_notebook()
    cust = nb.get("customer", {}) or {}
    cust[field] = value.strip()
    nb["customer"] = cust
    session.set_notebook(nb)


# ════════════════════════════════════════════════════════════════════
#  Helpers de grafo
# ════════════════════════════════════════════════════════════════════

class _FlatFlow:
    """Vista aplanada de un AgentFlow: los stages con sub-flujo se expanden
    inline para que el executor recorra un único grafo. Expone la misma API
    que AgentFlow (nodes_list / edges_list) para reusar el resto del código."""

    def __init__(self, nodes: list[dict], edges: list[dict]):
        self._nodes = nodes
        self._edges = edges

    def nodes_list(self) -> list[dict]:
        return self._nodes

    def edges_list(self) -> list[dict]:
        return self._edges


def _flatten(flow: AgentFlow) -> _FlatFlow:
    """
    Expande los stages con sub-flujo en un grafo plano.

    Por cada stage S con subflow {nodes, edges}:
      - Las edges que entraban a S ahora entran al nodo de ENTRADA del subflow.
      - Las edges que salían de S ahora salen del/los nodo(s) de SALIDA del subflow.
      - Si el stage no tiene subflow, se trata como passthrough (entrada→salida directo).
    """
    root_nodes = flow.nodes_list()
    root_edges = flow.edges_list()

    flat_nodes: list[dict] = []
    flat_edges: list[dict] = []
    # mapeo stage_id → (entry_node_id, [exit_node_ids])
    stage_io: dict[str, tuple[str | None, list[str]]] = {}

    for n in root_nodes:
        if n.get("type") == "stage":
            sub = (n.get("data") or {}).get("subflow") or {}
            sub_nodes = sub.get("nodes") or []
            sub_edges = sub.get("edges") or []
            if not sub_nodes:
                # Stage sin sub-flujo (modelo plano): es un nodo normal,
                # passthrough en ejecución. Lo dejamos tal cual en el grafo.
                flat_nodes.append(n)
                continue
            # entry = nodo sin edges entrantes dentro del subflow
            targets = {e.get("target") for e in sub_edges}
            entries = [sn["id"] for sn in sub_nodes if sn["id"] not in targets]
            entry = entries[0] if entries else sub_nodes[0]["id"]
            # exits = nodos sin edges salientes
            sources = {e.get("source") for e in sub_edges}
            exits = [sn["id"] for sn in sub_nodes if sn["id"] not in sources]
            if not exits:
                exits = [sub_nodes[-1]["id"]]
            stage_io[n["id"]] = (entry, exits)
            flat_nodes.extend(sub_nodes)
            flat_edges.extend(sub_edges)
        else:
            flat_nodes.append(n)

    # Reconectar las edges del root respetando los entry/exit de cada stage
    for e in root_edges:
        src = e.get("source")
        tgt = e.get("target")
        # Resolver source: si era un stage, sale desde sus exits
        src_points = [src]
        if src in stage_io:
            entry, exits = stage_io[src]
            src_points = exits if exits else ([entry] if entry else [])
        # Resolver target: si era un stage, entra a su entry
        tgt_point = tgt
        if tgt in stage_io:
            entry, exits = stage_io[tgt]
            tgt_point = entry
            if tgt_point is None:
                # stage passthrough sin subflow → saltar al siguiente del stage
                # (se resolverá en cascada si hay otro stage; simplificación: omitir)
                continue
        if tgt_point is None:
            continue
        for sp in src_points:
            if sp is None:
                continue
            flat_edges.append({
                "id": f"flat-{sp}-{tgt_point}",
                "source": sp,
                "target": tgt_point,
                "sourceHandle": e.get("sourceHandle"),
            })

    return _FlatFlow(flat_nodes, flat_edges)


def _index_nodes(flow) -> dict[str, dict]:
    return {n["id"]: n for n in flow.nodes_list()}


def _outgoing_edges(flow, node_id: str) -> list[dict]:
    return [e for e in flow.edges_list() if e.get("source") == node_id]


def _next_node_id(flat, node_id: str, source_handle: str | None = None) -> str | None:
    """Devuelve el ID del siguiente nodo siguiendo la primera edge que sale.
    Si source_handle se especifica, busca la edge con ese handle puntualmente."""
    edges = _outgoing_edges(flow, node_id)
    if source_handle is not None:
        for e in edges:
            if e.get("sourceHandle") == source_handle:
                return e.get("target")
        return None
    if not edges:
        return None
    return edges[0].get("target")


def _find_trigger_for_intent(flow, intent: str) -> str | None:
    """Busca el trigger node cuyo data.intent matchea. Fallback a 'any' si no hay match exacto."""
    nodes = flow.nodes_list()
    triggers = [n for n in nodes if n.get("type") == "trigger"]
    # 1) match exacto
    for t in triggers:
        if (t.get("data") or {}).get("intent") == intent:
            return t["id"]
    # 2) fallback al trigger 'any' (cualquier mensaje)
    for t in triggers:
        if (t.get("data") or {}).get("intent") == "any":
            return t["id"]
    # 3) primer trigger si no hay nada mejor
    return triggers[0]["id"] if triggers else None


# ════════════════════════════════════════════════════════════════════
#  Clasificador de intent del mensaje del cliente
# ════════════════════════════════════════════════════════════════════

# Mapea las flags del intent_extractor a las labels del flow editor.
def _classify_message_intent(user_message: str) -> str:
    """Devuelve un intent del catálogo del editor (greeting/price/stock/...)
    basándose en el intent_extractor existente."""
    intent_obj = extract_intent(user_message)
    if intent_obj.wants_human:
        return "wants_human"
    if intent_obj.wants_to_proceed:
        return "wants_to_buy"
    if intent_obj.needs_price_info:
        return "price"
    if intent_obj.needs_stock_check:
        return "stock"
    if intent_obj.needs_discounts:
        return "discount"
    if intent_obj.needs_catalog_overview:
        return "catalog"
    # Heurística mínima para "saludo" porque el intent_extractor no lo modela explícito
    low = (user_message or "").lower().strip()
    if any(g in low for g in ("hola", "buenas", "buen día", "buen dia", "buenos días", "hi", "hey")):
        return "greeting"
    return "any"


# ════════════════════════════════════════════════════════════════════
#  Ejecutor principal
# ════════════════════════════════════════════════════════════════════

def run_flow_turn(
    db: Session,
    store: Store,
    flow: AgentFlow,
    conversation: Conversation,
    session: SalesSession,
    user_message: str,
) -> dict:
    """
    Ejecuta UN turno del flow en respuesta al mensaje del cliente.

    Returns:
      {
        "response": str | None,   # texto a enviar al cliente
        "pending_media": [],
        "stage": str,             # último stage_name visitado (para compat con runtime)
        "escalated": bool,        # True si terminó en escalate
      }
    """
    # Aplanar: expandir stages con sub-flujo en un grafo único recorrible.
    flat = _flatten(flow)

    state = _get_flow_state(session)
    nodes_idx = _index_nodes(flat)
    response_parts: list[str] = []
    escalated = False
    last_stage_name = session.current_stage or "incoming"

    # Persistir el mensaje del usuario primero
    db.add(Message(conversation_id=conversation.id, role="user", content=user_message))

    current_id: str | None = state.get("current_node_id")
    awaiting: str | None = state.get("awaiting")  # 'branch_response' | 'collect_data' | None

    # ── A) NO hay nodo actual → encontrar trigger por intent del mensaje ──
    if not current_id:
        intent = _classify_message_intent(user_message)
        trigger_id = _find_trigger_for_intent(flat, intent)
        if not trigger_id:
            logger.warning(f"[flow-exec] flow {flow.id} sin triggers — escalando")
            response_parts.append("Te paso con un humano.")
            _mark_escalated(db, conversation, "Flow sin triggers configurados")
            _set_flow_state(session, {})
            db.commit()
            return _build_result(response_parts, last_stage_name, escalated=True)
        # Arrancar desde el trigger (avanzar al siguiente)
        current_id = _next_node_id(flat, trigger_id)
        awaiting = None

    # ── B) HAY nodo actual + awaiting → procesar la respuesta del cliente ──
    elif awaiting == "branch_response":
        node = nodes_idx.get(current_id)
        if node and node.get("type") == "branch_response":
            intent = _classify_message_intent(user_message)
            branches = (node.get("data") or {}).get("branches", [])
            picked = None
            # 1) match exacto de intent
            for b in branches:
                if b.get("intent") == intent:
                    picked = b
                    break
            # 2) fallback a la rama 'any'
            if not picked:
                for b in branches:
                    if b.get("intent") == "any":
                        picked = b
                        break
            if picked:
                current_id = _next_node_id(flat, current_id, source_handle=picked["id"])
                awaiting = None
            else:
                # Sin rama matching: stay y pedir aclaración
                response_parts.append("Disculpá, no te entendí bien. ¿Podés repetirlo?")
                db.commit()
                return _build_result(response_parts, last_stage_name)

    elif awaiting == "collect_data":
        node = nodes_idx.get(current_id)
        if node and node.get("type") == "collect_data":
            field = (node.get("data") or {}).get("field", "extra")
            _save_collected(session, field, user_message)
            current_id = _next_node_id(flat, current_id)
            awaiting = None

    elif awaiting == "wait":
        # Estábamos esperando (cliente/proveedor/pago). Llegó un mensaje →
        # consideramos cumplida la espera y avanzamos al siguiente nodo.
        current_id = _next_node_id(flat, current_id)
        awaiting = None

    # ── C) Ejecutar nodos en cadena ──
    hops = 0
    while current_id and hops < MAX_NODES_PER_TURN:
        hops += 1
        node = nodes_idx.get(current_id)
        if not node:
            logger.warning(f"[flow-exec] referencia a node inexistente: {current_id}")
            break
        node_type = node.get("type")
        data = node.get("data") or {}

        if node_type == "trigger":
            current_id = _next_node_id(flat, current_id)
            continue

        if node_type == "message":
            variants = data.get("variants") or ([data["text"]] if data.get("text") else [])
            if variants:
                response_parts.append(random.choice(variants))
            current_id = _next_node_id(flat, current_id)
            continue

        if node_type == "stage":
            # En v1, un stage node se trata como un placeholder descriptivo —
            # el agente real ya tiene esa lógica en el sistema de FSM. Solo
            # actualizamos last_stage_name para tracking y avanzamos.
            stage_name = data.get("stage_name")
            if stage_name:
                last_stage_name = stage_name
                session.current_stage = stage_name
            current_id = _next_node_id(flat, current_id)
            continue

        if node_type == "branch_response":
            # Pausamos acá: necesitamos la respuesta del cliente.
            awaiting = "branch_response"
            break

        if node_type == "condition":
            # Evaluación super simple: ver si data.condition contiene un
            # campo del notebook con valor truthy. Ej: 'customer.has_history'
            cond = data.get("condition", "")
            is_yes = _eval_condition_simple(cond, session)
            handle = "yes" if is_yes else "no"
            current_id = _next_node_id(flat, current_id, source_handle=handle)
            continue

        if node_type == "tool_call":
            # En v1: log + nota textual. El llamado real a tools queda como
            # TODO porque necesita integración con agent_tools y context.
            tool_name = data.get("tool_name", "?")
            response_parts.append(f"[Consultando {tool_name}…]")
            logger.info(f"[flow-exec] tool_call {tool_name} (no ejecutado en v1)")
            current_id = _next_node_id(flat, current_id)
            continue

        if node_type == "collect_data":
            prompt = data.get("prompt") or "¿Me podés dar ese dato?"
            response_parts.append(prompt)
            awaiting = "collect_data"
            break

        if node_type == "escalate":
            reason = data.get("reason", "Cliente requiere atención humana")
            _mark_escalated(db, conversation, reason)
            response_parts.append("Te conecto con un vendedor del equipo en unos minutos.")
            escalated = True
            current_id = None  # terminal
            break

        if node_type == "delay":
            # No esperamos en v1
            current_id = _next_node_id(flat, current_id)
            continue

        if node_type == "rule":
            # Las reglas son declarativas: el agente las respeta, no son un paso
            # ejecutable. Solo avanzamos. (En el futuro, inyectar al prompt.)
            current_id = _next_node_id(flat, current_id)
            continue

        if node_type == "wait":
            # Pausa esperando un evento externo (cliente/proveedor/pago/delivery).
            # En v1 no hay timers reales: pausamos hasta el próximo mensaje.
            # Si on_timeout=escalate y no hay integración, dejamos esperando
            # (el siguiente mensaje del cliente reanuda — ver sección B awaiting='wait').
            awaiting = "wait"
            break

        # Tipo desconocido: avanzar sin hacer nada
        logger.warning(f"[flow-exec] tipo de nodo desconocido: {node_type}")
        current_id = _next_node_id(flat, current_id)

    # ── D) Persistir estado y respuesta ──
    new_state = {"current_node_id": current_id, "awaiting": awaiting}
    _set_flow_state(session, new_state)

    response_text = "\n\n".join(p for p in response_parts if p).strip() or None
    if response_text:
        db.add(Message(conversation_id=conversation.id, role="assistant", content=response_text))

    db.commit()
    return _build_result(response_parts, last_stage_name, escalated=escalated)


# ════════════════════════════════════════════════════════════════════
#  Helpers internos
# ════════════════════════════════════════════════════════════════════

def _build_result(parts: list[str], stage: str, escalated: bool = False) -> dict:
    text = "\n\n".join(p for p in parts if p).strip() or None
    return {
        "response": text,
        "pending_media": [],
        "stage": stage,
        "escalated": escalated,
    }


def _mark_escalated(db: Session, conversation: Conversation, reason: str) -> None:
    """Pausa el agente y marca la conversación pendiente de asignación de seller."""
    conversation.agent_paused = True
    conversation.needs_seller_assignment = True
    conversation.handoff_summary = json.dumps({"reason": reason})
    db.add(conversation)


def _eval_condition_simple(cond: str, session: SalesSession) -> bool:
    """Evalúa una expresión muy simple del estilo `customer.email != ''` contra el notebook.

    Solo soporta:
      - `var == 'literal'`
      - `var != 'literal'`
      - `var` (truthy check)
    Cualquier otra cosa devuelve False.
    """
    cond = (cond or "").strip()
    if not cond:
        return False
    nb = session.get_notebook()

    def _resolve(path: str) -> Any:
        cur: Any = nb
        for part in path.split("."):
            if isinstance(cur, dict):
                cur = cur.get(part)
            else:
                return None
        return cur

    try:
        if "==" in cond:
            left, right = [s.strip() for s in cond.split("==", 1)]
            right = right.strip("'\"")
            return str(_resolve(left) or "") == right
        if "!=" in cond:
            left, right = [s.strip() for s in cond.split("!=", 1)]
            right = right.strip("'\"")
            return str(_resolve(left) or "") != right
        return bool(_resolve(cond))
    except Exception:
        return False
