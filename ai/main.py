from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import random
import google.generativeai as genai
from pydantic import BaseModel
from rapidfuzz import process
from unidecode import unidecode
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import numpy as np
import yake
import os
import json
import re


app = FastAPI(title="TalkClass AI", version="0.1.0")

sentiment = SentimentIntensityAnalyzer()
keyword_extractor = yake.KeywordExtractor(lan="pt", n=1, top=12, dedupLim=0.9, windowsSize=2)

GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
# Permite desligar o uso do Gemini no cálculo de keywords/heatmap para evitar atrasos/timeouts.
USE_GEMINI_KEYWORDS = os.environ.get("USE_GEMINI_KEYWORDS", "false").lower() == "true"
ALLOWED_ORIGINS = [
    o.strip().rstrip("/")
    for o in os.environ.get("ALLOWED_ORIGINS", "").split(",")
    if o.strip()
]

if ALLOWED_ORIGINS:
    cors_origins = ALLOWED_ORIGINS
else:
    cors_origins = ["http://localhost:5174", "http://localhost:8000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

if GEMINI_KEY:
    genai.configure(api_key=GEMINI_KEY)


STOPWORDS = {
    "a",
    "o",
    "os",
    "as",
    "de",
    "da",
    "do",
    "das",
    "dos",
    "e",
    "é",
    "em",
    "no",
    "na",
    "nos",
    "nas",
    "um",
    "uma",
    "uns",
    "umas",
    "para",
    "por",
    "com",
    "sem",
    "ao",
    "à",
    "aos",
    "às",
    "que",
    "se",
    "ser",
    "tem",
    "têm",
    "ter",
    "foi",
    "era",
    "são",
    "está",
    "estão",
    "como",
    "mais",
    "menos",
    "muito",
    "muita",
    "muitos",
    "muitas",
    "pouco",
    "pouca",
    "poucos",
    "poucas",
    "já",
    "também",
    "entre",
    "até",
    "quando",
    "onde",
    "porque",
    "pois",
    "per",
    "sobre",
    "sob",
    "lhe",
    "lhes",
    "me",
    "te",
    "vai",
    "depois",
    "antes",
    "agora",
    "hoje",
    "ontem",
    "amanhã",
    "pra",
    "pro",
    "q",
    "pq",
    "vc",
    "vcs",
    "ok",
    "bom",
    "boa",
    "ruim",
}

# Palavras que forçam classificação negativa se aparecerem no texto.
NEG_HINTS = {
    "ruim",
    "pior",
    "horrivel",
    "horrível",
    "péssimo",
    "pessimo",
    "barulho",
    "barulhento",
    "quebrado",
    "demora",
    "lento",
    "atraso",
    "sujo",
    "lotado",
    "problema",
    "falha",
    "defeito",
    "insatisfeito",
}

# Palavras que devem sempre ir para o bucket negativo mesmo em textos neutros/positivos.
KW_FORCE_NEG = {
    "barulho",
    "barulhento",
    "barulhenta",
    "barulhentas",
    "barulhentos",
    "ruido",
    "ruídos",
    "ruidos",
    "ruidoso",
    "ruidosa",
    "pior",
    "piorar",
    "horrivel",
    "horrível",
    "pessimo",
    "péssimo",
    "quebrado",
    "quebrados",
    "lento",
    "demora",
    "atraso",
    "lotado",
    "sujo",
    "falha",
    "falhas",
    "defeito",
    "defeituoso",
    "precisa",
    "precisar",
    "melhorar",
    "melhoria",
    "sinalizacao",
    "sinalização",
    "padronizar",
    "padronizacao",
}

# Palavras a serem ignoradas no bucket positivo (caso apareçam só entram no negativo ou são descartadas).
KW_EXCLUDE_POS = {
    "precisa",
    "melhorar",
    "sinalizacao",
    "sinalização",
    "padronizar",
    "padronizacao",
    "barulho",
    "barulhento",
    "barulhentas",
    "barulhenta",
    "ruido",
}


# ---------- MODELOS ----------
class FeedbackText(BaseModel):
    id: str
    text: str
    week: str
    categoryId: Optional[str] = None


class KeywordRequest(BaseModel):
    texts: List[FeedbackText]
    top: int = 40
    min_freq: int = 1


class HeatItem(BaseModel):
    week: str
    keyword: str
    total: int
    score: float
    categoryId: Optional[str] = None


class KeywordResponse(BaseModel):
    pos: List[HeatItem]
    neg: List[HeatItem]


class SeriesPoint(BaseModel):
    bucket: str
    avg: Optional[float] = None
    count: Optional[int] = None
    total: Optional[int] = None


class TopicPolarity(BaseModel):
    topic: str
    neg: float
    neu: float
    pos: float
    pneg: float

class WorstQuestion(BaseModel):
    question: str
    avg: float
    total: int


class AssistantContext(BaseModel):
    filters: Dict[str, str] = {}
    kpis: Dict[str, float] = {}
    series: List[SeriesPoint] = []
    volume: List[SeriesPoint] = []
    topics: List[TopicPolarity] = []
    words_neg: List[HeatItem] = []
    words_pos: List[HeatItem] = []
    worst_questions: List[WorstQuestion] = []


class AssistantRequest(BaseModel):
    question: str
    context: AssistantContext


class AssistantResponse(BaseModel):
    answer: str
    highlights: List[str]
    suggestions: List[str]
    filters: Dict[str, str] = {}


class FeedbackAiResult(BaseModel):
    id: str
    sentiment: str
    score01: float
    keywords: List[str] = []
    summary: Optional[str] = None


# ---------- HELPERS ----------
def normalize(text: str) -> str:
    return unidecode((text or "").lower().strip())


def split_keywords(text: str) -> List[str]:
    # fallback YAKE extractor
    if not text or len(text.strip()) < 3:
        return []
    kws = []
    try:
        kws = [normalize(k) for k, _ in keyword_extractor.extract_keywords(text)]
    except Exception:
        kws = []
    out = []
    for kw in kws:
        if len(kw) < 3:
            continue
        if kw in STOPWORDS:
            continue
        out.append(kw)
    return out


def compute_sentiment(text: str) -> float:
    res = sentiment.polarity_scores(text or "")
    return float(res.get("compound", 0.0))


def is_negative_hint(text: str) -> bool:
    t = normalize(text)
    return any(h in t for h in NEG_HINTS)


def choose_variant(options: List[str], seed: str) -> str:
    """Escolhe uma variação estável baseada no hash da pergunta para evitar respostas idênticas."""
    if not options:
        return ""
    idx = abs(hash(seed or "")) % len(options)
    return options[idx]


def detect_focus(question: str) -> Dict[str, bool]:
    """Identifica intenção principal para ajustar tom/ênfase da resposta local."""
    q = normalize(question)
    def has_any(keywords: List[str]) -> bool:
        return any(k in q for k in keywords)

    return {
        "actions": has_any(["ação", "acoes", "melhorar", "plano", "fazer", "recomenda"]),
        "trend": has_any(["tend", "evolu", "melhorou", "piorou", "vari"]),
        "volume": has_any(["volume", "quant", "qtd", "número", "numero"]),
        "nps": has_any(["nps", "promoter"]),
        "negative": has_any(["pior", "ruim", "crítico", "critico", "negat"]),
        "positive": has_any(["melhor", "bom", "positivo", "elogio"]),
        "keywords": has_any(["palavra", "keyword", "termo", "palavras"]),
        "topics": has_any(["categoria", "área", "area", "tópico", "topico", "pergunta", "questão", "questao"]),
        "alerts": has_any(["alerta", "risco", "evas", "crítico", "critico"]),
    }


GREETINGS = {
    "oi",
    "ola",
    "olá",
    "eai",
    "e aí",
    "opa",
    "fala",
    "bom dia",
    "boa tarde",
    "boa noite",
    "tudo bem",
    "tudo bom",
    "td bem",
    "boa noite, tudo bem",
    "boa tarde, tudo bem",
    "bom dia, tudo bem",
}


def is_greeting(question: str) -> bool:
    q = normalize(question)
    if not q:
        return False
    stripped = q.replace("?", "").replace("!", "").strip()
    if stripped in GREETINGS:
        return True
    # saudações curtas com até 3 palavras
    return len(stripped.split()) <= 4 and any(g in stripped for g in GREETINGS)


def infer_intent(question: str) -> str:
    """Retorna a intenção dominante para guiar prompt/resposta."""
    q = normalize(question)
    if is_greeting(q):
        return "saudacao"
    intents = [
        ("resumo", ["resumo", "geral", "panorama", "visao", "visão geral", "últimos", "ultimos", "30 dias"]),
        ("nps", ["nps", "satisfacao", "satisfação", "nota", "promoter", "score"]),
        ("keywords", ["palavra", "keyword", "termo", "nuvem", "heatmap", "coment", "texto"]),
        ("topics", ["categoria", "topico", "tópico", "pergunta", "questao", "questão", "area", "área"]),
        ("actions", ["acao", "ação", "plano", "prioridade", "resolver", "melhorar", "recomendacao", "recomendação", "o que fazer", "como corrigir", "planos de ação"]),
    ]
    for name, keys in intents:
        if any(k in q for k in keys):
            return name
    return "generic"


def call_gemini_batch(texts: List[FeedbackText]) -> List[FeedbackAiResult]:
    if not GEMINI_KEY or not texts:
        return []
    model = genai.GenerativeModel("gemini-2.5-flash-lite")
    # monta payload pequeno para instruir saída JSON
    rows = [{"id": t.id, "text": t.text} for t in texts]
    prompt = (
        "Você é um modelo que processa feedbacks curtos em português.\n"
        "Receba uma lista JSON de objetos {id,text} e devolva um JSON compacto sem texto extra:\n"
        "[{id, sentiment:'pos|neu|neg', score01: number between 0 and 1,"
        " keywords:[top palavras-chave sem stopwords, até 4], summary: resumo de até 12 palavras}]\n"
        "score01 indica positividade (0=negativo, 0.5=neutro, 1=positivo)."
    )
    try:
        resp = model.generate_content(
            [
                # Gemini requer apenas roles 'user' ou 'model'. Passamos tudo como 'user'.
                {"role": "user", "parts": [{"text": "Saída apenas JSON válido."}]},
                {"role": "user", "parts": [{"text": prompt}, {"text": json.dumps(rows, ensure_ascii=False)}]},
            ],
            generation_config={"temperature": 0.2, "top_p": 0.9},
        )
        text = resp.candidates[0].content.parts[0].text if resp.candidates else ""
        data = json.loads(text)
        out: List[FeedbackAiResult] = []
        for item in data:
            out.append(
                FeedbackAiResult(
                    id=str(item.get("id", "")),
                    sentiment=str(item.get("sentiment", "neu")).lower(),
                    score01=float(item.get("score01", 0.5)),
                    keywords=[normalize(k) for k in item.get("keywords", []) if normalize(k) and normalize(k) not in STOPWORDS][:4],
                    summary=item.get("summary"),
                )
            )
        return out
    except Exception:
        return []


def aggregate_keywords(payload: KeywordRequest) -> KeywordResponse:
    """Extrai keywords positivas/negativas com regras de sentimento e filtragem de termos neutros."""

    positive_terms = {
        "empatia": 0.8,
        "respeito": 0.8,
        "ajuda": 0.6,
        "apoio": 0.6,
        "acolhimento": 0.75,
        "rapido": 0.65,
        "rapida": 0.65,
        "agil": 0.65,
        "agilidade": 0.7,
        "clareza": 0.65,
        "claro": 0.6,
        "organizado": 0.65,
        "organizada": 0.65,
        "disponivel": 0.6,
        "disponibilidade": 0.6,
        "atencioso": 0.7,
        "atenciosa": 0.7,
        "compreensivo": 0.65,
        "bem explicado": 0.7,
        "bom atendimento": 0.7,
        "escuta": 0.6,
        "cuidado": 0.7,
    }

    negative_terms_strong = {
        "preconceito": -0.85,
        "racismo": -0.9,
        "discriminacao": -0.85,
        "discriminação": -0.85,
        "assédio": -0.9,
        "assedio": -0.9,
        "violencia": -0.9,
        "violência": -0.9,
    }

    negative_terms = {
        "problema": -0.8,
        "demora": -0.6,
        "demorado": -0.6,
        "demorada": -0.6,
        "lento": -0.6,
        "lenta": -0.6,
        "atraso": -0.65,
        "atrasos": -0.65,
        "descaso": -0.7,
        "falha": -0.65,
        "erro": -0.65,
        "desorganizado": -0.6,
        "desorganizada": -0.6,
        "lotado": -0.6,
        "barulho": -0.6,
        "inseguranca": -0.7,
        "falta de retorno": -0.75,
        "sem resposta": -0.7,
        "falta": -0.5,
        "cancelar": -0.5,
        "trancar": -0.55,
        "abandono": -0.65,
        "sair": -0.45,
    }

    neutral_terms = {
        "curso",
        "aulas",
        "instituicao",
        "universidade",
        "turma",
        "aluno",
        "alunos",
        "professor",
        "profa",
        "coordenacao",
        "coordenador",
        "coordenadora",
        "email",
        "e-mail",
        "whatsapp",
        "telefone",
        "site",
        "portal",
        "plataforma",
        "acoes",
        "acoes",
        "politicas",
        "politica",
        "medidas",
        "situacao",
        "caso",
        "processo",
        "area",
        "areas",
        "sinto",
        "vejo",
        "considerar",
        "houver",
        "acontecer",
        "usar",
    }

    negation_tokens = {"sem", "falta", "falta de", "nao", "não"}

    def tokenize(txt: str) -> List[str]:
        return re.findall(r"[a-zà-ú]{3,}", txt, flags=re.IGNORECASE)

    def extract_from_text(text: str) -> List[Tuple[str, float]]:
        if not text or len(text.strip()) < 3:
            return []
        norm = normalize(text)
        tokens = tokenize(norm)
        joined = " ".join(tokens)
        found: List[Tuple[str, float]] = []

        # Negação explícita: "falta de X" para termos positivos -> negativa
        for pkw, pscore in positive_terms.items():
            if f"falta de {pkw}" in norm or f"sem {pkw}" in norm:
                found.append((f"falta de {pkw}", min(-0.05, -abs(pscore) * 1.0)))

        # Positivos
        for pkw, pscore in positive_terms.items():
            if pkw in neutral_terms:
                continue
            if any(ntok in norm for ntok in ("falta de " + pkw, "sem " + pkw)):
                continue
            if pkw in norm:
                found.append((pkw, max(0.05, pscore)))

        # Negativos fortes
        for nkw, nscore in negative_terms_strong.items():
            if nkw in norm:
                found.append((nkw, nscore))

        # Negativos moderados
        for nkw, nscore in negative_terms.items():
            if nkw in norm:
                found.append((nkw, nscore))

        # Remove neutros e duplicatas mantendo o score mais intenso
        scored: Dict[str, float] = {}
        for kw, sc in found:
            if kw in neutral_terms:
                continue
            prev = scored.get(kw)
            if prev is None or abs(sc) > abs(prev):
                scored[kw] = sc

        return [(kw, sc) for kw, sc in scored.items() if abs(sc) >= 0.05]

    agg: Dict[tuple, Dict[str, float]] = defaultdict(lambda: {"count": 0, "score_sum": 0.0})

    for t in payload.texts:
        kws = extract_from_text(t.text)
        if not kws:
            continue
        for kw, sc in kws:
            key = (t.week, t.categoryId, kw)
            agg[key]["count"] += 1
            agg[key]["score_sum"] += sc

    pos_items: List[HeatItem] = []
    neg_items: List[HeatItem] = []
    for (week, cat, kw), data in agg.items():
        if data["count"] < payload.min_freq:
            continue
        avg_score = data["score_sum"] / max(1.0, data["count"])
        target = pos_items if avg_score > 0 else neg_items
        target.append(
            HeatItem(
                week=week,
                categoryId=cat,
                keyword=kw,
                total=int(data["count"]),
                score=float(avg_score),
            )
        )

    pos_items.sort(key=lambda i: (-i.total, -i.score, i.keyword))
    neg_items.sort(key=lambda i: (-i.total, i.score, i.keyword))

    return KeywordResponse(pos=pos_items[: payload.top], neg=neg_items[: payload.top])


def describe_trend(series: List[SeriesPoint]) -> str:
    if len(series) < 2:
        return "sem variação perceptível"
    values = [s.avg for s in series if s.avg is not None]
    if len(values) < 2:
        return "sem dados suficientes"
    x = np.arange(len(values))
    y = np.array(values, dtype=float)
    slope = float(np.polyfit(x, y, 1)[0])
    delta = values[-1] - values[0]
    if slope > 0.01:
        return f"tendência de alta (+{delta:.2f} no período)"
    if slope < -0.01:
        return f"tendência de queda ({delta:.2f} no período)"
    return "estabilidade"


def pick_top_topics(topics: List[TopicPolarity]) -> List[str]:
    if not topics:
        return []
    ordered = sorted(topics, key=lambda t: (-t.pneg, -t.neg))
    return [f"{t.topic} (neg={t.pneg:.1f}%)" for t in ordered[:3]]


def summarize_keywords(items: List[HeatItem], label: str) -> Optional[str]:
    if not items:
        return None
    totals = Counter()
    for it in items:
        totals[it.keyword] += it.total
    top = totals.most_common(4)
    joined = ", ".join([f"{kw} ({cnt})" for kw, cnt in top])
    return f"{label}: {joined}"


def pick_volume_spikes(volume: List[SeriesPoint]) -> Optional[str]:
    if not volume:
        return None
    data = [(v.bucket, v.total or 0) for v in volume]
    if not data:
        return None
    buckets, vals = zip(*data)
    arr = np.array(vals, dtype=float)
    if len(arr) == 0:
        return None
    idx = int(np.argmax(arr))
    return f"Maior volume em {buckets[idx]} ({int(arr[idx])} feedbacks)"


def top_keyword(items: List[HeatItem]) -> Optional[Tuple[str, int]]:
    """Retorna keyword mais frequente (kw, total)."""
    if not items:
        return None
    totals = Counter()
    for it in items:
        totals[it.keyword] += it.total
    kw, cnt = totals.most_common(1)[0]
    return kw, int(cnt)


def top_topic(topics: List[TopicPolarity]) -> Optional[TopicPolarity]:
    if not topics:
        return None
    return sorted(topics, key=lambda t: (t.pneg if t.pneg is not None else 0, t.neg), reverse=True)[0]


def dedupe_keep_order(items: List[str]) -> List[str]:
    seen = set()
    out = []
    for it in items:
        if it in seen:
            continue
        seen.add(it)
        out.append(it)
    return out


def format_action_item(item: Any) -> str:
    """Converte dicionários de ação do Gemini em texto legível; fallback para string."""
    if isinstance(item, dict):
        what = item.get("what_to_do") or item.get("what") or ""
        where = item.get("where") or ""
        deadline = item.get("suggested_deadline") or item.get("deadline") or ""
        indicator = item.get("success_indicator") or item.get("indicator") or ""
        parts: List[str] = []
        if what:
            parts.append(what)
        meta: List[str] = []
        if where:
            meta.append(f"onde: {where}")
        if deadline:
            meta.append(f"prazo: {deadline}")
        if indicator:
            meta.append(f"indicador: {indicator}")
        if meta:
            parts.append(f"({'; '.join(meta)})")
        return " ".join(parts).strip()
    return str(item)


def parse_json_tolerant(text: str) -> Optional[dict]:
    """Tenta extrair JSON mesmo se vier com codefence."""
    if not text:
        return None
    cleaned = text.strip()
    # remove ```json ... ``` ou ``` ... ```
    if cleaned.startswith("```"):
        parts = cleaned.split("```")
        if len(parts) >= 2:
            cleaned = parts[1].strip()
    # tenta direto
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    # tenta substring entre a primeira { e a última }
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        snippet = cleaned[start : end + 1]
        try:
            return json.loads(snippet)
        except Exception:
            pass
    # tenta regex para o primeiro bloco { ... }
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        snippet = match.group(0)
        try:
            return json.loads(snippet)
        except Exception:
            pass
    return None


def build_greeting_reply(ctx: AssistantContext, question: str) -> AssistantResponse:
    templates = [
        "Oi! Sou o assistente do TalkClass. Posso explicar NPS, categorias ou palavras críticas. O que você quer ver?",
        "Olá! Posso te ajudar a ler os gráficos e comentários (NPS, tópicos, palavras). Por onde começamos?",
        "E aí! Estou pronto para te mostrar categorias críticas ou palavras mais citadas. Qual caminho prefere?",
        "Oi! Me diz se quer ver NPS, tópicos ou recomendações rápidas e eu resumo para você.",
    ]
    greeting = random.choice(templates)
    suggestions = [
        "Pergunte por NPS ou evolução de satisfação.",
        "Peça as categorias ou tópicos mais negativos.",
        "Peça palavras mais recorrentes nos feedbacks.",
    ][:2]
    return AssistantResponse(
        answer=greeting,
        highlights=["Assistente pronto para explicar NPS, categorias e comentários."],
        suggestions=suggestions[:2],
        filters=ctx.filters,
    )


def format_answer(summary: str, insights: List[str], actions: List[str], intent: str) -> str:
    """Formata com bullets e emojis leves para ficar mais conversacional."""
    summary_label = {
        "nps": "📊",
        "topics": "📌",
        "keywords": "🗂️",
        "actions": "🧭",
        "resumo": "📈",
        "generic": "💬",
    }.get(intent, "💬")

    bullet_cycle = ["•", "◦", "▪"]
    def with_bullets(items: List[str], bold: bool = False) -> List[str]:
        out = []
        for idx, it in enumerate(items):
            prefix = bullet_cycle[idx % len(bullet_cycle)]
            content = f"**{it}**" if bold else it
            out.append(f"{prefix} {content}")
        return out

    lines: List[str] = []
    if summary:
        lines.append(f"{summary_label} {summary}")
    if insights:
        if lines:
            lines.append("")  # quebra de linha clara
        lines.append("🔎 Insights:")
        lines.extend(with_bullets(insights, bold=True))
    if actions:
        if lines:
            lines.append("")
        lines.append("🛠️ Próximas ações:")
        lines.extend(with_bullets(actions))
    return "\n".join(lines).strip()


def build_answer(req: AssistantRequest) -> AssistantResponse:
    question = req.question or ""
    ctx = req.context
    intent = infer_intent(question)
    focus = detect_focus(question)

    trend = describe_trend(ctx.series)
    vol_spike = pick_volume_spikes(ctx.volume)
    neg_kw_str = summarize_keywords(ctx.words_neg, "Palavras negativas")
    pos_kw_str = summarize_keywords(ctx.words_pos, "Palavras positivas")
    neg_kw_top = top_keyword(ctx.words_neg)
    main_topic = top_topic(ctx.topics)
    worst_qs = ctx.worst_questions[:3] if ctx.worst_questions else []
    nps = ctx.kpis.get("nps")
    total_fb = ctx.kpis.get("totalFeedbacks")

    if intent == "saudacao":
        return build_greeting_reply(ctx, question)

    # Ações recomendadas heurísticas (mais específicas)
    actions: List[str] = []
    neg_words_set = {w.keyword for w in ctx.words_neg[:8]}

    def any_kw(substrs: List[str]) -> bool:
        return any(any(sub in kw for sub in substrs) for kw in neg_words_set)

    def action_from_topic(topic: Optional[TopicPolarity]) -> List[str]:
        if not topic:
            return []
        total = int(topic.neg + topic.neu + topic.pos)
        return [
            f"Para '{topic.topic}' (neg={topic.pneg:.1f}%, n={total}): rodar entrevistas curtas com alunos citando exemplos e ajustar processo específico.",
            f"Meta: elevar a nota média de '{topic.topic}' em +1.0 ponto no próximo ciclo, acompanhando semanalmente.",
        ]

    def action_from_worst_question(w: WorstQuestion) -> List[str]:
        return [
            f"Pergunta '{w.question}' (média {w.avg:.2f}, n={w.total}): abrir plano de ação com dono definido e revisar conteúdo/atendimento relacionado.",
            f"Meta: subir média de '{w.question}' para {min(w.avg + 1.0, 5.0):.1f} no próximo ciclo; aplicar pesquisa relâmpago após ajustes.",
        ]

    # Infra
    if any_kw(["móvel", "cadeira", "mesa", "infra", "sala", "ilum", "ruido", "ruído"]):
        actions.append("Infraestrutura: trocar ou consertar cadeiras/mesas citadas e revisar iluminação/ruído nas salas apontadas; prazo 30 dias.")
        actions.append("Infraestrutura: priorizar vistoria nas salas com mais menções negativas e publicar cronograma de correção.")
    # Atendimento
    if any_kw(["atendimento", "secretaria", "suporte", "monitor", "fila", "demora", "retorno"]):
        actions.append("Atendimento: criar roteiro padrão e metas de tempo de resposta; piloto de senha/agendamento em horários de pico por 2 semanas.")
        actions.append("Atendimento: coletar feedback pós-atendimento (1 pergunta) para medir queda no tempo de espera.")
    # Docência/comunicação
    if any_kw(["prof", "docente", "aula", "explica"]):
        actions.append("Docência: sessões de alinhamento com docentes citados para ajustar ritmo/clareza; revisar materiais com exemplos práticos.")
    if any_kw(["não sei", "nao sei", "não conheço", "falta informação", "pouco divulgado"]):
        actions.append("Comunicação: enviar comunicado com canais e prazos, incluir QR Codes nas áreas citadas; medir alcance em 2 semanas.")

    if main_topic and intent in {"actions", "topics", "resumo"}:
        actions.extend(action_from_topic(main_topic))
    for w in worst_qs:
        actions.extend(action_from_worst_question(w))
    if vol_spike and intent in {"actions", "resumo"}:
        actions.append(f"Volume: investigar pico em {vol_spike.split('(')[0].strip()} e aplicar ação corretiva rápida; repetir medição em 2 semanas.")

    if intent == "actions" and not actions:
        actions.append("Priorizar as categorias ou perguntas mais negativas, definir responsáveis e metas de curto prazo.")
    if intent != "generic" and not actions:
        actions.append("Agendar revisão quinzenal das áreas críticas e monitorar novos feedbacks.")

    # Sumário adaptado ao foco
    summary_parts: List[str] = []
    if intent == "nps" and nps is not None:
        summary_parts.append(f"NPS atual: {nps}.")
        summary_parts.append(f"Tendência: {trend}.")
    elif intent == "keywords" and (neg_kw_top or pos_kw_str):
        if neg_kw_top:
            kw, cnt = neg_kw_top
            summary_parts.append(f"Palavra negativa mais citada: {kw} ({cnt}x).")
        if pos_kw_str:
            summary_parts.append(f"Principais elogios: {pos_kw_str}.")
    elif intent in {"topics"} and main_topic:
        summary_parts.append(f"Tópico crítico: {main_topic.topic} com {main_topic.pneg:.1f}% de negativo.")
    elif intent == "actions" and main_topic:
        summary_parts.append(f"Tópico mais citado para ação: {main_topic.topic}.")
    elif intent == "resumo":
        if nps is not None:
            summary_parts.append(f"NPS: {nps}. {trend}.")
        if total_fb:
            summary_parts.append(f"Volume: {int(total_fb)} feedbacks.")
    elif intent == "generic":
        summary_parts.append("Me diga se quer NPS, tópicos ou palavras-chave e eu foco nisso.")

    if not summary_parts:
        summary_parts.append("Dados insuficientes para este recorte.")

    summary = choose_variant(
        [
            "{core}",
            "Visão rápida: {core}",
            "Em linha: {core}",
        ],
        question,
    ).format(core=" ".join(summary_parts))

    insights: List[str] = []
    if intent == "generic":
        insights.append("Posso detalhar NPS, tópicos críticos ou palavras recorrentes; é só pedir o foco.")
    else:
        if intent == "keywords" and neg_kw_str:
            insights.append(neg_kw_str + ".")
        if pos_kw_str and (focus.get("positive") or intent == "keywords"):
            insights.append(pos_kw_str + ".")
        if main_topic and intent in {"topics", "resumo", "actions", "generic"}:
            insights.append(f"Tópico mais crítico: {main_topic.topic} (neg={main_topic.pneg:.1f}%).")
        for w in worst_qs:
            insights.append(f"Pergunta crítica: '{w.question}' média={w.avg:.2f} (n={w.total}).")
        if vol_spike and intent in {"resumo", "nps", "topics"}:
            insights.append(f"Pico de volume: {vol_spike}.")
        if not insights and neg_kw_str:
            insights.append(neg_kw_str + ".")
        if not insights:
            insights.append("Ainda não há insights fortes com os filtros atuais.")
    insights = dedupe_keep_order(insights)
    actions_formatted = dedupe_keep_order([format_action_item(a) for a in actions])

    # Monta resposta final no formato solicitado (parágrafo + bullets)
    answer = format_answer(summary, insights[:5], actions_formatted[:3], intent)
    highlights = actions_formatted[:3] if intent == "actions" else []
    suggestions = actions_formatted[:3] if intent == "actions" else []
    return AssistantResponse(
        answer=answer + "\n\n[Origem: Fallback local]",
        highlights=highlights,
        suggestions=suggestions,
        filters=ctx.filters,
    )


def call_gemini_chat(req: AssistantRequest) -> Optional[AssistantResponse]:
    if not GEMINI_KEY:
        print("[ai] Gemini não configurada (GEMINI_API_KEY ausente).")
        return None
    question = req.question or ""
    intent = infer_intent(question)
    ctx = req.context
    if intent == "saudacao":
        return build_greeting_reply(ctx, question)

    model = genai.GenerativeModel("gemini-2.5-flash")

    def compact_series(series: List[SeriesPoint]) -> List[Dict[str, Optional[float]]]:
        return [{"bucket": s.bucket, "avg": s.avg, "count": s.count} for s in (series or [])[-12:]]

    topics = [
        {"topic": t.topic, "neg": t.neg, "neu": t.neu, "pos": t.pos, "pneg": t.pneg}
        for t in (ctx.topics or [])[:5]
    ]
    words_neg = [{"keyword": w.keyword, "total": w.total, "week": w.week} for w in (ctx.words_neg or [])[:8]]
    words_pos = [{"keyword": w.keyword, "total": w.total, "week": w.week} for w in (ctx.words_pos or [])[:6]]
    worst_q = [
        {"question": w.question, "avg": w.avg, "total": w.total}
        for w in (ctx.worst_questions or [])[:3]
    ]

    data_blob = {
        "intent": intent.upper(),
        "question": question,
        "kpis": ctx.kpis,
        "series": compact_series(ctx.series),
        "volume": compact_series(ctx.volume),
        "topics": topics,
        "words_neg": words_neg,
        "words_pos": words_pos,
        "worst_questions": worst_q,
    }

    intent_hint = {
        "resumo": "Foque em panorama geral (tendência, NPS se existir, volume, tópicos críticos).",
        "nps": "Foque em NPS, evolução e o que puxa para cima/baixo.",
        "keywords": "Foque em palavras-chave positivas/negativas mais frequentes e o que elas sugerem.",
        "topics": "Foque em categorias/tópicos/perguntas com mais negativo e cite percentuais/médias.",
        "actions": "Foque em recomendações práticas ligadas aos dados enviados: para cada tópico/pergunta/palavra negativa, proponha ações com o que fazer, onde, prazo sugerido e indicador de sucesso.",
        "generic": "Seja conciso e peça foco se faltarem dados.",
    }.get(intent, "Seja conciso e peça foco se faltarem dados.")

    prompt = (
        "Você é um assistente de dados do TalkClass. Responda em português do Brasil, tom de consultor educacional. "
        "Use SOMENTE os dados do JSON fornecido (não invente nenhum número). "
        f"Intenção inferida: {intent.upper()}. {intent_hint} "
        "Retorne APENAS um JSON válido com este formato:\n"
        '{"summary": "frase curta (1-2) contextualizada com números", '
        '"insights": ["bullet 1", "bullet 2", "..."], '
        '"actions": ["ação 1", "ação 2", "..."]}\n'
        "Regras:\n"
        "- summary deve mencionar métricas relevantes (NPS, tendência, volume) se existirem; se não houver dados, diga isso de forma concisa.\n"
        "- insights: 2 a 5 frases curtas com números (percentual negativo, volume, palavra mais citada, etc.). Varie redação, evite repetir sempre as mesmas frases.\n"
        "- actions: 2 a 4 recomendações práticas conectadas aos dados. Se faltarem dados, sugira coletar/filtrar melhor.\n"
        "- Para intent ACTIONS: gere ações específicas por tópico/pergunta/palavra negativa. Cada ação deve incluir o que fazer, onde (área ou tópico), prazo sugerido e indicador de sucesso (ex.: subir média de X para Y, reduzir negativos em %). Evite frases genéricas como 'revisar' ou 'melhorar' sem detalhar.\n"
        "- Para intent GENÉRICO sem dados fortes, peça que o usuário escolha foco (NPS, tópicos, palavras) em vez de inventar métricas.\n"
        "- Adapte o tom e o conteúdo ao intent: RESUMO/NPS/TOPICS/KEYWORDS/ACTIONS.\n"
        "- Nunca adicione texto fora do JSON. Não crie campos extras.\n"
        f"Dados de contexto (JSON): {json.dumps(data_blob, ensure_ascii=False)}"
    )
    try:
        resp = model.generate_content(
            [
                # Gemini aceita apenas 'user'/'model'; consolidamos instruções no papel de usuário.
                {"role": "user", "parts": [{"text": "Siga rigorosamente as regras e o formato solicitado."}]},
                {"role": "user", "parts": [{"text": prompt}]},
            ],
            generation_config={"temperature": 0.35, "top_p": 0.9},
        )
        if not resp or not resp.candidates:
            print("[ai] Gemini sem candidatos; fallback ativado.")
            return None
        text = ""
        data = None
        for cand in resp.candidates:
            for part in cand.content.parts:
                text_candidate = getattr(part, "text", "") or ""
                parsed = parse_json_tolerant(text_candidate)
                if parsed is not None:
                    text = text_candidate.strip()
                    data = parsed
                    break
            if data is not None:
                break
        if data is None:
            print("[ai] Gemini retornou JSON inválido; fallback local acionado.")
            return None
        summary = str(data.get("summary", "")).strip()
        insights = dedupe_keep_order([str(i).strip() for i in (data.get("insights") or []) if str(i).strip()])
        actions_raw = [a for a in (data.get("actions") or []) if str(a).strip()]
        actions = dedupe_keep_order([format_action_item(a) for a in actions_raw])

        formatted = format_answer(summary, insights[:5], actions[:4], intent)
        answer = formatted + "\n\n[Origem: Gemini]"

        print("[ai] Resposta Gemini gerada.")
        return AssistantResponse(
            answer=answer,
            highlights=[],
            suggestions=[],
            filters=req.context.filters,
        )
    except Exception as ex:
        print(f"[ai] Erro ao chamar Gemini: {ex!r}")
        return None


# ---------- ROUTES ----------
@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/keywords", response_model=KeywordResponse)
def keywords(req: KeywordRequest):
    return aggregate_keywords(req)


@app.post("/assistant", response_model=AssistantResponse)
def assistant(req: AssistantRequest):
    ai_resp = call_gemini_chat(req)
    if ai_resp:
        return ai_resp
    return build_answer(req)
