import os
import io
import re
import json
from datetime import datetime
from typing import Optional, List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel

import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

from google import genai
from google.genai import types
from supabase import create_client, Client

# =====================================================================
# 1. INICIALIZAÇÃO & CONFIGURAÇÕES
# =====================================================================
app = FastAPI(
    title="JurisPrime API Core",
    description="Motor de Inteligência Jurídica: Petições de 1º Grau, Atas e Precedentes",
    version="1.0.0"
)

# Liberação de CORS para comunicação com Next.js / Vercel
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

def get_gemini_client():
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY não configurada no servidor.")
    return genai.Client(api_key=GEMINI_API_KEY)

def get_supabase_client() -> Optional[Client]:
    if SUPABASE_URL and SUPABASE_KEY:
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    return None

# =====================================================================
# 2. PROMPTS ESPECIALIZADOS (1º GRAU & ATAS)
# =====================================================================
SUPERPROMPT_JURISPRUDENCIA_1GRAU = """
Atue como Advogado Sênior e Especialista em Direito Processual Cível Estratégico. Seu objetivo é redigir minutas de PETIÇÕES INICIAIS, CONTESTAÇÕES e PEDIDOS DE TUTELA PROVISÓRIA DE URGÊNCIA/EVIDÊNCIA (1º Grau) de altíssimo padrão técnico, exaustivas, persuasivas e prontas para protocolo (meta de 1.800 a 3.500 palavras / 5 a 8 páginas).

### 🎯 REGRA DE OURO: SOBERANIA DA ESTRATÉGIA DO ADVOGADO
1. FOCO EXCLUSIVO NO 1º GRAU E PRETENSÃO DO CLIENTE:
   - A tese jurídica, os pedidos de tutela de urgência (Art. 300 do CPC) e o quantum indenizatório almejado pelo advogado são ABSOLUTOS e VINCULANTES.

### 🛡️ BLINDAGEM ANTI-ALUCINAÇÃO E REGRAS ESTRITAS:
1. PROIBIÇÃO ABSOLUTA DE JURISPRUDÊNCIA INVENTADA:
   - É PROIBIDO CRIAR OU DEDUZIR NÚMEROS DE PROCESSOS OU EMENTAS FICTÍCIAS.
   - Utilize a busca integrada para confirmar os precedentes reais do STF, STJ e TJs.
   - Na dúvida, mencione Súmulas ou Temas Repetitivos consolidados.
2. CAUSA DE PEDIR DETALHADA (ART. 319, III DO CPC):
   - Detalhe a cronologia fática, a conduta ilícita, o nexo causal e os prejuízos experimentados.
3. TUTELA PROVISÓRIA DE URGÊNCIA (ART. 300 DO CPC):
   - Tópico estruturado com Fumus Boni Iuris, Periculum in Mora, Reversibilidade e pedido expresso de Multa Diária (Astreintes).
4. PEDIDOS CERTOS E LÍQUIDOS:
   - Rol de pedidos minucioso com valor da causa discriminado.
"""

# =====================================================================
# 3. ROTAS PRINCIPAIS (ENDPOINTS)
# =====================================================================

@app.get("/")
def health_check():
    """Verifica a saúde da API."""
    return {
        "status": "online",
        "service": "JurisPrime & AtaJur API Core",
        "timestamp": datetime.utcnow().isoformat()
    }

# --- ROTA DE ATAS (ÁUDIO) ---
@app.post("/api/ata/processar-audio")
async def processar_audio(
    audio: UploadFile = File(...),
    tipo_reuniao: str = Form("Cliente"),
    participantes: str = Form(...),
    titulo: str = Form(...)
):
    """Recebe o áudio da reunião e retorna a Ata Executiva estruturada."""
    try:
        client = get_gemini_client()
        audio_bytes = await audio.read()
        mime_type = audio.content_type or "audio/mp3"

        prompt_contexto = f"""
        Você é um assistente jurídico sênior altamente qualificado.
        Sintetize o áudio gravado em uma ATA EXECUTIVA FORMAL estruturada em Markdown.
        
        TIPO: {tipo_reuniao}
        PARTICIPANTES: {participantes}
        PAUTA: {titulo}
        
        ESTRUTURA:
        # ATA EXECUTIVA DE REUNIÃO JURÍDICA
        ## 1. DADOS GERAIS (Data, Participantes, Pauta)
        ## 2. RESUMO EXECUTIVO (Síntese dos fatos e pretensão)
        ## 3. PRINCIPAIS APONTAMENTOS & RELATOS FÁTICOS (Bullet points com datas, valores e fatos)
        ## 4. DIRETRIZES & ESTRATÉGIA PROCESSUAL (Orientações dadas)
        ## 5. PLANO DE AÇÃO & PRAZOS (Tabela: Tarefa | Responsável | Prazo)
        ## 6. CLÁUSULA DE SIGILO (Art. 7º, II da Lei 8.906/94 e LGPD)
        """

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                "Gere a Ata Executiva formal com rigor técnico."
            ],
            config=types.GenerateContentConfig(
                system_instruction=prompt_contexto,
                temperature=0.2
            )
        )
        return {"status": "success", "ata_markdown": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar áudio: {str(e)}")

# --- ROTA DE GERAÇÃO DE PEÇAS DE 1º GRAU (STREAMING SSE) ---
@app.post("/api/peticao/gerar-stream")
async def gerar_peticao_stream(
    instrucao_usuario: str = Form(...),
    arquivos: List[UploadFile] = File(None)
):
    """Gera a petição inicial ou análise jurídica em tempo real via Streaming SSE."""
    client = get_gemini_client()
    user_parts = []

    # Ingestão de múltiplos PDFs se enviados
    if arquivos:
        for arq in arquivos:
            conteudo_bytes = await arq.read()
            user_parts.append(
                types.Part.from_bytes(
                    data=conteudo_bytes,
                    mime_type="application/pdf"
                )
            )
            user_parts.append(types.Part.from_text(text=f"[Documento Anexado: {arq.filename}]"))

    user_parts.append(types.Part.from_text(text=instrucao_usuario))

    async def stream_generator():
        try:
            response_stream = client.models.generate_content_stream(
                model="gemini-2.5-flash",
                contents=[types.Content(role="user", parts=user_parts)],
                config=types.GenerateContentConfig(
                    system_instruction=SUPERPROMPT_JURISPRUDENCIA_1GRAU,
                    temperature=0.0,
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                    tools=[types.Tool(google_search=types.GoogleSearch())]
                )
            )
            for chunk in response_stream:
                if chunk.text:
                    # Formato Server-Sent Events (SSE)
                    yield f"data: {json.dumps({'text': chunk.text})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as err:
            yield f"data: {json.dumps({'error': str(err)})}\n\n"

    return StreamingResponse(stream_generator(), media_type="text/event-stream")

# --- ROTA DE EXPORTAÇÃO DOCX FORMATADO ---
class ExportDocxRequest(BaseModel):
    titulo: str
    conteudo_markdown: str

@app.post("/api/exportar-docx")
def exportar_docx(req: ExportDocxRequest):
    """Gera um arquivo .docx com formatação forense profissional (Times New Roman / ABNT)."""
    doc = docx.Document()
    
    # Configuração de Margens (Padrão Forense: Sup 3cm, Esq 3cm, Dir 2cm, Inf 2cm)
    for section in doc.sections:
        section.top_margin = Inches(1.18)
        section.bottom_margin = Inches(0.78)
        section.left_margin = Inches(1.18)
        section.right_margin = Inches(0.78)

    # Título Principal
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_title = p_title.add_run(req.titulo.upper())
    run_title.font.name = 'Times New Roman'
    run_title.font.size = Pt(14)
    run_title.font.bold = True

    # Processamento do Markdown
    for line in req.conteudo_markdown.split("\n"):
        line_clean = line.strip()
        if not line_clean:
            continue

        if line.startswith("# "):
            h = doc.add_heading(level=1)
            r = h.add_run(line[2:].strip())
            r.font.name = 'Times New Roman'
            r.font.size = Pt(13)
            r.font.bold = True
        elif line.startswith("## "):
            h = doc.add_heading(level=2)
            r = h.add_run(line[3:].strip())
            r.font.name = 'Times New Roman'
            r.font.size = Pt(12)
            r.font.bold = True
        elif line.startswith("### "):
            h = doc.add_heading(level=3)
            r = h.add_run(line[4:].strip())
            r.font.name = 'Times New Roman'
            r.font.size = Pt(12)
            r.font.bold = True
        elif line_clean.startswith(("- ", "* ")):
            p = doc.add_paragraph(style="List Bullet")
            r = p.add_run(line_clean[2:].strip())
            r.font.name = 'Times New Roman'
            r.font.size = Pt(12)
        else:
            p = doc.add_paragraph()
            p.paragraph_format.line_spacing = 1.5
            p.paragraph_format.first_line_indent = Inches(0.5)
            r = p.add_run(line_clean)
            r.font.name = 'Times New Roman'
            r.font.size = Pt(12)

    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)

    return Response(
        content=buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{req.titulo}.docx"'}
    )