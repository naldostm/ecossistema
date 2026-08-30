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
1. Assim que você concluir a coleta de dados de um cliente novo ou coletar os detalhes do serviço, retorne IMEDIATAMENTE APENAS o JSON abaixo:
{"acao": "CRIAR_CADASTRO", "nome_cliente": "Nome", "endereco_completo": "Endereço", "cpf_cnpj": "Opcional", "relato": "Forte Resumo do Caso", "mensagem_pro_cliente": "Seu agradecimento confirmando que está passando tudo para orçamentistas."}

2. COMANDO DO GESTOR (ARNALDO):
Se o Arnaldo pedir para você chamar, entrar em contato ou oferecer algum serviço/promoção/preventiva para um cliente específico ou número de telefone, monte a mensagem persuasiva e retorne APENAS o JSON:
{"acao": "DISPARAR_CONTATO_ATIVO", "telefone_destino": "5511999999999", "nome_cliente": "Nome", "mensagem_gerada": "Texto completo, acolhedor e persuasivo para o cliente...", "confirmacao_gestor": "✅ Perfeito, Arnaldo! Já enviei a mensagem para o cliente."}

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
  // CORS headers para chamadas do frontend (painel web)
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('OK', { status: 200, headers: corsHeaders });
  }

  // 1. Handshake Inicial (Saúde da Função)
  if (req.method === "GET") {
      const url = new URL(req.url);
      if (url.searchParams.get("debug") === "secret123") {
          const { data } = await supabase.from('agent_memory').select('*').in('phone', ['DEBUG_AUDIO', 'GLOBAL_CONFIG', 'TEST']).order('created_at', {ascending: false}).limit(10);
          return new Response(JSON.stringify(data, null, 2), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response("🤖 Maria Cecília Edge Router está Online!", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  let payload;
  let rawText = "";
  try {
      rawText = await req.text();
      try {
          payload = JSON.parse(rawText);
      } catch (parseErr) {
          const { error: insErr } = await supabase.from('agent_memory').insert({ phone: 'DEBUG_AUDIO', role: 'user', content: 'JSON PARSE ERROR. Raw text: ' + rawText.substring(0, 1000) });
          if (insErr) console.error("DEBUG INSERT ERROR:", insErr);
          return new Response("Bad Request Payload", { status: 400, headers: corsHeaders });
      }
      
      console.log("[PAYLOAD UAZAPI LIDO - COMPLETO]:", rawText);
      if (payload?.action !== 'send_manual_text') {
          const { error: insErr2 } = await supabase.from('agent_memory').insert({ phone: 'DEBUG_AUDIO', role: 'user', content: rawText });
          if (insErr2) console.error("DEBUG INSERT ERROR 2:", insErr2);
      }
  } catch (err) {
      console.error("[CRITICAL] Falha ao ler stream da Uazapi antes de liberar conexão:", err);
      await supabase.from('agent_memory').insert({ phone: 'DEBUG_AUDIO', role: 'user', content: 'STREAM READ ERROR: ' + String(err) });
      return new Response("Bad Request Payload", { status: 400, headers: corsHeaders });
  }

  // === HANDLER DIRETO PARA ENVIO MANUAL VIA PAINEL CRM ===
  if (payload?.action === 'send_manual_text') {
      const destRaw = String(payload.telefone_destino || '').trim();
      const destDigits = destRaw.replace(/\D/g, '');
      const msgText = payload.mensagem || '';
      
      if (!destDigits || !msgText) {
          console.log('[MANUAL] Faltam dados: telefone ou mensagem vazia.');
          return new Response(JSON.stringify({ error: 'Telefone ou mensagem vazia' }), { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
      }

      const manualUazapiUrl = (payload?.BaseUrl || Deno.env.get('UAZAPI_URL') || 'https://arnaldotrentin.uazapi.com').replace(/\/$/, '');
      const manualToken = payload?.token || Deno.env.get('UAZAPI_TOKEN') || 'e7ca3dea-7317-4502-894a-790655f77bb1';
      
      try {
          const sendResp = await fetch(`${manualUazapiUrl}/send/text`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'token': manualToken },
              body: JSON.stringify({ number: destDigits, text: msgText })
          });
          const sendData = await sendResp.json().catch(() => ({}));
          console.log(`[MANUAL] Mensagem enviada para ${destDigits}. Status: ${sendResp.status}`);
          return new Response(JSON.stringify({ success: true, status: sendResp.status, data: sendData }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
      } catch (err) {
          console.error('[MANUAL] Erro ao disparar mensagem via Uazapi:', err);
          return new Response(JSON.stringify({ error: String(err) }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
      }
  }

  // === HANDLER DIRETO PARA ORDEM ATIVA DO GESTOR (MARIA CECÍLIA) ===
  if (payload?.action === 'execute_ai_order') {
      const destRaw = String(payload.telefone_destino || '').trim();
      let targetPhone = destRaw.replace(/\D/g, '');
      if (!targetPhone.startsWith('55') && targetPhone.length <= 11) targetPhone = '55' + targetPhone;
      const clientName = payload.nome_cliente || 'Cliente';
      const cmdText = payload.ordem || '';

      if (!targetPhone || !cmdText) {
          return new Response(JSON.stringify({ error: 'Telefone ou ordem vazia' }), { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
      }

      const manualUazapiUrl = (payload?.BaseUrl || Deno.env.get('UAZAPI_URL') || 'https://arnaldotrentin.uazapi.com').replace(/\/$/, '');
      const manualToken = payload?.token || Deno.env.get('UAZAPI_TOKEN') || 'e7ca3dea-7317-4502-894a-790655f77bb1';

      try {
          // Busca histórico recente para dar contexto à Maria
          const { data: hist } = await supabase.from('agent_memory')
              .select('role, content')
              .eq('phone', targetPhone)
              .order('created_at', { ascending: false })
              .limit(8);

          let histContext = "";
          if (hist && hist.length > 0) {
              histContext = "\nHistórico recente da conversa com o cliente:\n" + hist.reverse().map(h => `${h.role === 'model' ? 'Maria' : 'Cliente'}: ${h.content}`).join('\n') + "\n";
          }

          const prompt = `Você é Maria Cecília, atendente comercial sênior da Arnaldo Trentin Serviços (Engenharia, Climatização e Refrigeração).
O gestor da empresa, Arnaldo, te deu a seguinte ordem direta para enviar para o cliente ${clientName}:
"${cmdText}"

${histContext}
INSTRUÇÕES OBRIGATÓRIAS:
- Redija a mensagem de WhatsApp pronta para enviar diretamente para o cliente ${clientName}.
- Seja calorosa, natural, educada e persuasiva.
- Fale em primeira pessoa como Maria Cecília da Arnaldo Trentin.
- Não use jargões de robô, nem introduções como "Olá Arnaldo" ou "Aqui está a mensagem". Retorne APENAS o texto exato que será enviado para o WhatsApp do cliente.`;

          const model = genAI.getGenerativeModel({
              model: "gemini-2.5-flash",
              generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
          });

          const res = await model.generateContent(prompt);
          const generatedMsg = res.response.text().trim();

          // 1. Reativa a Maria para este contato (garante que ela responderá quando o cliente responder)
          await supabase.from('agent_memory').insert({
              phone: targetPhone,
              role: 'user',
              content: 'BOT_ATIVO'
          });

          // 2. Grava a mensagem gerada pela Maria no histórico
          await supabase.from('agent_memory').insert({
              phone: targetPhone,
              role: 'model',
              content: generatedMsg
          });

          // 3. Dispara a mensagem via UazAPI / WhatsApp
          const sendResp = await fetch(`${manualUazapiUrl}/send/text`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'token': manualToken },
              body: JSON.stringify({ number: targetPhone, text: generatedMsg })
          });

          console.log(`[ORDEM IA SUCESSO] Maria disparou para ${targetPhone}: "${generatedMsg}". Status Uazapi: ${sendResp.status}`);

          return new Response(JSON.stringify({ 
              success: true, 
              mensagem_gerada: generatedMsg,
              status_uazapi: sendResp.status 
          }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

      } catch (err: any) {
          console.error('[ORDEM IA ERRO] Falha ao processar ordem da Maria:', err);
          return new Response(JSON.stringify({ error: String(err?.message || err) }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
      }
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
      const isFileDownloaded = (eventType === "messages_update" && payload?.event?.Type === "FileDownloaded");

      if (eventType && eventType !== "messages" && eventType !== "messages.upsert" && !isFileDownloaded) {
          console.log(`[IGNORADO] Evento não é de mensagem. Recebido: ${eventType}`);
          return;
      }

      let msgNode: any = {};
      let msgType = "";
      let remoteJid = "";
      let pushName = "Cliente";
      let userMessage = "";
      let messageId = "";
      let hasMedia = false;
      let hasAudio = false;
      let hasImage = false;
      let directUrl = "";

      if (isFileDownloaded) {
          remoteJid = payload?.event?.Sender;
          msgType = payload?.event?.MimeType?.includes('audio') ? "AudioMessage" : "ImageMessage";
          messageId = payload?.event?.MessageIDs?.[0] || "";
          hasMedia = true;
          hasAudio = payload?.event?.MimeType?.includes('audio');
          directUrl = payload?.event?.FileURL;
      } else {
          msgNode = payload?.data?.message || payload?.message || {};
          // Uazapi: messageType está em msgNode.messageType ("AudioMessage"), msgNode.type é genérico ("media")
          msgType = payload?.data?.messageType || payload?.messageType || msgNode?.messageType || msgNode?.type || payload?.type || "";
          remoteJid = msgNode?.chatid || msgNode?.sender_pn || payload?.chat?.wa_chatid || payload?.data?.key?.remoteJid;
          pushName = msgNode?.senderName || payload?.data?.pushName || payload?.chat?.name || "Cliente";
          // Não incluir msgNode.content na cadeia — no Uazapi, content é um OBJETO com URL/mimetype, não string
          userMessage = msgNode?.conversation || msgNode?.extendedTextMessage?.text || msgNode?.audioMessage?.text || msgNode?.audioMessage?.transcription || msgNode?.imageMessage?.caption || msgNode?.videoMessage?.caption || (typeof msgNode?.text === 'string' && msgNode.text.length > 0 ? msgNode.text : "") || payload?.text || "";
          messageId = payload?.data?.key?.id || payload?.message?.id || payload?.message?.key?.id || payload?.key?.id || msgNode?.id || payload?.message?.messageid || "";
          // Detecção robusta: checar msgType, msgNode.mediaType ("ptt"), msgNode.messageType ("AudioMessage"), e content.mimetype
          const contentMime = typeof msgNode?.content?.mimetype === 'string' ? msgNode.content.mimetype.toLowerCase() : "";
          hasAudio = msgType.toLowerCase().includes('audio') || msgType === 'ptt' || msgNode?.mediaType === 'ptt' || msgNode?.audioMessage || contentMime.includes('audio');
          hasImage = msgType.toLowerCase().includes('image') || msgType.toLowerCase().includes('video') || msgNode?.imageMessage || msgNode?.videoMessage || contentMime.includes('image');
          hasMedia = hasAudio || hasImage || msgType === 'media' || msgNode?.mediaType === 'ptt';
      }

      if (!remoteJid) {
          console.log(`[IGNORADO] remoteJid não encontrado.`);
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

      remoteJid = remoteJid.split('@')[0].replace(/\D/g, '');
      if (!remoteJid.startsWith('55') && remoteJid.length >= 10 && remoteJid.length <= 11) {
          remoteJid = '55' + remoteJid;
      }
      
      // Sanitização Limpa antes de usar na Triagem de Arquivos
      if (typeof userMessage !== 'string') {
          userMessage = "";
      }

      // CONTROLE DE PAUSA E COMANDOS DO GESTOR (Atendimento Humano Individual)
      const isMessageFromMe = payload?.message?.fromMe === true || payload?.fromMe === true || payload?.data?.key?.fromMe === true || payload?.data?.fromMe === true || msgNode?.fromMe === true;
      const sentByApi = payload?.message?.wasSentByApi === true || payload?.data?.message?.wasSentByApi === true || payload?.wasSentByApi === true;
      
      if (isMessageFromMe || sentByApi) {
          console.log(`[FROM ME] Mensagem detectada. isFromMe: ${isMessageFromMe}, sentByApi: ${sentByApi}. JID: ${remoteJid}.`);
          
          // Se for uma mensagem digitada manualmente pelo humano diretamente no WhatsApp (não-API)
          if (isMessageFromMe && !sentByApi && userMessage && userMessage.trim().length > 0) {
              const myText = userMessage.trim().toLowerCase();
              if (myText === '/ignorar' || myText === '/amigo' || myText === '/blacklist') {
                  await supabase.from('agent_memory').insert({ phone: remoteJid, role: 'user', content: 'BOT_IGNORAR' });
                  console.log(`[LISTA NEGRA] Contato ${remoteJid} adicionado à Lista Negra permanentemente.`);
                  return;
              }
              if (myText === '/retomar' || myText === '/ativo') {
                  await supabase.from('agent_memory').insert({ phone: remoteJid, role: 'user', content: 'BOT_ATIVO' });
                  console.log(`[ATENDIMENTO HUMANO] Robô RETOMADO para o cliente ${remoteJid}`);
                  return;
              }
              if (myText === '/pausar') {
                  await supabase.from('agent_memory').insert({ phone: remoteJid, role: 'user', content: 'BOT_PAUSADO' });
                  console.log(`[ATENDIMENTO HUMANO] Robô PAUSADO para o cliente ${remoteJid}`);
                  return;
              }

              // 1. Grava a mensagem do Arnaldo para aparecer no histórico do chat no ecossistema
              const formattedArnaldoMsg = `👨‍🔧 *Arnaldo Trentin:* ${userMessage.trim()}`;
              await supabase.from('agent_memory').insert({
                  phone: remoteJid,
                  role: 'model',
                  content: formattedArnaldoMsg
              });

              // 2. Pausa a IA para que a Maria não responda por cima do atendimento humano
              const { data: currentPause } = await supabase.from('agent_memory').select('content').eq('phone', remoteJid).eq('role', 'user').in('content', ['BOT_PAUSADO', 'BOT_ATIVO']).order('created_at', { ascending: false }).limit(1);
              if (!currentPause || currentPause.length === 0 || currentPause[0].content !== 'BOT_PAUSADO') {
                  await supabase.from('agent_memory').insert({ phone: remoteJid, role: 'user', content: 'BOT_PAUSADO' });
                  console.log(`[ATENDIMENTO HUMANO] Pausa Automática ativada no JID: ${remoteJid}`);
              }
          }
          return;
      }

      const uazapiUrl = (payload?.BaseUrl || payload?.baseUrl || Deno.env.get('UAZAPI_URL') || '').replace(/\/$/, '');
      const uazapiToken = payload?.token || Deno.env.get('UAZAPI_TOKEN') || "";
      const payloadMime = payload?.data?.message?.audioMessage?.mimetype || payload?.message?.audioMessage?.mimetype || payload?.data?.message?.imageMessage?.mimetype || payload?.message?.imageMessage?.mimetype || payload?.message?.content?.mimetype || "";
      const payloadBase64 = payload?.data?.message?.base64 || payload?.message?.base64 || msgNode?.base64 || payload?.data?.base64 || payload?.base64 || "";
      const cleanMsgId = messageId.includes(':') ? messageId.split(':')[1] : messageId;

      // ==========================================
      // MÍDIA: Processar inline (sem offload)
      // ==========================================
      if (hasMedia) {
          console.log(`[MÍDIA INLINE] Processando mídia diretamente. isFileDownloaded=${isFileDownloaded} | hasAudio=${hasAudio} | directUrl=${directUrl} | ID: ${cleanMsgId}`);
      }
      
      let mediaPart = null;
      let forceAnalysisText = false;

      // 2. Blindagem contra mensagens vazias (acs/status updates/updates sem texto ou áudio)
      if (!userMessage && !hasAudio && !hasImage) {
          console.log(`[IGNORADO] Evento vazio de status/ack para ${remoteJid}.`);
          return;
      }

      // 3. Deduplicação ATÔMICA por ID - grava lock em phone separado para não poluir conversa
      if (cleanMsgId && cleanMsgId.trim().length > 0) {
          const lockPhone = `LOCK_${remoteJid}`;
          const lockContent = `[LOCK:${cleanMsgId}]`;
          const { data: existingLock } = await supabase
              .from('agent_memory')
              .select('id')
              .eq('phone', lockPhone)
              .like('content', `%${lockContent}%`)
              .limit(1);
              
          if (existingLock && existingLock.length > 0) {
              console.log(`[DEDUPLICADOR ATÔMICO] Mensagem já em processamento (ID: ${cleanMsgId}). Abortando.`);
              return;
          }
          // Grava o lock em phone separado para não aparecer na conversa
          await supabase.from('agent_memory').insert({ phone: lockPhone, role: 'user', content: lockContent });
      }

      // 4. Deduplicação por Conteúdo de Texto Idêntico nos últimos 15 segundos
      if (userMessage && userMessage.trim().length > 0) {
          const fifteenSecsAgo = new Date(Date.now() - 15000).toISOString();
          const { data: recentSameText } = await supabase
              .from('agent_memory')
              .select('id, content')
              .eq('phone', remoteJid)
              .eq('role', 'user')
              .gte('created_at', fifteenSecsAgo)
              .limit(5);

          const cleanUserText = userMessage.trim().toLowerCase();
          const isDuplicateText = (recentSameText || []).some(m => {
              const stored = (m.content || '').toLowerCase();
              return stored.includes(cleanUserText) && cleanUserText.length > 2;
          });

          if (isDuplicateText) {
              console.log(`[DEDUPLICADOR TEXTO] Mensagem duplicada recebida em menos de 15s para ${remoteJid}. Abortando.`);
              return;
          }
      }

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
      directUrl = directUrl || getDirectUrl();

      // Helper para detectar o MIME Type exato (Gemini precisa de audio/ogg para notas de voz do WhatsApp)
      const resolveMediaMime = (base64Str: string, isAudio: boolean, suggested?: string): string => {
          if (suggested && suggested.includes('/')) {
              const s = suggested.toLowerCase().trim();
              if (s.includes('ogg') || s.includes('opus')) return 'audio/ogg';
              if (s.includes('mpeg') || s.includes('mp3')) return 'audio/mp3';
              if (s.includes('mp4') || s.includes('m4a') || s.includes('aac')) return 'audio/mp4';
              if (s.includes('wav')) return 'audio/wav';
              if (s.includes('jpeg') || s.includes('jpg')) return 'image/jpeg';
              if (s.includes('png')) return 'image/png';
              if (s.includes('webp')) return 'image/webp';
              return s;
          }
          if (base64Str.startsWith('T2dnUw')) return 'audio/ogg'; // Magic bytes OggS
          if (base64Str.startsWith('SUQz') || base64Str.startsWith('/+NI')) return 'audio/mp3'; // ID3 / MPEG
          if (base64Str.startsWith('AAAA') || base64Str.substring(0, 40).includes('ZnR5cA')) return 'audio/mp4'; // ftyp
          if (base64Str.startsWith('UklGR')) return 'audio/wav'; // RIFF
          if (base64Str.startsWith('/9j/')) return 'image/jpeg'; // JPEG
          if (base64Str.startsWith('iVBORw')) return 'image/png'; // PNG
          return isAudio ? 'audio/ogg' : 'image/jpeg';
      };

      // Caso 1: Baixar diretamente se a URL pública estiver no payload
      if (hasMedia && directUrl) {
          try {
              console.log(`[MÍDIA] Tentando baixar diretamente da URL do payload: ${directUrl}`);
              const fileReq = await fetch(directUrl);
              if (fileReq.ok) {
                  const buffer = await fileReq.arrayBuffer();
                  const pureBase64 = encodeBase64(buffer);
                  const mimeType = resolveMediaMime(pureBase64, hasAudio, payloadMime);
                  mediaPart = { inlineData: { mimeType: mimeType, data: pureBase64 } };
                  if (!userMessage || forceAnalysisText) {
                      userMessage = hasAudio ? "[🎙️ Áudio de Voz enviado pelo cliente]" : "[📷 Foto enviada pelo cliente]";
                      forceAnalysisText = true;
                  }
                  console.log(`[SUCESSO] Mídia baixada diretamente da URL! MIME: ${mimeType} | length: ${pureBase64.length}`);
              } else {
                  console.log(`[FALHA MÍDIA] Falha ao baixar diretamente da URL. Status: ${fileReq.status}`);
              }
          } catch(err: any) {
              console.error("[FALHA MÍDIA] Erro ao baixar diretamente da URL:", err?.message || err);
          }
      }

      // Caso 2: Tentar base64 direto do payload
      if (!mediaPart && hasMedia && payloadBase64) {
          const pureBase64 = payloadBase64.includes('base64,') ? payloadBase64.split('base64,')[1] : payloadBase64;
          const mimeType = resolveMediaMime(pureBase64, hasAudio, payloadMime);
          mediaPart = { inlineData: { mimeType: mimeType, data: pureBase64 } };
          if (!userMessage || forceAnalysisText) {
              userMessage = hasAudio ? "[🎙️ Áudio de Voz enviado pelo cliente]" : "[📷 Foto enviada pelo cliente]";
              forceAnalysisText = true;
          }
          console.log(`[SUCESSO] Mídia encontrada no PAYLOAD direto! MIME: ${mimeType} | length: ${pureBase64.length}`);
      } 
      // Caso 3: Chamar a API de download do UazAPI com retry e delay
      else if (!mediaPart && hasMedia && messageId && uazapiUrl && uazapiToken) {
          const downloadWithRetry = async (retries = 1, delayMs = 0) => {
              const activeDownloadToken = payload?.token || uazapiToken || '';
              
              for (let attempt = 1; attempt <= retries; attempt++) {
                  try {
                      console.log(`[MÍDIA] Tentativa ${attempt} de download via Uazapi GO. ID: ${messageId} | cleanID: ${cleanMsgId}`);
                      
                      const reqBody = { id: cleanMsgId, messageId: cleanMsgId, key: { id: cleanMsgId, remoteJid: `${remoteJid}@s.whatsapp.net` } };
                      const mediaReq = await fetch(`${uazapiUrl}/message/download?token=${activeDownloadToken}`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json", "token": activeDownloadToken },
                              body: JSON.stringify(reqBody),
                              signal: AbortSignal.timeout(6000)
                          });
                          
                          if (mediaReq.ok) {
                              const mediaData = await mediaReq.json();
                              const base64Raw = mediaData?.base64Data || mediaData?.base64 || mediaData?.data?.base64 || mediaData?.media || mediaData?.data?.media;
                              const suggestedMime = mediaData?.mimetype || mediaData?.mimeType || payloadMime;
                              
                              if (base64Raw) {
                                  const pureBase64 = base64Raw.includes('base64,') ? base64Raw.split('base64,')[1] : base64Raw;
                                  const mimeType = resolveMediaMime(pureBase64, hasAudio, suggestedMime);
                                  mediaPart = { inlineData: { mimeType: mimeType, data: pureBase64 } };
                                  if (!userMessage || forceAnalysisText) {
                                      userMessage = hasAudio ? "[🎙️ Áudio de Voz enviado pelo cliente]" : "[📷 Foto enviada pelo cliente]";
                                      forceAnalysisText = true;
                                  }
                                  console.log(`[SUCESSO] Mídia baixada da UazAPI! MIME: ${mimeType}`);
                                  return true;
                              } else if (mediaData?.fileURL || mediaData?.url) {
                                  const targetFileUrl = mediaData?.fileURL || mediaData?.url;
                                  console.log(`[MÍDIA] URL física retornada: ${targetFileUrl}`);
                                  const fileReq = await fetch(targetFileUrl, { signal: AbortSignal.timeout(5000) });
                                  if (fileReq.ok) {
                                      const buffer = await fileReq.arrayBuffer();
                                      const pureBase64 = encodeBase64(buffer);
                                      const mimeType = resolveMediaMime(pureBase64, hasAudio, suggestedMime);
                                      mediaPart = { inlineData: { mimeType: mimeType, data: pureBase64 } };
                                      if (!userMessage || forceAnalysisText) {
                                          userMessage = hasAudio ? "[🎙️ Áudio de Voz enviado pelo cliente]" : "[📷 Foto enviada pelo cliente]";
                                          forceAnalysisText = true;
                                      }
                                      await supabase.from('agent_memory').insert({ phone: 'DEBUG_AUDIO', role: 'user', content: `[SUCESSO] Mídia baixada (URL física)! MIME: ${mimeType}` });
                                      console.log(`[SUCESSO] Mídia baixada da URL física! MIME: ${mimeType}`);
                                      return true;
                                  }
                              }
                          } else {
                              const errText = await mediaReq.text();
                              console.log(`[FALHA MÍDIA] Status: ${mediaReq.status}. Resposta: ${errText.substring(0, 150)}`);
                          }
                  } catch (err: any) {
                      console.error(`[FALHA MÍDIA] Erro na tentativa ${attempt}:`, err?.message || err);
                  }
              }
              return false;
          };
          
          const success = await downloadWithRetry();
          if (!success) {
              await supabase.from('agent_memory').insert({ 
                  phone: 'DEBUG_AUDIO', 
                  role: 'user', 
                  content: `Falha no download da mídia. ID: ${messageId}` 
              });
          }
      } else if (hasMedia && !messageId) {
          console.log(`[DIAG] Mídia detectada mas sem messageId para download.`);
      }

      // Se falhou o download da mídia, abortar silenciosamente
      // (o webhook paralelo que teve sucesso já vai responder)
      if (!userMessage && !mediaPart) {
          if (hasMedia) {
              console.log(`[ABORTADO] Download de mídia falhou. Não enviando fallback para evitar resposta contraditória.`);
              return;
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

      const msgIdTag = messageId ? `[MSG_ID:${messageId}] ` : '';
      let exactUserPayload = `${msgIdTag}Mensagem do Cliente (${pushName}): ${userMessage}`;
      
      // NÃO gravar base64 da mídia no banco — polui a conversa e ocupa espaço
      if (mediaPart && mediaPart.inlineData) {
          if (hasAudio) {
              exactUserPayload += `\n[MEDIA_AUDIO: Áudio de voz recebido - ${mediaPart.inlineData.mimeType}]`;
          } else {
              exactUserPayload += `\n[MEDIA_IMAGE: Imagem recebida - ${mediaPart.inlineData.mimeType}]`;
          }
      }

      // 1. O Isolate insere imediatamente a mensagem do usuário no banco (garantindo histórico em tempo real no CRM)
      const { data: insertedData, error: insertError } = await supabase.from('agent_memory').insert({
          phone: remoteJid,
          role: 'user',
          content: exactUserPayload
      }).select('id, created_at').single();

      if (!insertedData) {
          await supabase.from('agent_memory').insert({ phone: 'DEBUG_AUDIO', role: 'user', content: `Falha ao gravar memória de entrada: ${JSON.stringify(insertError)}` });
          return;
      }
      const myId = insertedData.id;

      // 2. VERIFICAÇÃO DE PAUSA GLOBAL MESTRE (Mensagem gravada no CRM, mas IA em silêncio)
      const { data: globalCfg } = await supabase.from('agent_memory').select('content').eq('phone', 'GLOBAL_CONFIG').order('created_at', {ascending: false}).limit(1);
      if (globalCfg && globalCfg.length > 0 && globalCfg[0].content === 'GLOBAL_PAUSE') {
          console.log(`[PAUSA GLOBAL] Mensagem registrada no chat, mas o Botão Mestre está OFF. Robô em silêncio.`);
          return;
      }

      // 3. VERIFICAÇÃO DE LISTA NEGRA E PAUSA TÉCNICA (Mensagem gravada no CRM para atendimento humano)
      const { data: pauseState } = await supabase
          .from('agent_memory')
          .select('content')
          .eq('phone', remoteJid)
          .eq('role', 'user')
          .in('content', ['BOT_PAUSADO', 'BOT_ATIVO', 'BOT_IGNORAR', 'AMIGO_IGNORAR', 'LISTA_NEGRA'])
          .order('created_at', { ascending: false })
          .limit(1);
          
      if (pauseState && pauseState.length > 0) {
          const state = pauseState[0].content;
          if (state === 'BOT_IGNORAR' || state === 'AMIGO_IGNORAR' || state === 'LISTA_NEGRA') {
              console.log(`[LISTA NEGRA] Mensagem registrada no chat, robô está permanentemente ignorado para ${remoteJid}.`);
              return;
          }
          if (state === 'BOT_PAUSADO') {
              console.log(`[PAUSADO] Mensagem registrada no chat, atendimento humano em andamento para ${remoteJid}.`);
              return;
          }
      }

      // 4. Buffer de Debounce (500ms para mídia, 1500ms para texto)
      if (hasMedia) {
          console.log(`[DEBOUNCE CURTO] Mídia detectada, aguardando 500ms para deduplicar webhooks...`);
          await new Promise(r => setTimeout(r, 500));
      } else {
          console.log(`[DEBOUNCE INICIADO] Aguardando 1500ms para mensagens adicionais de ${remoteJid}...`);
          await new Promise(r => setTimeout(r, 1500));
      }

      // 5. Eleição de Liderança por Telefone:
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
          const cleanContent = (msg.content || '')
              .replace(/\[MSG_ID:[^\]]+\]\s*/g, '')
              .replace(/\[MEDIA_AUDIO_B64:[^\]]+\]\s*/g, '')
              .replace(/\[MEDIA_IMAGE_B64:[^\]]+\]\s*/g, '')
              .replace(/\[MEDIA_AUDIO:[^\]]+\]\s*/g, '')
              .replace(/\[MEDIA_IMAGE:[^\]]+\]\s*/g, '')
              .replace(/\[LOCK:[^\]]+\]\s*/g, '');
          const r = msg.role === 'model' ? 'model' : 'user';
          if (r === lastRole && squashedHistory.length > 0) {
              squashedHistory[squashedHistory.length - 1].parts[0].text += `\n${cleanContent}`;
          } else {
              squashedHistory.push({ role: r, parts: [{ text: cleanContent }] });
              lastRole = r;
          }
      }

      // Garante que o histórico para o Gemini comece com 'user'
      if (squashedHistory.length > 0 && squashedHistory[0].role === 'model') {
          squashedHistory.shift();
      }

      // A última entrada no squashedHistory agora é a mensagem consolidada do cliente
      let currentPrompt = exactUserPayload
          .replace(/\[MSG_ID:[^\]]+\]\s*/g, '')
          .replace(/\[MEDIA_AUDIO_B64:[^\]]+\]\s*/g, '')
          .replace(/\[MEDIA_IMAGE_B64:[^\]]+\]\s*/g, '')
          .replace(/\[MEDIA_AUDIO:[^\]]+\]\s*/g, '')
          .replace(/\[MEDIA_IMAGE:[^\]]+\]\s*/g, '')
          .replace(/\[LOCK:[^\]]+\]\s*/g, '');
          
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
              else if (actionData.acao === "DISPARAR_CONTATO_ATIVO" && actionData.telefone_destino) {
                  let targetPhone = String(actionData.telefone_destino).replace(/\D/g, '');
                  if (!targetPhone.startsWith('55') && targetPhone.length <= 11) targetPhone = '55' + targetPhone;
                  
                  // Salva a mensagem no histórico do cliente para a IA manter o contexto
                  await supabase.from('agent_memory').insert({
                      phone: targetPhone,
                      role: 'model',
                      content: actionData.mensagem_gerada
                  });

                  // Dispara via UazAPI / WhatsApp
                  if (uazapiUrl) {
                      try {
                          const endpoint = uazapiUrl.endsWith('/') ? `${uazapiUrl}send/text` : `${uazapiUrl}/send/text`;
                          const activeToken = payload?.token || uazapiToken || '';
                          await fetch(endpoint, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'token': activeToken },
                              body: JSON.stringify({ number: targetPhone, text: actionData.mensagem_gerada })
                          });
                          console.log(`[DISPARO ATIVO SUCESSO] Mensagem enviada para ${targetPhone}`);
                      } catch (sendErr) {
                          console.error("[DISPARO ATIVO ERRO] Falha ao enviar:", sendErr);
                      }
                  }
                  whatsAppText = actionData.confirmacao_gestor || `✅ Mensagem enviada para ${actionData.nome_cliente || targetPhone} no WhatsApp!`;
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
          // Sem delay forçado enorme
          
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
  return new Response(JSON.stringify({ status: "OK" }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
