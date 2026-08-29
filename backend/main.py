import os
import io
import json
import smtplib
from datetime import datetime
from email.header import Header
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel

import docx
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

from google import genai
from google.genai import types
from supabase import create_client, Client

# =====================================================================
# 1. INICIALIZAÇÃO & CONFIGURAÇÕES
# =====================================================================
app = FastAPI(
    title="JurisPrime & AtaJur API Core",
    description="Motor Unificado: Atas de Reuniões, Pareceres e Petições de 1º Grau",
    version="1.1.0"
)

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

# Configurações de E-mail (Opcionais no Render via Environment Variables)
SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")

def get_gemini_client():
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY não configurada.")
    return genai.Client(api_key=GEMINI_API_KEY)

def get_supabase_client() -> Optional[Client]:
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            return create_client(SUPABASE_URL, SUPABASE_KEY)
        except Exception:
            return None
    return None

# =====================================================================
# 2. PROMPTS ESPECIALIZADOS
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

def get_ata_prompt(tipo_reuniao: str, participantes: str, titulo: str) -> str:
    if tipo_reuniao.lower() in ["cliente", "reunião com cliente"]:
        return f"""
        Você é um assistente jurídico sênior altamente qualificado em redação e síntese documental para escritórios de advocacia.
        Você recebeu o áudio gravado de uma reunião jurídica.

        REGRAS ESTRITAS:
        1. NÃO faça transcrição textual corrida fala por fala.
        2. Foque EXCLUSIVAMENTE em produzir a ATA EXECUTIVA FORMAL estruturada em Markdown.
        3. Adote tom formal, técnico e fidelidade absoluta aos dados e prazos tratados.

        TIPO: REUNIÃO COM CLIENTE
        CLIENTE / PARTICIPANTES: {participantes}
        PAUTA / ASSUNTO: {titulo}

        ESTRUTURA OBRIGATÓRIA DA ATA EXECUTIVA:
        # ATA EXECUTIVA DE REUNIÃO JURÍDICA

        ## 1. DADOS GERAIS
        - **Data/Hora:** {datetime.now().strftime('%d/%m/%Y %H:%M')}
        - **Participantes:** {participantes}
        - **Objeto / Pauta:** {titulo}

        ## 2. RESUMO EXECUTIVO
        (Síntese concisa em 2 a 3 parágrafos sobre a pretensão do cliente, contexto fático e situação jurídica tratada).

        ## 3. PRINCIPAIS APONTAMENTOS & RELATOS FÁTICOS
        - Liste em tópicos objetivos (bullet points) as alegações centrais, valores, datas, documentos e fatos narrados pelo cliente.

        ## 4. DIRETRIZES & ORIENTAÇÕES JURÍDICAS PRESTADAS
        - Tópicos claros com a orientação jurídica dada pelo advogado, riscos identificados e estratégia processual recomendada.

        ## 5. PLANO DE AÇÃO & DEFINIÇÃO DE PRAZOS
        | Providência / Tarefa | Responsável [Advogado / Cliente] | Prazo Acordado |
        | :--- | :--- | :--- |

        ## 6. CLÁUSULA DE CONFIDENCIALIDADE E SIGILO
        Documento de caráter estritamente sigiloso, amparado pelas prerrogativas da advocacia (Art. 7º, II da Lei nº 8.906/94 - EOAB) e em conformidade com a LGPD (Lei nº 13.709/18).
        """
    else:
        return f"""
        Você é um assistente jurídico sênior altamente qualificado em redação documental.
        
        TIPO: REUNIÃO INTERNA / COMITÊ JURÍDICO ENTRE ADVOGADOS
        ADVOGADOS PRESENTES: {participantes}
        PAUTA TÉCNICA: {titulo}

        ESTRUTURA OBRIGATÓRIA:
        # ATA EXECUTIVA DE REUNIÃO INTERNA

        ## 1. IDENTIFICAÇÃO DO COMITÊ
        - **Data/Hora:** {datetime.now().strftime('%d/%m/%Y %H:%M')}
        - **Advogados Presentes:** {participantes}
        - **Pauta Técnica:** {titulo}

        ## 2. RESUMO EXECUTIVO & ANÁLISE TÉCNICA
        (Síntese das discussões doutrinárias/jurisprudenciais, riscos de teses e estratégias deliberadas).

        ## 3. DELIBERAÇÕES E DECISÕES TOMADAS
        - Tópicos claros com as decisões estratégicas acordadas pela equipe.

        ## 4. MATRIZ DE RESPONSABILIDADES & PRAZOS FATAIS
        | Peça / Atividade Jurídica | Advogado Responsável | Prazo Fatal / Limite |
        | :--- | :--- | :--- |

        ## 5. PRÓXIMOS PASSOS E ALINHAMENTOS
        """

# =====================================================================
# 3. UTILITÁRIOS (DOCX & EMAIL)
# =====================================================================
def gerar_bytes_docx(titulo: str, conteudo_markdown: str) -> bytes:
    doc = docx.Document()
    for section in doc.sections:
        section.top_margin = Inches(1.18)
        section.bottom_margin = Inches(0.78)
        section.left_margin = Inches(1.18)
        section.right_margin = Inches(0.78)

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_title = p_title.add_run(titulo.upper())
    run_title.font.name = 'Times New Roman'
    run_title.font.size = Pt(14)
    run_title.font.bold = True

    for line in conteudo_markdown.split("\n"):
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

    bio = io.BytesIO()
    doc.save(bio)
    return bio.getvalue()

# =====================================================================
# 4. ENDPOINTS DA API
# =====================================================================
@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "JurisPrime & AtaJur API Core",
        "timestamp": datetime.utcnow().isoformat()
    }

# --- PROCESSAR ÁUDIO DE REUNIÃO (ATAJUR) ---
@app.post("/api/ata/processar-audio")
async def processar_audio(
    audio: UploadFile = File(...),
    tipo_reuniao: str = Form("Cliente"),
    participantes: str = Form(...),
    titulo: str = Form(...),
    user_id: Optional[str] = Form(None)
):
    try:
        client = get_gemini_client()
        audio_bytes = await audio.read()
        mime_type = audio.content_type or "audio/mp3"

        prompt_instrucao = get_ata_prompt(tipo_reuniao, participantes, titulo)

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                "Gere a Ata Executiva formal com rigor técnico."
            ],
            config=types.GenerateContentConfig(
                system_instruction=prompt_instrucao,
                temperature=0.2
            )
        )
        ata_gerada = response.text

        # Grava no Supabase se houver user_id e Supabase configurado
        supabase_client = get_supabase_client()
        if supabase_client and user_id:
            try:
                supabase_client.table("reunioes").insert({
                    "user_id": user_id,
                    "titulo": f"[{tipo_reuniao.upper()}] {titulo}",
                    "ata_markdown": ata_gerada,
                    "data_reuniao": datetime.utcnow().isoformat()
                }).execute()
            except Exception as e_db:
                print(f"Aviso: Não foi possível gravar no Supabase: {e_db}")

        return {
            "status": "success",
            "titulo": titulo,
            "tipo_reuniao": tipo_reuniao,
            "ata_markdown": ata_gerada
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar áudio: {str(e)}")

# --- ENVIAR ATA POR E-MAIL ---
class EmailRequest(BaseModel):
    destinatario: str
    titulo: str
    conteudo_markdown: str

@app.post("/api/ata/enviar-email")
def enviar_ata_email(req: EmailRequest):
    if not SMTP_USER or not SMTP_PASS:
        raise HTTPException(status_code=400, detail="Credenciais SMTP não configuradas nas variáveis de ambiente.")

    try:
        docx_bytes = gerar_bytes_docx(req.titulo, req.conteudo_markdown)
        file_title = f"Ata_{req.titulo.replace(' ', '_')[:30]}"
        
        msg = MIMEMultipart()
        msg["From"] = SMTP_USER
        msg["To"] = req.destinatario
        msg["Subject"] = Header(f"Ata de Reunião - {req.titulo}", "utf-8")
        
        body_text = f"Prezado(a),\n\nSegue em anexo a ata executiva da reunião sobre '{req.titulo}'.\n\nAtenciosamente,\nEquipe Jurídica"
        msg.attach(MIMEText(body_text, "plain", "utf-8"))

        part = MIMEApplication(docx_bytes, Name=f"{file_title}.docx")
        part["Content-Disposition"] = f'attachment; filename="{file_title}.docx"'
        msg.attach(part)

        smtp_pass_clean = SMTP_PASS.replace(" ", "")
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, smtp_pass_clean)
            server.sendmail(SMTP_USER, [req.destinatario], msg.as_string())

        return {"status": "success", "message": f"E-mail enviado para {req.destinatario}"}
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Erro ao disparar e-mail: {str(err)}")

# --- GERAÇÃO DE PEÇAS & PETIÇÕES DE 1º GRAU (STREAMING SSE) ---
@app.post("/api/peticao/gerar-stream")
async def gerar_peticao_stream(
    instrucao_usuario: str = Form(...),
    arquivos: List[UploadFile] = File(None)
):
    client = get_gemini_client()
    user_parts = []

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
                    yield f"data: {json.dumps({'text': chunk.text})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as err:
            yield f"data: {json.dumps({'error': str(err)})}\n\n"

    return StreamingResponse(stream_generator(), media_type="text/event-stream")

# --- EXPORTAÇÃO DOCX FORMATADO ---
class ExportDocxRequest(BaseModel):
    titulo: str
    conteudo_markdown: str

@app.post("/api/exportar-docx")
def exportar_docx(req: ExportDocxRequest):
    docx_bytes = gerar_bytes_docx(req.titulo, req.conteudo_markdown)
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{req.titulo}.docx"'}
    )
