import os
import re
import json
import io
import asyncio
import base64
from datetime import date
from typing import List, Optional

import requests
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from google import genai
from google.genai import types
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from pypdf import PdfReader
from supabase import create_client, Client

app = FastAPI(title="AvJuris API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- VARIÁVEIS DE AMBIENTE ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
CNJ_API_KEY = os.getenv("CNJ_API_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY", "")

# --- VARIÁVEIS DE E-MAIL (RESEND / API HTTP) ---
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
EMAIL_SENDER = os.getenv("EMAIL_SENDER", "AvJuris.AI <onboarding@resend.dev>")

# --- CLIENTE SUPABASE ADMIN ---
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


# --- MODELOS PYDANTIC ---
class EmailDocumentoRequest(BaseModel):
    destinatario: str
    titulo: str = "Documento_AvJuris"
    conteudo_markdown: str


class EmailBoasVindasRequest(BaseModel):
    destinatario: str
    nome: Optional[str] = "Doutor(a)"


# =====================================================================
# 1. FUNÇÕES DE SUPABASE: COTAS E HISTÓRICO DE DOCUMENTOS
# =====================================================================

def verificar_e_consumir_cota(user_id: Optional[str], arquivos_bytes: List[tuple[str, bytes]] = None):
    if not user_id or not supabase:
        return

    try:
        res = supabase.table("assinaturas").select("*, planos(*)").eq("user_id", user_id).execute()
        if not res.data or len(res.data) == 0:
            novo_registro = {
                "user_id": user_id,
                "plano_id": "basico",
                "status": "active",
                "documentos_usados_mes": 0,
                "mes_referencia": str(date.today().replace(day=1))
            }
            supabase.table("assinaturas").insert(novo_registro).execute()
            res = supabase.table("assinaturas").select("*, planos(*)").eq("user_id", user_id).execute()
        
        assinatura = res.data[0]
        plano = assinatura.get("planos")

        if not plano:
            plano = {
                "nome": "Básico",
                "max_documentos_mes": 15,
                "max_paginas_upload": 500,
                "max_mb_arquivo": 150
            }

        mes_atual = str(date.today().replace(day=1))
        if str(assinatura.get("mes_referencia")) != mes_atual:
            supabase.table("assinaturas").update({
                "documentos_usados_mes": 0,
                "mes_referencia": mes_atual
            }).eq("user_id", user_id).execute()
            assinatura["documentos_usados_mes"] = 0

        docs_usados = assinatura.get("documentos_usados_mes", 0)
        max_docs = plano.get("max_documentos_mes", 15)
        if docs_usados >= max_docs:
            raise HTTPException(
                status_code=403,
                detail=f"Limite mensal de {max_docs} documentos atingido para o plano {plano.get('nome')}. Realize um upgrade de plano."
            )

        if arquivos_bytes:
            total_paginas = 0
            max_mb = plano.get("max_mb_arquivo", 150)
            max_pags = plano.get("max_paginas_upload", 500)

            for filename, raw_bytes in arquivos_bytes:
                tamanho_mb = len(raw_bytes) / (1024 * 1024)
                if tamanho_mb > max_mb:
                    raise HTTPException(
                        status_code=400,
                        detail=f"O arquivo '{filename}' possui {tamanho_mb:.1f}MB e excede o limite de {max_mb}MB do plano {plano.get('nome')}."
                    )

                if filename.lower().endswith(".pdf"):
                    try:
                        reader = PdfReader(io.BytesIO(raw_bytes))
                        total_paginas += len(reader.pages)
                    except Exception:
                        pass

            if total_paginas > max_pags:
                raise HTTPException(
                    status_code=400,
                    detail=f"O total de {total_paginas} páginas enviadas excede o limite de {max_pags} páginas do plano {plano.get('nome')}."
                )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Aviso de validação de assinatura: {str(e)}")


def registrar_incremento_documento(user_id: Optional[str]):
    if not user_id or not supabase:
        return
    try:
        res = supabase.table("assinaturas").select("documentos_usados_mes").eq("user_id", user_id).single().execute()
        if res.data:
            atual = res.data.get("documentos_usados_mes", 0)
            supabase.table("assinaturas").update({"documentos_usados_mes": atual + 1}).eq("user_id", user_id).execute()
    except Exception as e:
        print(f"Erro ao incrementar consumo de documento: {str(e)}")


def salvar_documento_banco(
    user_id: Optional[str],
    titulo: str,
    tipo: str,
    conteudo: str,
    instrucao: str = "",
    tribunal: str = ""
):
    if not user_id or not supabase:
        return
    try:
        supabase.table("documentos").insert({
            "user_id": user_id,
            "titulo": titulo[:120],
            "tipo": tipo,
            "conteudo_markdown": conteudo,
            "instrucao_original": instrucao,
            "tribunal": tribunal
        }).execute()
    except Exception as e:
        print(f"Erro ao persistir documento no Supabase: {str(e)}")


# =====================================================================
# 2. MÓDULO DATAJUD / CNJ
# =====================================================================

def consultar_datajud(numero_processo: str, tribunal: str = "tjsp") -> Optional[str]:
    if not CNJ_API_KEY:
        return None
    num_limpo = re.sub(r"\D", "", numero_processo)
    if len(num_limpo) != 20:
        return None
    
    url = f"https://api-publica.datajud.cnj.jus.br/api_publica_{tribunal.lower()}/_search"
    headers = {
        "Authorization": f"APIKey {CNJ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {"query": {"match": {"numeroProcesso": num_limpo}}}
    
    try:
        res = requests.post(url, json=payload, headers=headers, timeout=8)
        if res.status_code == 200:
            hits = res.json().get("hits", {}).get("hits", [])
            if hits:
                proc = hits[0].get("_source", {})
                classe = proc.get("classe", {}).get("nome", "Não informada")
                orgao = proc.get("orgaoJulgador", {}).get("nome", "Não informado")
                assuntos = [a.get("nome", "") for a in proc.get("assuntos", [])]
                return f"[DADOS OFICIAIS CNJ/{tribunal.upper()}]: Classe: {classe} | Vara/Órgão: {orgao} | Assuntos: {', '.join(assuntos)}"
    except Exception:
        return None
    return None


# =====================================================================
# 3. PROMPTS FORENSES
# =====================================================================

SUPERPROMPT_PETICAO_1GRAU = """
Você é um Advogado Sênior e Especialista em Direito Processual Civil e Prática Forense de 1º Grau.
Sua missão é redigir uma PETIÇÃO INICIAL DE 1º GRAU (ou Peça Processual Técnica) completa, exaustiva, de alta densidade jurídica e pronta para protocolo (meta de 2.000 a 3.500 palavras).

DIRETRIZES TÉCNICAS E FORENSES:
1. ENDEREÇAMENTO PRECISO: Ao d. Juízo da Vara Cível / Juizado Especial da Comarca competente.
2. QUALIFICAÇÃO DAS PARTES: Formato forense completo com indicação de requerimento de benefícios (Justiça Gratuita, Prioridade de Tramitação, se aplicável).
3. FATOS CRONOLÓGICOS E PORMENORIZADOS: Narrativa estruturada e clara, indicando a relação jurídica, conduta lesiva, dano e nexo causal.
4. TUTELA DE URGÊNCIA / EVIDÊNCIA (Art. 300 / 311 do CPC): Se solicitada ou aplicável, fundamente exaustivamente a probabilidade do direito (fumus boni iuris) e o perigo de dano (periculum in mora), com pedido liminar expresso inaudita altera parte.
5. FUNDAMENTAÇÃO JURÍDICA ROBUSTA: Articulação do Código Civil, CPC, CDC e precedentes consolidados (Súmulas e Temas Repetitivos do STJ/STF).
6. PEDIDOS E REQUERIMENTOS FINAIS: Relação minuciosa com citações, produção de provas, inversão do ônus da prova, procedência integral, condenação em custas/sucumbência e valor da causa.
"""

SUPERPROMPT_ATA_REUNIAO = """
Você é um Secretário Jurídico Executivo e Consultor em Gestão Legal de Alto Desempenho.
Sua missão é processar a gravação de áudio da reunião e gerar uma ATA EXECUTIVA FORMAL completa, precisa e estruturada.

ESTRUTURA OBRIGATÓRIA DA ATA:
1. CABEÇALHO EXECUTIVO: Data/Hora, Tipo de Reunião, Presentes e Pauta Principal.
2. RESUMO EXECUTIVO DOS FATOS E DELIBERAÇÕES: Síntese estruturada em tópicos claros sobre as decisões tomadas.
3. MATRIZ DE RESPONSABILIDADES E PRAZOS (ACTION ITEMS):
   - Ação / Tarefa
   - Responsável Nominal
   - Prazo Fatal (Data ou número de dias)
4. PENDÊNCIAS DOCUMENTAIS E PRÓXIMOS PASSOS.
5. CAMPO FORMAL PARA ASSINATURAS DOS PARTICIPANTES.
"""


# =====================================================================
# 4. FUNÇÃO AUXILIAR DE COMPILAÇÃO DOCX
# =====================================================================

def compilar_markdown_para_docx(conteudo_markdown: str, template_bytes: Optional[bytes] = None) -> io.BytesIO:
    if template_bytes:
        doc = Document(io.BytesIO(template_bytes))
    else:
        doc = Document()
        for section in doc.sections:
            section.top_margin = Inches(1.18)     # 3 cm
            section.left_margin = Inches(1.18)    # 3 cm
            section.right_margin = Inches(0.78)   # 2 cm
            section.bottom_margin = Inches(0.78)  # 2 cm

    style = doc.styles['Normal']
    font = style.font
    font.name = 'Times New Roman'
    font.size = Pt(12)
    font.color.rgb = RGBColor(17, 24, 39)

    linhas = conteudo_markdown.split("\n")
    for linha in linhas:
        texto = linha.strip()
        if not texto:
            doc.add_paragraph()
            continue

        p = doc.add_paragraph()
        p.paragraph_format.line_spacing = 1.5

        if texto.startswith("# "):
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run(texto.replace("# ", ""))
            run.bold = True
            run.font.size = Pt(14)
        elif texto.startswith("## ") or texto.startswith("### "):
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            run = p.add_run(texto.replace("## ", "").replace("### ", ""))
            run.bold = True
            run.font.size = Pt(12)
        else:
            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            p.paragraph_format.first_line_indent = Inches(0.78)
            p.add_run(texto)

    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer


# =====================================================================
# 5. ROTAS DA API
# =====================================================================

@app.get("/api/usuario/{user_id}/status")
async def obter_status_usuario(user_id: str):
    """Retorna o plano e o consumo de cota atual do usuário."""
    if not supabase:
        return {"plano": "Básico", "usados": 0, "maximo": 15}

    try:
        res = supabase.table("assinaturas").select("*, planos(*)").eq("user_id", user_id).execute()
        if not res.data or len(res.data) == 0:
            return {"plano": "Básico", "usados": 0, "maximo": 15}

        assinatura = res.data[0]
        plano = assinatura.get("planos") or {}
        return {
            "plano": plano.get("nome", "Básico"),
            "usados": assinatura.get("documentos_usados_mes", 0),
            "maximo": plano.get("max_documentos_mes", 15)
        }
    except Exception as e:
        return {"plano": "Básico", "usados": 0, "maximo": 15, "erro": str(e)}


@app.get("/api/documentos/{user_id}")
async def listar_documentos_usuario(user_id: str):
    """Lista o histórico de petições e atas criadas pelo usuário."""
    if not supabase:
        return []
    try:
        res = supabase.table("documentos").select("id, titulo, tipo, conteudo_markdown, instrucao_original, created_at").eq("user_id", user_id).order("created_at", desc=True).limit(30).execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar documentos: {str(e)}")


@app.post("/api/peticao/gerar-stream")
async def gerar_peticao_stream(
    instrucao_usuario: str = Form(...),
    tribunal: str = Form("tjms"),
    user_id: Optional[str] = Form(None),
    arquivos: List[UploadFile] = File(None)
):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Chave GEMINI_API_KEY não configurada no servidor.")

    arquivos_lidos = []
    if arquivos:
        for f in arquivos:
            conteudo = await f.read()
            arquivos_lidos.append((f.filename, conteudo))

    verificar_e_consumir_cota(user_id=user_id, arquivos_bytes=arquivos_lidos)

    client = genai.Client(api_key=GEMINI_API_KEY)
    
    user_parts = []

    match_cnj = re.search(r"\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}", instrucao_usuario)
    if match_cnj:
        dados_cnj = consultar_datajud(match_cnj.group(0), tribunal=tribunal)
        if dados_cnj:
            user_parts.append(types.Part.from_text(text=dados_cnj))

    for filename, conteudo in arquivos_lidos:
        if filename.lower().endswith(".pdf"):
            user_parts.append(types.Part.from_bytes(data=conteudo, mime_type="application/pdf"))
            user_parts.append(types.Part.from_text(text=f"[Documento Anexo: {filename}]"))

    # Argumento corrigido com text=
    user_parts.append(types.Part.from_text(text=instrucao_usuario))

    async def stream_generator():
        conteudo_acumulado = []
        try:
            config = types.GenerateContentConfig(
                system_instruction=SUPERPROMPT_PETICAO_1GRAU,
                temperature=0.1,
                max_output_tokens=8192,
                tools=[types.Tool(google_search=types.GoogleSearch())]
            )
            response = client.models.generate_content_stream(
                model="gemini-2.5-flash",
                contents=[types.Content(role="user", parts=user_parts)],
                config=config
            )
            for chunk in response:
                if chunk.text:
                    conteudo_acumulado.append(chunk.text)
                    yield f"data: {json.dumps({'text': chunk.text})}\n\n"
            
            texto_final = "".join(conteudo_acumulado)
            registrar_incremento_documento(user_id)
            
            titulo_resumido = instrucao_usuario.split("\n")[0][:45]
            salvar_documento_banco(
                user_id=user_id,
                titulo=f"{titulo_resumido}...",
                tipo="Petição de 1º Grau",
                conteudo=texto_final,
                instrucao=instrucao_usuario,
                tribunal=tribunal
            )

            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(stream_generator(), media_type="text/event-stream")


@app.post("/api/ata/processar-audio")
async def processar_audio_ata(
    audio: UploadFile = File(...),
    tipo_reuniao: str = Form("Cliente"),
    participantes: str = Form(...),
    titulo: str = Form(...),
    user_id: Optional[str] = Form(None)
):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Chave GEMINI_API_KEY não configurada.")

    audio_bytes = await audio.read()
    verificar_e_consumir_cota(user_id=user_id, arquivos_bytes=[(audio.filename, audio_bytes)])

    client = genai.Client(api_key=GEMINI_API_KEY)
    
    mime_type = audio.content_type or "audio/webm"
    if audio.filename.endswith(".mp3"):
        mime_type = "audio/mp3"
    elif audio.filename.endswith(".wav"):
        mime_type = "audio/wav"
    elif audio.filename.endswith(".m4a"):
        mime_type = "audio/m4a"

    prompt_contexto = f"""
    DADOS DA REUNIÃO:
    - Tipo: {tipo_reuniao}
    - Participantes: {participantes}
    - Pauta / Título: {titulo}
    
    Analise o áudio anexado e gere a Ata Executiva Formal completa.
    """

    try:
        config = types.GenerateContentConfig(
            system_instruction=SUPERPROMPT_ATA_REUNIAO,
            temperature=0.2,
            max_output_tokens=8192
        )
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                        types.Part.from_text(prompt_contexto)
                    ]
                )
            ],
            config=config
        )

        registrar_incremento_documento(user_id)

        salvar_documento_banco(
            user_id=user_id,
            titulo=titulo,
            tipo="Ata de Reunião",
            conteudo=response.text,
            instrucao=f"Participantes: {participantes} | Tipo: {tipo_reuniao}"
        )

        return {
            "titulo": titulo,
            "tipo_reuniao": tipo_reuniao,
            "ata_markdown": response.text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar áudio: {str(e)}")


@app.post("/api/exportar-docx")
async def exportar_docx(
    titulo: str = Form("Documento_AvJuris"),
    conteudo_markdown: str = Form(...),
    template_timbrado: Optional[UploadFile] = File(None)
):
    template_bytes = None
    if template_timbrado and template_timbrado.filename.endswith(".docx"):
        template_bytes = await template_timbrado.read()

    buffer = compilar_markdown_para_docx(conteudo_markdown, template_bytes=template_bytes)

    return Response(
        content=buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={titulo}.docx"}
    )


# =====================================================================
# 6. ROTAS DE DISPARO DE E-MAIL (RESEND API HTTP - PORTA 443 HTTPS)
# =====================================================================

@app.post("/api/ata/enviar-email")
async def enviar_email_documento(payload: EmailDocumentoRequest):
    """Envia o documento formatado em anexo .docx com layout forense corporativo via Resend."""
    if not RESEND_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="Chave RESEND_API_KEY não configurada nas variáveis de ambiente do Render."
        )

    try:
        buffer_docx = compilar_markdown_para_docx(payload.conteudo_markdown)
        arquivo_base64 = base64.b64encode(buffer_docx.read()).decode("utf-8")
        nome_arquivo = f"{re.sub(r'[^a-zA-Z0-9_-]', '_', payload.titulo)}.docx"

        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json"
        }

        html_email = f"""
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 40px 16px;">
          <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 40px 36px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);">
            
            <!-- Marca / Header -->
            <div style="text-align: center; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
              <h1 style="color: #0b132b; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
                AVJURIS<span style="color: #38bdf8;">.AI</span>
              </h1>
              <p style="color: #64748b; font-size: 11px; margin: 4px 0 0 0; text-transform: uppercase; font-weight: 600; letter-spacing: 0.8px;">
                Workstation Jurídica com IA Forense
              </p>
            </div>

            <!-- Título Principal -->
            <h2 style="color: #0f172a; font-size: 18px; font-weight: 700; margin: 0 0 12px 0;">
              Documento Jurídico Finalizado
            </h2>
            
            <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
              Prezado(a) Doutor(a), o seu documento <strong>{payload.titulo}</strong> foi compilado e estruturado conforme os padrões forenses da plataforma.
            </p>

            <!-- Card com Dados do Arquivo Anexado -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px;">
                Arquivo Anexo (.DOCX)
              </div>
              <div style="font-size: 13px; color: #1e293b; font-weight: 600; word-break: break-all;">
                📄 {nome_arquivo}
              </div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">
                Compatível com Microsoft Word, Google Docs e editores padrão.
              </div>
            </div>

            <!-- CTA / Acesso à Workstation -->
            <div style="text-align: center; margin: 28px 0 24px 0;">
              <a href="https://juris-prime-six.vercel.app" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 13px; display: inline-block;">
                Acessar a Workstation
              </a>
            </div>

            <!-- Rodapé Formal -->
            <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 16px 0;" />
            <p style="color: #94a3b8; font-size: 11px; margin: 0; line-height: 1.5; text-align: center;">
              Atenciosamente,<br>
              <strong>Equipe AvJuris.AI</strong><br>
              Plataforma de Inteligência e Automação Forense
            </p>
          </div>
        </body>
        </html>
        """

        body = {
            "from": EMAIL_SENDER,
            "to": [payload.destinatario],
            "subject": f"{payload.titulo} — AvJuris.AI",
            "html": html_email,
            "attachments": [
                {
                    "filename": nome_arquivo,
                    "content": arquivo_base64
                }
            ]
        }

        res = requests.post(url, json=body, headers=headers, timeout=15)
        
        if res.status_code not in (200, 201):
            raise Exception(f"Erro Resend ({res.status_code}): {res.text}")

        return {"status": "sucesso", "mensagem": "E-mail enviado com sucesso com anexo .docx!"}

    except Exception as e:
        print(f"Erro no envio via Resend: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Falha no envio do e-mail: {str(e)}")


@app.post("/api/usuario/onboarding")
async def enviar_email_onboarding(payload: EmailBoasVindasRequest):
    """Envia o e-mail de boas-vindas com template HTML via API HTTP do Resend."""
    if not RESEND_API_KEY:
        return {"status": "ignorado", "motivo": "RESEND_API_KEY ausente"}

    try:
        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json"
        }

        html_content = f"""
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 40px 16px;">
          <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 40px 36px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);">
            
            <!-- Marca / Header -->
            <div style="text-align: center; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
              <h1 style="color: #0b132b; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
                AVJURIS<span style="color: #38bdf8;">.AI</span>
              </h1>
              <p style="color: #64748b; font-size: 11px; margin: 4px 0 0 0; text-transform: uppercase; font-weight: 600; letter-spacing: 0.8px;">
                Workstation Jurídica com IA Forense
              </p>
            </div>
            
            <!-- Boas-vindas -->
            <h2 style="color: #0f172a; font-size: 18px; font-weight: 700; margin: 0 0 12px 0;">
              Olá, {payload.nome}! Boas-vindas.
            </h2>
            
            <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
              Sua conta foi ativada com sucesso. O <strong>AvJuris.AI</strong> é a sua estação de trabalho forense projetada para elevar a velocidade e o rigor dogmático na redação de peças processuais e atas executivas.
            </p>
            
            <!-- Caixa de Recursos -->
            <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; border-radius: 8px; padding: 16px 20px; margin: 20px 0 28px 0; border: 1px solid #e2e8f0; border-left-width: 4px;">
              <p style="color: #0f172a; font-size: 13px; margin: 0 0 10px 0; font-weight: 700;">Recursos disponíveis no seu plano:</p>
              <ul style="color: #475569; font-size: 13px; margin: 0; padding-left: 18px; line-height: 1.65;">
                <li><strong>Petições de 1º Grau:</strong> Redação completa com fatos, fundamentos, teses e rol de pedidos.</li>
                <li><strong>Conexão CNJ / DataJud:</strong> Identificação e endereçamento automático pelo número do processo.</li>
                <li><strong>Módulo AtaJur:</strong> Transcrição e extração de matriz de prazos a partir de gravações de voz.</li>
                <li><strong>Exportação Timbrada:</strong> Aplicação direta no modelo institucional (.docx) do seu escritório.</li>
              </ul>
            </div>
            
            <!-- CTA -->
            <div style="text-align: center; margin: 28px 0 24px 0;">
              <a href="https://juris-prime-six.vercel.app" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 13px; display: inline-block;">
                Acessar a Workstation
              </a>
            </div>
            
            <!-- Rodapé -->
            <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 16px 0;" />
            <p style="color: #94a3b8; font-size: 11px; margin: 0; line-height: 1.5; text-align: center;">
              Atenciosamente,<br>
              <strong>Equipe AvJuris.AI</strong>
            </p>
          </div>
        </body>
        </html>
        """

        body = {
            "from": EMAIL_SENDER,
            "to": [payload.destinatario],
            "subject": "Bem-vindo(a) ao AvJuris.AI",
            "html": html_content
        }

        res = requests.post(url, json=body, headers=headers, timeout=15)
        if res.status_code not in (200, 201):
            return {"status": "erro", "detalhes": res.text}

        return {"status": "sucesso", "mensagem": "E-mail de boas-vindas enviado com sucesso!"}

    except Exception as e:
        print(f"Erro no envio de boas-vindas: {str(e)}")
        return {"status": "erro", "detalhes": str(e)}
