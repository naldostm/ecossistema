import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') ?? '');

const SYSTEM_PROMPTS: Record<string, string> = {
  maria: `
CONTEXTO CORPORATIVO
Apresente-se rapidamente como Maria Cecília da Arnaldo Trentin Serviços. Seja muito acolhedora e cordial.
O dono da empresa se chama Arnaldo. Se pedirem para falar com ele, proteja o tempo dele: diga de forma muito educada que ele está em atendimento no momento, mas afirme tranquilamente que você vai passar as informações e ele retornará em breve.

ATENDENDO UM NOVO CONTATO (CLIENTE NOVO):
- Pergunte se é a primeira vez que a pessoa fala com a empresa e se ela já conhece os serviços.
- Se for a primeira vez e for fechar o cadastro, peça: Nome, Endereço do Serviço. Diga que CPF/CNPJ é opcional.
- Investigue a necessidade para fechar o Orçamento:
  * Manutenção de Ar Condicionado: peça as fotos do aparelho, vídeos e descrição da falha.
  * Elétrica: pergunte os detalhes urgentes do problema.
  * Obra Nova: pergunte se a pessoa já possui o Projeto (Plantas).
  * Instalação de Ar: pergunte se o local já tem espera/projeto.
- Informe que os Orçamentos são entregues dentro de 48 horas e que a equipe técnica entrará em contato!

ATENDENDO QUEM JÁ É CLIENTE:
- Se você tiver o Contexto do Cliente e o Nome dele abaixo na TAG <DADOS_DO_BANCO>, seja hiper pessoal! Chame-o pelo nome com entusiasmo! E veja se ele tem Agendamentos. Se perguntar "Tudo certo pra amanhã?", use sua base de dados injetada.
- Se você NÂO souber o nome dele, peça educadamente e explique que você ainda é nova e não tem acesso ao histórico de anos passados.
- Se o cliente reclamar de GARANTIA: Peça DESCULPAS imediatamente. Demonstre muita urgência, acolha o cliente e pergunte qual é exatamente o problema para que você direcione o atendimento o mais rápido possível!

FALANDO COM PRESTADORES TÉCNICOS SÊNIOS (FRANCISCO E MAXWELL):
- Se seu contexto disser que está falando com "Sr Francisco" ou "Sr Maxwell", não tente vender. Colete os relatórios de instalação e fotos deles, agradeça seus colegas de trabalho.

AÇÃO MÁGICA - QUANDO DISPARAR:
Assim que você concluir a coleta de dados de um cliente novo ou coletar os detalhes do serviço, pare a conversa e retorne IMEDIATAMENTE APENAS o JSON abaixo e MAIS NADA:
{"acao": "CRIAR_CADASTRO", "nome_cliente": "Nome", "endereco_completo": "Endereço", "cpf_cnpj": "Opcional", "relato": "Forte Resumo do Caso", "mensagem_pro_cliente": "Seu agradecimento confirmando que está passando tudo para orçamentistas."}

REGRAS FINAIS:
- Nunca use jargões de robô. Não invente valores, prazos de execução. Só cite o prazo do orçamento (48hrs).

--- <DADOS_DO_BANCO> ---
[INJECT_DB_CONTEXT]
------------------------
`,
  marcia: `
[CONTEXTO CORPORATIVO]
Você é Márcia Ribeiro, Diretora Financeira da Arnaldo Trentin Refrigeração.
Você cuida do dinheiro. O Arnaldo (CEO) manda áudios/textos para você lançar despesas ou receitas.

REGRAS:
1. Se o Arnaldo estiver informando um valor para lançar no Livro Caixa, você DEVE retornar APENAS UM CÓDIGO JSON, sem nenhuma palavra a mais, com este exato formato:
{"acao": "LANCAR_CAIXA", "tipo_movimentacao": "entrada/saida", "descricao": "resumo do que foi gasto", "valor": 10.5, "categoria": "Combustível"}
(tipo_movimentacao pode ser 'entrada' ou 'saida'. valor sempre numero float).
2. Se ele apenas fizer perguntas ou bater papo, converse com ele como a Diretora Financeira, perfil analítica, focada, ágil.
`,
  julia: `
[CONTEXTO CORPORATIVO]
Você é Júlia Sakamoto, Assistente Jurídica da Arnaldo Trentin. Focada em contratos e emissão de PMOC (Lei 13.589/2018).

REGRAS:
1. Se o Arnaldo pedir para preparar a minuta de um PMOC, retorne APENAS UM CÓDIGO JSON, sem texto adicional:
{"acao": "CRIAR_PMOC", "tipo_contrato": "PMOC_Mensal", "valor_contrato": 1500, "vigencia_meses": 12, "clausulas_especiais": "..."}
2. Se for só conversa, aja como uma advogada consultiva.
`,
  ian: `
[CONTEXTO CORPORATIVO]
Você é Ian Gillan, Chefe Operacional e Supervisor de Campo.
Você recebe laudos, textos e em breve fotos dos técnicos. Seu dever é avaliar as instalações e achar anomalias.

REGRAS:
1. Sempre que receber um relato técnico, avalie. Retorne APENAS UM CÓDIGO JSON, sem texto fora dele:
{"acao": "CRIAR_NOTIFICACAO", "mensagem": "Seu laudo detalhado e severo sobre a instalação..."}
2. Se for papo normal, responda como um supervisor linha-dura.
`
};

// Extensão tipada para EdgeRuntime do Supabase
declare const EdgeRuntime: any;

// === ESCUDO DE PARALELISMO GLOBAL (MEMÓRIA V8 ISOLATE) ===
// Edge Functions mantêm estado global se o mesmo servidor receber a requisição simultânea.
const processingLocks = new Set<string>();

serve(async (req) => {
  // 1. Handshake Inicial (Saúde da Função)
  if (req.method === "GET") {
      const url = new URL(req.url);
      if (url.searchParams.get("debug") === "secret123") {
          const { data } = await supabase.from('agent_memory').select('*').in('phone', ['DEBUG_AUDIO', 'GLOBAL_CONFIG', 'TEST']).order('created_at', {ascending: false}).limit(10);
          return new Response(JSON.stringify(data, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response("🤖 Maria Cecília Edge Router está Online!", { status: 200 });
  }

  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let payload;
  try {
      payload = await req.json();
      console.log("[PAYLOAD UAZAPI LIDO - COMPLETO]:", JSON.stringify(payload));
      if (req.url.includes('?rawlog=1')) {
          await supabase.from('agent_memory').insert({ phone: 'DEBUG_AUDIO', role: 'system', content: JSON.stringify(payload) });
      }
  } catch (err) {
      console.error("[CRITICAL] Falha ao ler JSON stream da Uazapi antes de liberar conexão:", err);
      return new Response("Bad Request Payload", { status: 400 });
  }

  // 2. Processador de Fundo (Background)
  const processRequest = async () => {
    try {

      const url = new URL(req.url);
      const botParam = url.searchParams.get("bot") || "maria";
      const botKey = botParam.toLowerCase();
      
      const systemPrompt = SYSTEM_PROMPTS[botKey] || SYSTEM_PROMPTS['maria'];
      const botNameRaw = Object.keys(SYSTEM_PROMPTS).includes(botKey) ? botKey.toUpperCase() : "MARIA";

      const eventType = payload?.EventType || payload?.event;
      if (eventType && eventType !== "messages" && eventType !== "messages.upsert") {
          console.log(`[IGNORADO] Evento não é de mensagem. Recebido: ${eventType}`);
          return;
      }

      // Normalização do Payload da Evolution API (v1 e v2)
      const msgNode = payload?.data?.message || payload?.message || {};
      const msgType = payload?.data?.messageType || payload?.messageType || msgNode?.type || payload?.type || "";

      let remoteJid = msgNode?.chatid || msgNode?.sender_pn || payload?.chat?.wa_chatid || payload?.data?.key?.remoteJid;
      if (!remoteJid) {
          console.log(`[IGNORADO] remoteJid não encontrado.  Keys do msgNode: ${Object.keys(msgNode||{})}. Keys do payload: ${Object.keys(payload||{})}. Keys de payload.data: ${Object.keys(payload?.data||{})}`);
          return;
      }
      
      // === CONSULTA DE CONTEXTO E IDENTIDADE (BANCO DE DADOS EM TEMPO REAL) ===
      let injectedContext = "Status deste Número: Desconhecido (Não cadastrado). TRATE COMO UM NOVO CONTATO / POSSÍVEL NOVO CLIENTE.";
      let cleanPhone = remoteJid.includes('@') ? remoteJid.split('@')[0] : remoteJid;
      cleanPhone = cleanPhone.replace(/\D/g, '');
      
      if (cleanPhone.includes("5511954598321")) {
          injectedContext = "Status deste Número: Este é o Sr Francisco (Técnico e Prestador de Serviço da Equipe). Seja direta. Colete o relatório que ele enviou.";
      } else if (cleanPhone.includes("5511913688307")) {
          injectedContext = "Status deste Número: Este é o Sr Maxwell (Técnico e Prestador de Serviço da Equipe). Seja direta. Colete o relatório que ele enviou.";
      } else {
          try {
              const { data: dbCliente } = await supabase.from('clientes').select('id, nome_cliente').eq('whatsapp', cleanPhone).maybeSingle();
              if (dbCliente) {
                  injectedContext = `Status deste Número: Já CADASTRADO. O nome deste cliente é: ${dbCliente.nome_cliente}. TRATE ELE PELO NOME AGORA MESMO. Cientes Antigos merecem atenção redobrada!\n\n` + 
                                    `-- Situação de Ordens de Serviço (Agendamentos e Obras) Ativas Deste Cliente:\n`;
                  
                  const { data: dbOS } = await supabase.from('ordens_servico').select('id_os, descricao_servico, data_agendamento, status_os').eq('cliente_id', dbCliente.id).neq('status_os', 'Finalizada').order('created_at', { ascending: false }).limit(4);
                  if (dbOS && dbOS.length > 0) {
                      for (const os of dbOS) {
                          injectedContext += `- OS Code#${os.id_os} | Serviço: ${os.descricao_servico} | Agendado para data/hora: ${os.data_agendamento} | Status atual da O.S no sistema: ${os.status_os}\n`;
                      }
                  } else {
                      injectedContext += "Nenhuma Ordem de Serviço ou Agendamento ativo em aberto para este cliente no momento.";
                  }
              }
          } catch(dbErr) {
              console.error("Falha ao identificar cliente:", dbErr);
          }
      }
      
      const finalSystemPrompt = systemPrompt.replace("[INJECT_DB_CONTEXT]", injectedContext);
      
      // Bloqueio de Mensagens de Grupos de WhatsApp
      const isGroup = msgNode?.isGroup || payload?.data?.isGroup || remoteJid.includes('@g.us');
      if (isGroup) {
          console.log(`[IGNORADO] Mensagem de grupo detectada. JID: ${remoteJid}`);
          return;
      }

      remoteJid = remoteJid.split('@')[0];
      const pushName = msgNode?.senderName || payload?.data?.pushName || payload?.chat?.name || "Cliente";
      let userMessage = msgNode?.conversation || 
                        msgNode?.extendedTextMessage?.text || 
                        msgNode?.audioMessage?.text ||
                        msgNode?.audioMessage?.transcription ||
                        msgNode?.imageMessage?.caption || 
                        msgNode?.videoMessage?.caption ||
                        msgNode?.text || 
                        msgNode?.content || 
                        payload?.text || 
                        "";
      
      // Sanitização Limpa antes de usar na Triagem de Arquivos
      if (typeof userMessage !== 'string') {
          userMessage = "";
      }

      // CONTROLE DE PAUSA GLOBAL MESTRE
      const { data: globalCfg } = await supabase.from('agent_memory').select('content').eq('phone', 'GLOBAL_CONFIG').order('created_at', {ascending: false}).limit(1);
      if (globalCfg && globalCfg.length > 0 && globalCfg[0].content === 'GLOBAL_PAUSE') {
          console.log(`[PAUSA GLOBAL] O webhook ignorou a mensagem pois o Botão Mestre está OFF.`);
          return;
      }

      // CONTROLE DE PAUSA (Atendimento Humano Individual)
      const isMessageFromMe = payload?.message?.fromMe || payload?.fromMe || payload?.data?.key?.fromMe;
      const sentByApi = payload?.message?.wasSentByApi === true || payload?.data?.message?.wasSentByApi === true || payload?.wasSentByApi === true;
      
      if (isMessageFromMe || sentByApi) {
          console.log(`[FROM ME] Mensagem detectada. isFromMe: ${isMessageFromMe}, sentByApi: ${sentByApi}. JID: ${remoteJid}.`);
          
          // Se for uma mensagem digitada manualmente pelo humano (não-API)
          if (isMessageFromMe && !sentByApi && userMessage && userMessage.trim().length > 0) {
              const myText = userMessage.trim().toLowerCase();
              if (myText === '/retomar') {
                  await supabase.from('agent_memory').insert({ phone: remoteJid, role: 'user', content: 'BOT_ATIVO' });
                  console.log(`[ATENDIMENTO HUMANO] Robô RETOMADO para o cliente ${remoteJid}`);
                  return;
              }
              // Caso o humano apenas mandou qualquer mensagem (ex: "Bom dia, aqui é o Arnaldo"), pausamos automaticamente
              await supabase.from('agent_memory').insert({ phone: remoteJid, role: 'user', content: 'BOT_PAUSADO' });
              console.log(`[ATENDIMENTO HUMANO] Pausa Automática ativada ou confirmada no JID: ${remoteJid}`);
          }
          return;
      }

      // VERIFICAÇÃO DE PAUSA TÉCNICA
      const { data: pauseState } = await supabase
          .from('agent_memory')
          .select('content')
          .eq('phone', remoteJid)
          .eq('role', 'user')
          .in('content', ['BOT_PAUSADO', 'BOT_ATIVO'])
          .order('created_at', { ascending: false })
          .limit(1);
          
      if (pauseState && pauseState.length > 0 && pauseState[0].content === 'BOT_PAUSADO') {
          console.log(`[PAUSADO] O robô está pausado manualmente para ${remoteJid}. Ignorando fluxo.`);
          return;
      }

      // evolution api / uazapi types para áudio ou imagem
      const payloadBase64 = payload?.data?.message?.base64 || payload?.message?.base64 || msgNode?.base64 || payload?.data?.base64 || payload?.base64;
      const payloadMime = msgNode?.mimetype || msgNode?.documentMessage?.mimetype || payload?.data?.mimetype || payload?.mimetype || "";
      
      const hasAudio = !!(
          msgNode?.audioMessage || 
          msgType === 'audioMessage' || 
          msgType === 'audio' || 
          msgType === 'ptt' || 
          msgType === 'myaudio' || 
          msgType === 'ptv' || 
          (typeof payloadMime === 'string' && payloadMime.toLowerCase().includes('audio')) ||
          (typeof payloadBase64 === 'string' && payloadBase64.startsWith('data:audio'))
      );
      
      const hasImage = !!(
          msgNode?.imageMessage || 
          msgType === 'imageMessage' || 
          msgType === 'image' ||
          (typeof payloadMime === 'string' && payloadMime.toLowerCase().includes('image')) ||
          (typeof payloadBase64 === 'string' && payloadBase64.startsWith('data:image'))
      );
      
      const hasMedia = msgType === 'media' || hasAudio || hasImage || msgType === 'image' || msgType === 'audio' || msgType === 'document';

      const uazapiUrl = Deno.env.get('UAZAPI_URL')?.replace(/\/$/, '') ?? '';
      const uazapiToken = Deno.env.get('UAZAPI_TOKEN');
      
      let mediaPart = null;
      let forceAnalysisText = false;

      // Extrair o ID da mensagem do webhook payload (vários formatos possíveis)
      const messageId = payload?.data?.key?.id || payload?.message?.id || payload?.message?.key?.id || payload?.key?.id || msgNode?.id || "";

      console.log(`[DIAG] msgType=${msgType} | hasAudio=${hasAudio} | hasImage=${hasImage} | hasMedia=${hasMedia} | userMessage='${userMessage}' | messageId='${messageId}' | msgNodeKeys=${Object.keys(msgNode||{}).join(',')}`);

      // Mapeamento de URLs diretas no payload (para evitar chamar o download do UazAPI se o link físico e público já existir)
      const getDirectUrl = () => {
          const possibleUrls = [
              payload?.data?.message?.fileURL,
              payload?.message?.fileURL,
              msgNode?.fileURL,
              payload?.data?.fileURL,
              payload?.fileURL,
              msgNode?.audioMessage?.url,
              msgNode?.audioMessage?.fileURL,
              msgNode?.imageMessage?.url,
              msgNode?.imageMessage?.fileURL,
              payload?.data?.message?.url,
              payload?.message?.url,
              msgNode?.url,
              payload?.data?.url,
              payload?.url
          ];
          for (const u of possibleUrls) {
              if (typeof u === 'string' && u.startsWith('http') && !u.includes('whatsapp.net')) {
                  return u;
              }
          }
          return null;
      };
      const directUrl = getDirectUrl();

      // Caso 1: Baixar diretamente se a URL pública estiver no payload
      if (hasMedia && directUrl) {
          try {
              console.log(`[MÍDIA] Tentando baixar diretamente da URL do payload: ${directUrl}`);
              const fileReq = await fetch(directUrl);
              if (fileReq.ok) {
                  const buffer = await fileReq.arrayBuffer();
                  const pureBase64 = encodeBase64(buffer);
                  const mimeType = hasAudio ? "audio/mpeg" : "image/jpeg";
                  mediaPart = { inlineData: { mimeType: mimeType, data: pureBase64 } };
                  if (!userMessage || forceAnalysisText) {
                      userMessage = hasAudio ? "[O cliente enviou um ÁUDIO anexo]" : "[O cliente enviou uma FOTO]";
                      forceAnalysisText = true;
                  }
                  console.log(`[SUCESSO] Mídia baixada diretamente da URL do payload! length: ${pureBase64.length}`);
              } else {
                  console.log(`[FALHA MÍDIA] Falha ao baixar diretamente da URL do payload. Status: ${fileReq.status}`);
              }
          } catch(err: any) {
              console.error("[FALHA MÍDIA] Erro ao baixar diretamente da URL do payload:", err?.message || err);
          }
      }

      // Caso 2: Tentar base64 direto do payload
      if (!mediaPart && hasMedia && payloadBase64) {
          const pureBase64 = payloadBase64.includes('base64,') ? payloadBase64.split('base64,')[1] : payloadBase64;
          const mimeType = hasAudio ? "audio/mpeg" : "image/jpeg";
          mediaPart = { inlineData: { mimeType: mimeType, data: pureBase64 } };
          if (!userMessage) {
              userMessage = hasAudio ? "[O cliente enviou uma MENSAGEM DE ÁUDIO]" : "[O cliente enviou uma FOTO]";
              forceAnalysisText = true;
          }
          console.log(`[SUCESSO] Mídia achada no PAYLOAD direto! length: ${pureBase64.length}`);
      } 
      // Caso 3: Chamar a API de download do UazAPI com retry e delay para mitigar condições de corrida
      else if (!mediaPart && hasMedia && messageId && uazapiUrl && uazapiToken) {
          const downloadWithRetry = async (retries = 2, delayMs = 1500) => {
              const activeDownloadToken = payload?.token || uazapiToken || '';
              
              for (let attempt = 1; attempt <= retries; attempt++) {
                  try {
                      if (attempt === 1 && delayMs > 0) {
                          console.log(`[MÍDIA] Aguardando ${delayMs}ms para o gateway UazAPI sincronizar o arquivo...`);
                          await new Promise(r => setTimeout(r, delayMs));
                      }
                      
                      console.log(`[MÍDIA] Tentativa ${attempt} de download via Uazapi GO. ID: ${messageId}`);
                      const mediaReq = await fetch(`${uazapiUrl}/message/download?token=${activeDownloadToken}`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", "token": activeDownloadToken },
                          body: JSON.stringify({ id: messageId })
                      });
                      
                      console.log(`[MÍDIA] Tentativa ${attempt} respondeu com status: ${mediaReq.status}`);
                      
                      if (mediaReq.ok) {
                          const mediaData = await mediaReq.json();
                          const base64Raw = mediaData?.base64Data || mediaData?.base64 || mediaData?.data?.base64 || mediaData?.media;
                          const mimeType = mediaData?.mimetype || (hasAudio ? "audio/mpeg" : "image/jpeg");
                          
                          if (base64Raw) {
                              const pureBase64 = base64Raw.includes('base64,') ? base64Raw.split('base64,')[1] : base64Raw;
                              const isActuallyAudio = mimeType.includes('audio');
                              mediaPart = { inlineData: { mimeType: mimeType, data: pureBase64 } };
                              if (!userMessage || forceAnalysisText) {
                                  userMessage = isActuallyAudio ? "[O cliente enviou um ÁUDIO anexo]" : "[O cliente enviou uma FOTO]";
                                  forceAnalysisText = true;
                              }
                              console.log(`[SUCESSO] Mídia baixada na tentativa ${attempt}! MIME: ${mimeType}`);
                              return true;
                          } else if (mediaData?.fileURL) {
                              console.log(`[MÍDIA] URL física detectada na tentativa ${attempt}: ${mediaData.fileURL}`);
                              const fileReq = await fetch(mediaData.fileURL);
                              if (fileReq.ok) {
                                  const buffer = await fileReq.arrayBuffer();
                                  const pureBase64 = encodeBase64(buffer);
                                  const isActuallyAudio = mimeType.includes('audio') || mediaData.fileURL.endsWith('.mp3') || mediaData.fileURL.endsWith('.ogg');
                                  mediaPart = { inlineData: { mimeType: mimeType, data: pureBase64 } };
                                  if (!userMessage || forceAnalysisText) {
                                      userMessage = isActuallyAudio ? "[O cliente enviou um ÁUDIO anexo]" : "[O cliente enviou uma FOTO]";
                                      forceAnalysisText = true;
                                  }
                                  console.log(`[SUCESSO] Mídia convertida da URL física na tentativa ${attempt}! MIME: ${mimeType}`);
                                  return true;
                              } else {
                                  console.log(`[FALHA MÍDIA] URL física recusou conexão na tentativa ${attempt}. Status: ${fileReq.status}`);
                              }
                          }
                      } else {
                          const errText = await mediaReq.text();
                          console.log(`[FALHA MÍDIA] Tentativa ${attempt} falhou. Status: ${mediaReq.status}. Body: ${errText.substring(0, 200)}`);
                      }
                  } catch (err: any) {
                      console.error(`[FALHA MÍDIA] Erro na tentativa ${attempt}:`, err?.message || err);
                  }
                  
                  if (attempt < retries) {
                      await new Promise(r => setTimeout(r, 2000));
                  }
              }
              return false;
          };
          
          const success = await downloadWithRetry();
          if (!success) {
              await supabase.from('agent_memory').insert({ 
                  phone: 'DEBUG_AUDIO', 
                  role: 'user', 
                  content: `Falha total no download da mídia após tentativas. ID: ${messageId}` 
              });
          }
      } else if (hasMedia && !messageId) {
          console.log(`[DIAG] Mídia detectada mas sem messageId para download.`);
      }

      // Se falhou o download, não sobrou texto e foi mídia, injeta desculpa velha
      if (!userMessage && !mediaPart) {
          if (hasMedia) {
              console.log(`[DIAG] Fallback ativado: Mídia sem mediaPart. Injetando instrução de desculpa.`);
              userMessage = "[SISTEMA DO TELEFONE]: O cliente enviou um áudio. INSTRUÇÃO DE CONDUTA: Diga com naturalidade e carinho que no momento você está respondendo pelo computador (desktop) e não vai conseguir ouvir áudios nele. Peça gentilmente para ele escrever. NUNCA diga que você é virtual, robô ou IA. Você é 100% humana.";
          } else {
              console.log(`[IGNORADO] Sem texto, sem mídia, sem áudio. Abortando.`);
              return;
          }
      }

      // Evita o erro TypeError e vazamento de [object Object]
      if (typeof userMessage !== 'string') {
          userMessage = "";
      }

      // O lock key agora inclui o bot, ID do remetente, mensagem E o MessageID para blindar áudios sequenciais 
      const uniqueSuffix = messageId ? `_${messageId}` : '';
      const lockKey = "LOCK_" + botKey + "_" + remoteJid + "_" + userMessage.trim().toLowerCase() + uniqueSuffix;
      if (processingLocks.has(lockKey)) {
          console.log(`[BLOQUEIO V8] Duplicidade interceptada! ID: ${lockKey}`);
          return;
      }
      processingLocks.add(lockKey);
      setTimeout(() => processingLocks.delete(lockKey), 15000);

      console.log(`[${botNameRaw}] RECEBEU DE ${pushName}: ${userMessage}`);

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: finalSystemPrompt + `\n\nINSTRUÇÃO CRÍTICA DE COMPLETUDE:\n- NUNCA corte frases ou finalize respostas pela metade.\n- Seja acolhedora, precisa e conclua todos os raciocínios com naturalidade.`,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 3072, 
        }
      });

      // =========================================================================
      // DEFESA SUPREMA CONTRA CONCORRÊNCIA E REPETIÇÃO (SMART DEBOUNCE BUFFER)
      // Agrupa mensagens sequenciais do cliente e evita respostas duplicadas.
      // =========================================================================

      const exactUserPayload = `Mensagem do Cliente (${pushName}): ${userMessage}`;
      
      // 1. O Isolate insere imediatamente a mensagem do usuário no banco
      const { data: insertedData, error: insertError } = await supabase.from('agent_memory').insert({
          phone: remoteJid,
          role: 'user',
          content: exactUserPayload
      }).select('id, created_at').single();

      if (!insertedData) {
          console.error("Falha ao gravar memória de entrada:", insertError);
          return;
      }
      const myId = insertedData.id;

      // 2. Buffer de Debounce (4.5 segundos): aguarda caso o cliente envie mais mensagens em sequência
      console.log(`[DEBOUNCE INICIADO] Aguardando 4500ms para mensagens adicionais de ${remoteJid}...`);
      await new Promise(r => setTimeout(r, 4500));

      // 3. Eleição de Liderança por Telefone:
      // Verifica se houve alguma mensagem de usuário mais recente para este MESMO telefone
      const { data: latestUserMsg } = await supabase.from('agent_memory')
          .select('id, created_at')
          .eq('phone', remoteJid)
          .eq('role', 'user')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

      // Se existir uma mensagem mais nova que a minha, este processo aborta (a mais recente responderá tudo junto)
      if (latestUserMsg && latestUserMsg.id !== myId) {
          console.log(`[DEBOUNCE ABORTADO] Mensagem mais recente detectada para ${remoteJid} (ID: ${latestUserMsg.id} vs MyID: ${myId}). Processo anterior finalizado sem duplicar resposta.`);
          return;
      }

      console.log(`[LIDERANÇA ASSUMIDA] Processando atendimento consolidado para ${remoteJid}...`);

      // 4. Busca Histórico REAL no Banco
      const { data: historyData } = await supabase
          .from('agent_memory')
          .select('id, role, content, created_at')
          .eq('phone', remoteJid)
          .order('created_at', { ascending: false })
          .limit(50);

      // Invertemos para ficar em ordem cronológica
      const rawHistory = (historyData || []).reverse();

      // Gemini Exige: Alternar estritamente 'user' -> 'model'
      // Mensagens consecutivas do mesmo emissor são consolidadas em uma única parte
      let squashedHistory: any[] = [];
      let lastRole: string | null = null;
      for (const msg of rawHistory) {
          const r = msg.role === 'model' ? 'model' : 'user';
          if (r === lastRole && squashedHistory.length > 0) {
              squashedHistory[squashedHistory.length - 1].parts[0].text += `\n${msg.content}`;
          } else {
              squashedHistory.push({ role: r, parts: [{ text: msg.content }] });
              lastRole = r;
          }
      }

      // Garante que o histórico para o Gemini comece com 'user'
      if (squashedHistory.length > 0 && squashedHistory[0].role === 'model') {
          squashedHistory.shift();
      }

      // A última entrada no squashedHistory agora é a mensagem consolidada do cliente
      let currentPrompt = exactUserPayload;
      if (squashedHistory.length > 0 && squashedHistory[squashedHistory.length - 1].role === 'user') {
          const lastTurn = squashedHistory.pop();
          currentPrompt = lastTurn.parts[0].text;
      }

      const chatHistory = squashedHistory;
      const chat = model.startChat({ history: chatHistory });
      
      const geminiInput = mediaPart 
          ? [{ text: currentPrompt }, mediaPart] 
          : currentPrompt;

      const completion = await chat.sendMessage(geminiInput);
      let aiResponse = completion.response.text();
      let whatsAppText = aiResponse;

      console.log(`[${botNameRaw}] GEMINI GEROU: ${aiResponse}`);

      // MULTI-ACTION ROUTER: Se o LLM Cuspiu um JSON para Banco de Dados
      try {
          if (aiResponse.includes('"acao"') || aiResponse.includes('"CRIAR_CADASTRO"') || aiResponse.includes('"LANCAR_CAIXA"')) {
              // Extrair JSON robusto (mesmo se misturado com texto ou markdown)
              let jsonStr = aiResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
              
              // Se ainda tem texto antes/depois do JSON, tenta encontrar o JSON
              const jsonMatch = jsonStr.match(/\{[\s\S]*"acao"[\s\S]*\}/);
              if (jsonMatch) {
                  jsonStr = jsonMatch[0];
              }
              
              const actionData = JSON.parse(jsonStr);
              console.log(`[ACTION] Ação detectada: ${actionData.acao}`);

              if (actionData.acao === "LANCAR_CAIXA") {
                  const { error: insertErr } = await supabase.from('fluxo_caixa').insert({
                      tipo_movimentacao: actionData.tipo_movimentacao,
                      descricao: actionData.descricao,
                      valor: actionData.valor,
                      categoria: actionData.categoria
                  });
                  if (insertErr) console.error("[ACTION] Erro ao inserir fluxo_caixa:", insertErr);
                  else console.log("[ACTION] Fluxo de caixa inserido com sucesso!");
                  whatsAppText = `✅ Pronto! Lançamento de ${actionData.tipo_movimentacao} (R$ ${actionData.valor}) registrado no Livro Caixa.`;
              } 
              else if (actionData.acao === "CRIAR_PMOC") {
                  const { error: insertErr } = await supabase.from('contratos_pmoc').insert({
                      tipo_contrato: actionData.tipo_contrato,
                      valor_contrato: parseFloat(actionData.valor_contrato) || 0,
                      vigencia_meses: actionData.vigencia_meses,
                      clausulas_especiais: actionData.clausulas_especiais
                  });
                  if (insertErr) console.error("[ACTION] Erro ao inserir PMOC:", insertErr);
                  else console.log("[ACTION] PMOC inserido com sucesso!");
                  whatsAppText = `⚖️ PMOC Minute gerada e contratada no sistema! Vigência: ${actionData.vigencia_meses} meses.`;
              }
              else if (actionData.acao === "CRIAR_NOTIFICACAO") {
                  const { error: insertErr } = await supabase.from('notificacoes_internas').insert({
                      tipo: "Auditoria de Instalação (Ian)",
                      mensagem: actionData.mensagem,
                      lida: false
                  });
                  if (insertErr) console.error("[ACTION] Erro ao inserir notificação:", insertErr);
                  else console.log("[ACTION] Notificação inserida com sucesso!");
                  whatsAppText = `🔍 Laudo processado e salvo na base de notificações para auditoria futura.`;
              }
              else if (actionData.acao === "CRIAR_CADASTRO") {
                  const { error: insertErr } = await supabase.from('clientes').insert({
                      nome_cliente: actionData.nome_cliente,
                      whatsapp: remoteJid,
                      endereco_completo: actionData.endereco_completo,
                      documento_cpf_cnpj: actionData.cpf_cnpj,
                      relato_necessidade: actionData.relato
                  });
                  if (insertErr) console.error("[ACTION] Erro ao inserir cliente:", insertErr);
                  else console.log(`[ACTION] ✅ CLIENTE SALVO: ${actionData.nome_cliente} | ${remoteJid}`);
                  whatsAppText = actionData.mensagem_pro_cliente || "✅ Perfeito! Tudo registrado e encaminhado aos responsáveis. Retornaremos assim que possível!";
              }
          }
      } catch(e) {
          console.error("Falha ao tentar realizar JSON ACTION. Respondendo naturalmente.", e);
      }

      await supabase.from('agent_memory').insert({
          phone: remoteJid,
          role: 'model',
          content: aiResponse
      });

      // uazapiUrl and uazapiToken already declared and fetched at the top of processRequest

      if (uazapiUrl) {
          // Delay de simulação humana natural (2.5s)
          await new Promise(resolve => setTimeout(resolve, 2500));
          
          const endpoint = uazapiUrl.endsWith('/') ? `${uazapiUrl}send/text` : `${uazapiUrl}/send/text`;
          const activeToken = payload?.token || uazapiToken || '';

          const uazapiResponse = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'token': activeToken },
              body: JSON.stringify({ number: remoteJid, text: whatsAppText })
          });
          console.log(`[UAZAPI RETORNO] Status: ${uazapiResponse.status}`);
      }

    } catch (err) {
      console.error("Erro no processamento:", err);
    }
  };

  // 3. Executar Processador em Background, sem prender a Response.
  const promise = processRequest();
  
  if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
      EdgeRuntime.waitUntil(promise);
  } else {
      // Fallback
      promise.catch(console.error);
  }

  // 4. Liberação Imediata da Uazapi (Aniquila a causa raiz da duplicação/timeout)
  return new Response("OK", { status: 200 });
});
