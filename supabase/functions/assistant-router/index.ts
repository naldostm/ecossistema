import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') ?? '');

// === FUNÇÕES AUXILIARES DE NORMALIZAÇÃO E TEMPO ===

function getPhoneVariants(rawPhone: string): string[] {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (!digits || digits.length < 8) return [];
  const variants = new Set<string>();
  variants.add(digits);
  
  const without55 = digits.replace(/^55/, '');
  variants.add(without55);
  variants.add(`55${without55}`);

  // Se for celular brasileiro (com DDD)
  if (without55.length === 11 && without55.charAt(2) === '9') {
    const ddd = without55.substring(0, 2);
    const rest8 = without55.substring(3);
    variants.add(`${ddd}${rest8}`);
    variants.add(`55${ddd}${rest8}`);
  } else if (without55.length === 10) {
    const ddd = without55.substring(0, 2);
    const rest8 = without55.substring(2);
    variants.add(`${ddd}9${rest8}`);
    variants.add(`55${ddd}9${rest8}`);
  }
  return Array.from(variants);
}

function buildTemporalContext(): { promptContext: string; saudacaoObrigatoria: string; isExpediente: boolean; spTimeStr: string } {
  // Horário oficial de Brasília (America/Sao_Paulo)
  const spNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const spHour = spNow.getHours();
  const spMinute = spNow.getMinutes();
  const spDayOfWeek = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][spNow.getDay()];
  const spDateStr = spNow.toLocaleDateString('pt-BR');
  const spTimeStr = `${String(spHour).padStart(2, '0')}:${String(spMinute).padStart(2, '0')}`;

  const isExpediente = spHour >= 7 && spHour < 20;
  let saudacaoObrigatoria = "";
  let periodoNome = "";

  if (spHour >= 7 && spHour < 12) {
    saudacaoObrigatoria = "Bom dia";
    periodoNome = "Manhã (07h às 12h)";
  } else if (spHour >= 12 && spHour < 18) {
    saudacaoObrigatoria = "Boa tarde";
    periodoNome = "Tarde (12h às 18h)";
  } else if (spHour >= 18 && spHour < 20) {
    saudacaoObrigatoria = "Boa noite";
    periodoNome = "Noite (18h às 20h - final de expediente)";
  } else {
    saudacaoObrigatoria = (spHour >= 20 || spHour < 5) ? "Boa noite" : "Bom dia";
    periodoNome = "Fora do Horário de Expediente (Expediente: todos os dias das 07h às 20h)";
  }

  const promptContext = `
=== CONTEXTO TEMPORAL & REGRAS DE HORÁRIO (RIGOROSO) ===
- Data e Hora Atual (Horário de Brasília): ${spDayOfWeek}, ${spDateStr} às ${spTimeStr}.
- Período Atual: ${periodoNome}.
- REGRA ABSOLUTA DE SAUDAÇÃO: Se for saudar o cliente, você DEVE usar estritamente a saudação "${saudacaoObrigatoria}".
  * NUNCA diga "Boa tarde" após as 18:00! (Após as 18h é estritamente "Boa noite").
  * NUNCA diga "Bom dia" após as 12:00! (A partir das 12h é estritamente "Boa tarde").
  * NUNCA diga "Boa noite" antes das 18:00!
- HORÁRIO DE ATENDIMENTO DA EMPRESA: Todos os dias das 07:00 às 20:00.
${!isExpediente ? `- ⚠️ ATENÇÃO: ESTAMOS FORA DO HORÁRIO DE EXPEDIENTE (Agora são ${spTimeStr}).
  * Acolha com muito carinho, simpatia e gentileza.
  * Informe educadamente que o expediente de hoje encerrou às 20h e que a equipe técnica e atendimento retornarão a partir das 07h da manhã.
  * Colete todos os detalhes do serviço/necessidade e tranquilize o cliente garantindo que a solicitação foi registrada com prioridade total para abertura do dia seguinte.` : '- ✅ DENTRO DO HORÁRIO DE EXPEDIENTE (07:00 às 20:00): Atendimento comercial a pleno vapor.'}
========================================================
`;

  return { promptContext, saudacaoObrigatoria, isExpediente, spTimeStr };
}

const SYSTEM_PROMPTS: Record<string, string> = {
  maria: `
CONTEXTO CORPORATIVO
Apresente-se cordialmente como Maria Cecília da Arnaldo Trentin Serviços (Engenharia, Climatização e Refrigeração). Diga apenas que você faz parte da equipe da empresa (NUNCA mencione cargos como "secretária executiva", "assistente de operações" ou títulos formais). Seja muito simpática, acolhedora, ágil, prestativa e natural.
O responsável técnico e dono da empresa se chama Arnaldo Trentin. Se pedirem para falar com ele, proteja o tempo dele: diga de forma muito educada que ele está em atendimento/em campo no momento, mas afirme com segurança que você vai passar todas as informações e ele retornará em breve.

[INJECT_TEMPORAL_CONTEXT]

LEITURA DE ORDENS DE SERVIÇO (OS), AGENDAMENTOS E PROPOSTAS:
- Você tem acesso direto aos dados em tempo real da empresa injetados abaixo na seção <DADOS_DO_BANCO>.
- Se o cliente perguntar sobre Ordem de Serviço (OS), agendamento de visita técnica, status do serviço ou proposta de orçamento:
  * Consulte as informações em <DADOS_DO_BANCO> e responda com clareza, confirmando datas, serviços e status!
  * Exemplo: "Consultei aqui no sistema e sua visita técnica para manutenção do ar condicionado está agendada para amanhã às 14h com nossa equipe."
  * Se não houver OS em aberto para o cliente, informe com gentileza e pergunte como pode ajudá-lo a abrir um chamado ou agendamento.

ATENDENDO UM NOVO CONTATO (CLIENTE NOVO / NÃO CADASTRADO):
- Se o contexto indicar que é um novo contato: pergunte se é a primeira vez que fala com a empresa e acolha com entusiasmo.
- Para concluir o cadastro inicial de um NOVO cliente, colete com gentileza: Nome completo, Endereço completo onde o serviço será realizado e CPF/CNPJ (se tiver em mãos).
- Investigue a necessidade para a Engenharia elaborar o Orçamento:
  * Manutenção de Ar Condicionado: peça as fotos do aparelho, vídeos e descrição da falha.
  * Elétrica: pergunte os detalhes urgentes do problema.
  * Obra Nova: pergunte se a pessoa já possui o Projeto (Plantas).
  * Instalação de Ar: pergunte se o local já tem espera/projeto.
- Informe que os Orçamentos são entregues dentro de 48 horas e que a equipe técnica entrará em contato!

ATENDENDO QUEM JÁ É CLIENTE (Status: CADASTRADO NO SISTEMA):
- Chame SEMPRE pelo nome com carinho e entusiasmo!
- ⚠️ REGRA CRÍTICA ANTI-DUPLICAÇÃO:
  * NUNCA, SOB HIPÓTESE ALGUMA, peça Nome, Endereço ou CPF/CNPJ novamente para quem já é cadastrado!
  * Se o cliente pedir um novo serviço, visita técnica, manutenção ou orçamento: acolha com presteza, anote os detalhes da necessidade e diga claramente que já está registrando a solicitação no sistema e encaminhando para a equipe técnica retornar.
  * NUNCA execute a ação CRIAR_CADASTRO para clientes que já constam cadastrados. Apenas converse naturalmente confirmando o registro do novo chamado!
- Se o cliente reclamar de GARANTIA: Peça DESCULPAS imediatamente. Demonstre muita urgência, acolha o cliente e pergunte qual é exatamente o problema para que você direcione o atendimento o mais rápido possível!

🛡️ REGRA ABSOLUTA ANTI-SPAM, ANTI-PROPAGANDA E OUTROS ROBÔS/IAs:
- Se o remetente for uma mensagem automática de banco (ex: Itaú, Bradesco, Santander, Nubank com faturas, códigos ou avisos), propaganda de operadora (Claro, Vivo, Tim), código SMS/OTP de verificação, anúncio comercial externo ou OUTRA INTELIGÊNCIA ARTIFICIAL/ROBÔ CORPORATIVO tentando vender produtos ou apresentando menu automático (ex: "digite 1", "escolha uma opção"):
  * NUNCA RESPONDA AO ROBÔ OU PROPAGANDA! NUNCA inicie conversa com robôs corporativos!
  * Silêncio absoluto! Retorne ESTRITAMENTE o JSON:
  {"acao": "IGNORAR_SPAM_ROBO", "motivo": "Propaganda/Robô bancário ou corporativo detectado"}
  * Nenhuma palavra fora do JSON.

🎯 AÇÃO MÁGICA - CRIAR_TAREFA_GESTOR (TAREFAS E PEDIDOS PARA O ARNALDO):
- Você DEVE acionar esta ação para registrar no mural pessoal de tarefas do Arnaldo sempre que o cliente:
  1. Pedir Orçamento / Cotação de produtos ou serviços (manutenção de ar, instalação, obras, elétrica, PMOC).
  2. Pedir para falar diretamente com o Arnaldo ou solicitar que o Arnaldo ligue de volta.
  3. Solicitar agendamento de Visita Técnica presencial.
  4. Apresentar dúvida técnica aprofundada, pedido de desconto especial ou negociação que fuja do seu escopo.
- Formato rigoroso do retorno JSON:
{"acao": "CRIAR_TAREFA_GESTOR", "tipo_solicitacao": "ORCAMENTO", "titulo": "Orçamento: Instalação de Ar Condicionado", "descricao": "Cliente precisa de cotação para 2 aparelhos inverter no local informado...", "prioridade": "alta", "nome_cliente": "Nome do Cliente", "resposta_pro_cliente": "Sua mensagem calorosa confirmando com segurança que anotou todos os dados e passou imediatamente para o Arnaldo avaliar e entrar em contato!"}
* Valores possíveis para tipo_solicitacao: "ORCAMENTO", "LIGACAO_RETORNO", "VISITA_TECNICA", "DUVIDA_NEGOCIACAO".
* Valores possíveis para prioridade: "alta", "media", "baixa".

FALANDO COM PARCEIROS E PRESTADORES DA EQUIPE (FRANCISCO, MAXWELL, SERGIO PASSARELLO):
- Se o contexto indicar que o contato é prestador ou parceiro da equipe (Sr Francisco, Sr Maxwell, Sergio Passarello ou outro parceiro de pintura/técnico):
  * NUNCA tente vender serviços, NUNCA pergunte sobre aparelhos de ar e NUNCA cite horários ou regras de expediente!
  * Seja muito acolhedora, prestativa e parceira.
  * Colete recados, fotos de obra, relatórios ou atualizações de serviços que eles enviarem.
  * Confirme com simpatia que já anotou e passou tudo para o Arnaldo acompanhar!

MODÉSTIA E PRUDÊNCIA ABSOLUTA (NUNCA ADIVINHE OU ALUCINE ASSUNTOS):
- Se o cliente enviar apenas mensagens curtas ou saudações ("Bom dia", "Olá", "Arnaldo", "preciso de um retorno", "tudo bem?", "conseguiu ver?"):
  * Acolha com muita simpatia e educação (chame pelo nome se já for cadastrado).
  * NUNCA deduza ou presuma o que ele quer! NUNCA puxe assuntos antigos do passado nem cite endereços cadastrados do nada.
  * Responda de forma simples, solícita e pergunte educadamente em que pode ajudá-lo hoje, ou diga com segurança que o Arnaldo já foi avisado e vai retornar em breve.

FOTOS DE "BOM DIA", MENSAGENS RELIGIOSAS, REFLEXÕES E FIGURINHAS:
- Quando o cliente enviar imagem/foto com frase de "Bom dia", versículo bíblico, mensagem de fé, reflexão ou figurinha carinhosa:
  * Responda com ESTRITAMENTE 1 OU NO MÁXIMO 2 FRASES CURTAS, com muito carinho e bênçãos (exemplo: "Bom dia, [Nome]! Um dia muito abençoado e iluminado para você também! 🙏✨").
  * É TERMINANTEMENTE PROIBIDO gerar textos longos, fazer análises descritivas da imagem ou misturar essa resposta com orçamentos e serviços de ar condicionado!

NUNCA CITAR ENDEREÇO ESPONTANEAMENTE:
- O endereço que consta no sistema é exclusivamente para conferência interna. NUNCA inicie mensagens dizendo "Sobre o endereço tal..." ou "Referente ao endereço...". Só cite o endereço se o cliente perguntar expressamente ou se for para confirmar um agendamento já solicitado.

AÇÃO MÁGICA - CRIAR_CADASTRO (EXCLUSIVO PARA CLIENTES NOVOS):
1. Dispare a ação abaixo APENAS E EXCLUSIVAMENTE para clientes que AINDA NÃO SÃO CADASTRADOS (Status: Novo Contato/Desconhecido), após coletar Nome e Endereço:
{"acao": "CRIAR_CADASTRO", "nome_cliente": "Nome Completo", "endereco_completo": "Rua X, nº Y, Bairro, Cidade (Endereço EXATO informado pelo cliente)", "cpf_cnpj": "123.456.789-00 ou deixe vazio se não informado", "relato": "Forte Resumo do Caso e Detalhes do Serviço", "mensagem_pro_cliente": "Seu agradecimento confirmando que registrou os dados e que a equipe técnica entrará em contato dentro de 48h."}
* Se o cliente JÁ FOR CADASTRADO, NUNCA envie este JSON. Converse normalmente confirmando que o pedido já foi recebido e encaminhado.

REGRAS ABSOLUTAS DE PRECISÃO E FIDELIDADE (ÁUDIO E TEXTO):
- NUNCA invente, presuma ou preencha endereços fictícios. Use SEMPRE o endereço real e exato que o cliente informou em texto ou por mensagem de áudio de voz.
- Se o cliente enviou áudio de voz, escute com atenção redobrada para extrair o Nome, a Rua, o Número, o Bairro e o CPF/CNPJ com exatidão cirúrgica.
- Se o cliente informou o CPF/CNPJ (em áudio ou texto), coloque os números no campo "cpf_cnpj". Se ele não informou, envie "".
- NUNCA coloque as palavras literais "Opcional" ou "Endereço" como valor dos campos.

2. COMANDO DO GESTOR (ARNALDO):
Se o Arnaldo pedir para você chamar, entrar em contato ou oferecer algum serviço/promoção/preventiva para um cliente específico ou número de telefone, monte a mensagem persuasiva e retorne APENAS o JSON:
{"acao": "DISPARAR_CONTATO_ATIVO", "telefone_destino": "5511999999999", "nome_cliente": "Nome", "mensagem_gerada": "Texto completo, acolhedor e persuasivo para o cliente...", "confirmacao_gestor": "✅ Perfeito, Arnaldo! Já enviei a mensagem para o cliente."}

REGRAS FINAIS & NEGOCIAÇÃO DE VALORES:
- Você NUNCA altera, concede descontos ou negocia valores de orçamentos, visitas ou pagamentos por conta própria.
- Se o cliente pedir desconto, parcelamento especial ou tentar negociar preço:
  1. Acolha com extrema simpatia e presteza ("Com certeza! Compreendo perfeitamente sua solicitação.").
  2. Avise que vai passar imediatamente para o Arnaldo entrar em contato direto para alinhar uma condição especial com ele.
- Nunca use jargões de robô. Não invente valores ou prazos de execução fictícios. Só cite o prazo do orçamento (48hrs).
- REGRA ANTI-CONFUSÃO: Se no histórico houver mensagens de 'Arnaldo Trentin:', NUNCA diga ao cliente que você está conversando com o Arnaldo ou que o Arnaldo está em linha. Apenas continue atendendo com simpatia o que o cliente perguntou.

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
const runningAgendaTaskLocks = new Set<string>();
const userDebounceTimestamps = new Map<string, number>();

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
      let destDigits = destRaw.replace(/\D/g, '');
      if (!destDigits.startsWith('55') && destDigits.length >= 10 && destDigits.length <= 11) {
          destDigits = '55' + destDigits;
      }
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
      if (!targetPhone.startsWith('55') && targetPhone.length >= 10 && targetPhone.length <= 11) {
          targetPhone = '55' + targetPhone;
      }
      const clientName = payload.nome_cliente || 'Cliente';
      const cmdText = payload.ordem || '';
      const fileName = payload.file_name || '';
      const fileType = payload.file_type || (fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      const fileBase64 = payload.file_base64 || '';
      const fileUrl = payload.file_url || '';

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

          const prompt = `Você é Maria Cecília, secretária executiva e atendente comercial da Arnaldo Trentin Serviços (Engenharia, Climatização e Refrigeração).
O gestor da empresa, Arnaldo Trentin, te deu a seguinte ordem direta para enviar para o(a) cliente ${clientName}:
"${cmdText}"

${fileName ? `DOCUMENTO / ARQUIVO / ORÇAMENTO ANEXADO: ${fileName}\n(Mencione educadamente na mensagem que o arquivo segue em anexo para avaliação do cliente)` : ''}
${histContext}
DIRETRIZES DE RESPOSTA:
1. Escreva uma mensagem de WhatsApp COMPLETA, calorosa, educada e persuasiva para o(a) cliente ${clientName}.
2. NUNCA pare no meio da frase. Escreva o texto do começo ao fim com pontuação e conclusão completas.
3. Finalize a mensagem com uma saudação calorosa e uma pergunta aberta para facilitar a resposta do cliente (ex: "Podemos agendar uma visita essa semana?", "Ficaria bom para você na quarta-feira?").
4. Fale em primeira pessoa como Maria Cecília da Arnaldo Trentin.
5. Retorne APENAS o texto exato que será enviado no WhatsApp, sem aspas, sem prefixos como "Maria:" e sem explicações.`;

          let model = genAI.getGenerativeModel({
              model: "gemini-2.5-flash",
              generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
          });

          let res;
          try {
              res = await model.generateContent(prompt);
          } catch (modelErr) {
              console.warn('[MODEL FALLBACK] Tentando gemini-1.5-flash...', modelErr);
              model = genAI.getGenerativeModel({
                  model: "gemini-1.5-flash",
                  generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
              });
              res = await model.generateContent(prompt);
          }

          const generatedMsg = res.response.text().trim();

          // 1. Reativa a Maria para este contato (garante que ela responderá quando o cliente responder)
          await supabase.from('agent_memory').insert({
              phone: targetPhone,
              role: 'user',
              content: 'BOT_ATIVO'
          });

          // 2. Grava a mensagem gerada pela Maria no histórico (com menção ao anexo se houver)
          const storedMsg = fileName ? `${generatedMsg}\n📎 _[Arquivo enviado: ${fileName}]_` : generatedMsg;
          await supabase.from('agent_memory').insert({
              phone: targetPhone,
              role: 'model',
              content: storedMsg
          });

          // 3. Dispara a mensagem via UazAPI / WhatsApp (com arquivo ou texto puro)
          let sendStatus = 200;
          if (fileBase64 || fileUrl) {
              try {
                  const mediaEndpoint = `${manualUazapiUrl}/send/media`;
                  const mediaPayload = {
                      number: targetPhone,
                      media: fileBase64 || fileUrl,
                      caption: generatedMsg,
                      fileName: fileName || 'orcamento.pdf',
                      type: fileType.includes('pdf') ? 'document' : 'image'
                  };
                  const mediaResp = await fetch(mediaEndpoint, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'token': manualToken },
                      body: JSON.stringify(mediaPayload)
                  });
                  sendStatus = mediaResp.status;
                  if (!mediaResp.ok) {
                      console.warn('[ORDEM IA MÍDIA FALHOU] Tentando texto puro via UazAPI...', mediaResp.status);
                      const txtResp = await fetch(`${manualUazapiUrl}/send/text`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'token': manualToken },
                          body: JSON.stringify({ number: targetPhone, text: generatedMsg })
                      });
                      sendStatus = txtResp.status;
                  }
              } catch (mediaErr) {
                  console.error('[ORDEM IA MÍDIA ERRO] Tentando texto:', mediaErr);
                  const txtResp = await fetch(`${manualUazapiUrl}/send/text`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'token': manualToken },
                      body: JSON.stringify({ number: targetPhone, text: generatedMsg })
                  });
                  sendStatus = txtResp.status;
              }
          } else {
              const sendResp = await fetch(`${manualUazapiUrl}/send/text`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'token': manualToken },
                  body: JSON.stringify({ number: targetPhone, text: generatedMsg })
              });
              sendStatus = sendResp.status;
          }

          console.log(`[ORDEM IA SUCESSO] Maria disparou para ${targetPhone}: "${generatedMsg}" ${fileName ? `(Com arquivo: ${fileName})` : ''}. Status Uazapi: ${sendStatus}`);

          return new Response(JSON.stringify({ 
              success: true, 
              mensagem_gerada: generatedMsg,
              arquivo_enviado: fileName || null,
              status_uazapi: sendStatus 
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

  // 1.1 EXECUÇÃO DE MISSÕES DA AGENDA DA MARIA (PILOTO AUTOMÁTICO)
  if (payload?.action === 'execute_maria_task' || payload?.action === 'process_maria_agenda') {
      const manualUazapiUrl = (payload?.BaseUrl || Deno.env.get('UAZAPI_URL') || 'https://arnaldotrentin.uazapi.com').replace(/\/$/, '');
      const manualToken = payload?.token || Deno.env.get('UAZAPI_TOKEN') || 'e7ca3dea-7317-4502-894a-790655f77bb1';

      try {
          const executeSingleTask = async (task: any, recordId?: any) => {
              if (!task || !task.id) return { success: false, error: "Task inválida" };

              const taskLockKey = `TASK_RUN_${task.id}`;
              if (runningAgendaTaskLocks.has(taskLockKey)) {
                  console.log(`[BLOQUEIO DUPLICIDADE] Tarefa ${task.id} já está em execução. Abortando segunda chamada.`);
                  return { success: true, skipped: true };
              }
              runningAgendaTaskLocks.add(taskLockKey);
              setTimeout(() => runningAgendaTaskLocks.delete(taskLockKey), 60000);

              // 1. Atualiza imediatamente o status para 'executando' no banco para travar outros workers
              task.status = 'executando';
              if (recordId) {
                  await supabase.from('agent_memory').update({ content: JSON.stringify(task) }).eq('id', recordId);
              } else if (task.id) {
                  const { data: rec } = await supabase.from('agent_memory')
                      .select('id, content')
                      .eq('phone', 'MARIA_TASK')
                      .like('content', `%"id":"${task.id}"%`)
                      .limit(1);
                  if (rec && rec.length > 0) {
                      await supabase.from('agent_memory').update({ content: JSON.stringify(task) }).eq('id', rec[0].id);
                  }
              }

              let targetPhone = String(task.target_phone || '').replace(/\D/g, '');
              if (!targetPhone.startsWith('55') && targetPhone.length <= 11) targetPhone = '55' + targetPhone;
              const targetName = task.target_name || 'Cliente';
              const eventType = task.event_type || 'secretaria_personalizada';
              const eventLabel = task.event_label || 'Missão Comercial / Atendimento';
              const instructions = task.instructions || '';
              const fileName = task.file_name || '';
              const fileUrl = task.file_url || '';
              const fileBase64 = task.file_base64 || '';
              const fileType = task.file_type || (fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

              // Busca histórico recente para dar contexto à Maria
              const { data: hist } = await supabase.from('agent_memory')
                  .select('role, content')
                  .eq('phone', targetPhone)
                  .order('created_at', { ascending: false })
                  .limit(6);

              let histContext = "";
              if (hist && hist.length > 0) {
                  histContext = "\nHistórico recente da conversa com este contato:\n" + hist.reverse().map((h: any) => `${h.role === 'model' ? 'Maria' : targetName}: ${h.content}`).join('\n') + "\n";
              }

              let eventGuidance = "";
              if (eventType === 'confirmar_agendamento') {
                  eventGuidance = "Objetivo da Mensagem: Confirmar visita técnica / agendamento de serviço. Seja acolhedora, cite a data/horário e pergunte se está tudo confirmado para a realização do serviço.";
              } else if (eventType === 'enviar_orcamento') {
                  eventGuidance = "Objetivo da Mensagem: Apresentar a proposta/orçamento comercial. Destaque a qualidade e garantia da Arnaldo Trentin Serviços. Mencione que o documento segue em anexo para avaliação e coloque-se à total disposição para tirar dúvidas e fechar.";
              } else if (eventType === 'lembrete_pagamento') {
                  eventGuidance = "Objetivo da Mensagem: Lembrete cordial e respeitoso de pagamento ou envio de dados de faturamento/PIX. Seja extremamente educada, grata pela parceria e discreta.";
              } else if (eventType === 'cotacao_fornecedor') {
                  eventGuidance = "Objetivo da Mensagem: Contatar fornecedor de materiais, peças ou equipamentos. Apresente-se como Maria Cecília da Arnaldo Trentin Serviços e solicite cotação de preços, prazos de entrega e condições de pagamento com agilidade.";
              } else if (eventType === 'pos_venda') {
                  eventGuidance = "Objetivo da Mensagem: Pós-venda e satisfação do cliente. Pergunte como está o funcionamento do equipamento após a visita técnica e ofereça nosso plano de manutenção preventiva periódica.";
              } else {
                  eventGuidance = "Objetivo da Mensagem: Atuação como Secretária Executiva e Assistente Comercial da Arnaldo Trentin Serviços. Execute fielmente as instruções fornecidas pelo Arnaldo.";
              }

              const temporal = buildTemporalContext();
              const prompt = `Você é Maria Cecília, secretária executiva e assistente de operações da Arnaldo Trentin Serviços (Engenharia, Climatização e Refrigeração).
O gestor da empresa, Arnaldo Trentin, agendou a seguinte missão para você executar agora com o contato ${targetName} (${targetPhone}):

TIPO DE EVENTO: ${eventLabel}
${eventGuidance}

${temporal.promptContext}

INSTRUÇÕES ESPECÍFICAS DO GESTOR (ARNALDO):
"${instructions}"

${fileName ? `DOCUMENTO / ARQUIVO ANEXADO NA MENSAGEM: ${fileName}` : ''}
${histContext}
DIRETRIZES OBRIGATÓRIAS:
1. Escreva uma mensagem de WhatsApp COMPLETA, elegante, educada e altamente profissional.
2. NUNCA corte frases. Finalize a mensagem do começo ao fim.
3. Se houver arquivo anexado (${fileName}), mencione educadamente que o documento segue em anexo para análise.
4. Utilize estritamente a saudação adequada ao horário atual de Brasília ("${temporal.saudacaoObrigatoria}"). NUNCA dê "Bom dia" à noite ou "Boa noite" de dia.
5. Finalize com uma pergunta comercial acolhedora para facilitar a resposta do destinatário.
6. Fale em primeira pessoa como Maria Cecília da Arnaldo Trentin Serviços.
7. Retorne APENAS o texto exato que será enviado no WhatsApp, sem aspas e sem explicações.`;

              let model = genAI.getGenerativeModel({
                  model: "gemini-2.5-flash",
                  generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
              });

              let res;
              try {
                  res = await model.generateContent(prompt);
              } catch (modelErr) {
                  console.warn('[MODEL FALLBACK] Tentando gemini-1.5-flash...', modelErr);
                  model = genAI.getGenerativeModel({
                      model: "gemini-1.5-flash",
                      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
                  });
                  res = await model.generateContent(prompt);
              }

              const generatedMsg = res.response.text().trim();

              // 2. Garante que o BOT está 100% ATIVO para responder qualquer mensagem futura
              await supabase.from('agent_memory').insert({
                  phone: targetPhone,
                  role: 'user',
                  content: 'BOT_ATIVO'
              });

              // 3. Registra na memória a mensagem enviada pela Maria
              await supabase.from('agent_memory').insert({
                  phone: targetPhone,
                  role: 'model',
                  content: generatedMsg
              });

              // 4. Envia via UaZAPI
              let sendStatus = 200;
              if (fileBase64 || fileUrl) {
                  try {
                      const mediaPayload: Record<string, any> = {
                          number: targetPhone,
                          caption: generatedMsg,
                          type: fileName.endsWith('.pdf') ? 'document' : 'image'
                      };
                      if (fileBase64) {
                          mediaPayload.file = fileBase64;
                          mediaPayload.fileName = fileName || 'documento.pdf';
                      } else {
                          mediaPayload.url = fileUrl;
                      }

                      const mediaResp = await fetch(`${manualUazapiUrl}/send/media`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'token': manualToken },
                          body: JSON.stringify(mediaPayload)
                      });
                      sendStatus = mediaResp.status;
                      if (!mediaResp.ok) {
                          const txtResp = await fetch(`${manualUazapiUrl}/send/text`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'token': manualToken },
                              body: JSON.stringify({ number: targetPhone, text: generatedMsg })
                          });
                          sendStatus = txtResp.status;
                      }
                  } catch (mediaErr) {
                      console.error('[MEDIA SEND ERROR] Tentando texto puro:', mediaErr);
                      const txtResp = await fetch(`${manualUazapiUrl}/send/text`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'token': manualToken },
                          body: JSON.stringify({ number: targetPhone, text: generatedMsg })
                      });
                      sendStatus = txtResp.status;
                  }
              } else {
                  const sendResp = await fetch(`${manualUazapiUrl}/send/text`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'token': manualToken },
                      body: JSON.stringify({ number: targetPhone, text: generatedMsg })
                  });
                  sendStatus = sendResp.status;
              }

              const executedAt = new Date().toISOString();

              const updatedTask = {
                  ...task,
                  status: 'concluida',
                  executed_at: executedAt,
                  ai_generated_message: generatedMsg
              };

              // 5. Atualiza o registro da tarefa no banco
              if (recordId) {
                  await supabase.from('agent_memory').update({
                      content: JSON.stringify(updatedTask)
                  }).eq('id', recordId);
              } else if (task.id) {
                  const { data: rec } = await supabase.from('agent_memory')
                      .select('id, content')
                      .eq('phone', 'MARIA_TASK')
                      .like('content', `%"id":"${task.id}"%`)
                      .limit(1);
                  if (rec && rec.length > 0) {
                      await supabase.from('agent_memory').update({
                          content: JSON.stringify(updatedTask)
                      }).eq('id', rec[0].id);
                  }
              }

              return { success: true, ai_generated_message: generatedMsg, task: updatedTask };
          };

          if (payload?.action === 'execute_maria_task') {
              const result = await executeSingleTask(payload.task, payload.record_id);
              return new Response(JSON.stringify(result), {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
          }

          if (payload?.action === 'sync_maria_task_report') {
              const { task, record_id } = payload;
              const updated = await synthesizeTaskOutcome(task, record_id);
              return new Response(JSON.stringify({ success: true, task: updated }), {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
          }

          if (payload?.action === 'process_maria_agenda') {
              const temporal = buildTemporalContext();

              // 🛡️ BLINDAGEM SUPREMA DE HORÁRIO COMERCIAL (ANTI-MADRUGADA):
              // O piloto automático da Maria NUNCA pode disparar mensagens proativas fora do horário comercial (08:00 às 20:00).
              const spNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
              const currentHour = spNow.getHours();
              if (currentHour < 8 || currentHour >= 20) {
                  console.log(`[AGENDA AUTO] 🌙 Fora do horário comercial (${temporal.spTimeStr} em Brasília). Disparos automáticos bloqueados.`);
                  return new Response(JSON.stringify({ 
                      success: true, 
                      processed_count: 0, 
                      message: `Fora do horário comercial (${temporal.spTimeStr} em Brasília). Disparos automáticos bloqueados até as 08:00.` 
                  }), {
                      status: 200,
                      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                  });
              }

              const { data: records } = await supabase.from('agent_memory')
                  .select('id, content')
                  .eq('phone', 'MARIA_TASK')
                  .order('created_at', { ascending: true })
                  .limit(20);

              const now = new Date();
              const executedResults: any[] = [];

              if (records && records.length > 0) {
                  for (const r of records) {
                      try {
                          const task = JSON.parse(r.content);
                          if (task.status === 'pendente' && task.scheduled_for) {
                              const schedDate = new Date(task.scheduled_for);

                              // 🛡️ PROTEÇÃO CONTRA TAREFAS VENCIDAS ANTIGAS:
                              // Se a tarefa era de um dia anterior ou atrasou mais de 4 horas (ex: sistema ficou fora),
                              // NÃO dispara de supetão. Remarca para as 09:00 de hoje para preservar o relacionamento com o cliente.
                              const diffHours = (now.getTime() - schedDate.getTime()) / (1000 * 60 * 60);
                              if (diffHours > 4 || schedDate.toDateString() !== now.toDateString()) {
                                  console.log(`[AGENDA AUTO] Tarefa ${task.id} (${task.target_name}) estava atrasada há ${diffHours.toFixed(1)}h. Remarcando para as 09:00.`);
                                  const postponed = new Date(spNow);
                                  postponed.setHours(9, 0, 0, 0);
                                  if (currentHour >= 9) {
                                      postponed.setTime(spNow.getTime() + 15 * 60 * 1000);
                                  }
                                  task.scheduled_for = postponed.toISOString();
                                  task.observacao = `Remarcado automaticamente para horário comercial adequado (original: ${schedDate.toLocaleString('pt-BR')})`;
                                  await supabase.from('agent_memory').update({ content: JSON.stringify(task) }).eq('id', r.id);
                                  continue;
                              }

                              if (schedDate <= now) {
                                  console.log(`[AGENDA AUTO] Executando tarefa agendada: ${task.id} (${task.target_name})`);
                                  const res = await executeSingleTask(task, r.id);
                                  if (!res.skipped) {
                                      executedResults.push(res);
                                  }
                              }
                          }
                      } catch (parseErr) {
                          console.error('[AGENDA PARSE ERROR]:', parseErr);
                      }
                  }
              }

              return new Response(JSON.stringify({ 
                  success: true, 
                  processed_count: executedResults.length, 
                  results: executedResults 
              }), {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
          }

      } catch (err: any) {
          console.error('[AGENDA ERRO]:', err);
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
          remoteJid = msgNode?.chatid || msgNode?.sender_pn || payload?.chat?.wa_chatid || payload?.data?.key?.remoteJid || payload?.data?.remoteJid || payload?.remoteJid || payload?.sender || "";
          pushName = msgNode?.senderName || payload?.data?.pushName || payload?.chat?.name || "Cliente";
          // Não incluir msgNode.content na cadeia — no Uazapi, content é um OBJETO com URL/mimetype, não string
          userMessage = msgNode?.conversation || msgNode?.extendedTextMessage?.text || msgNode?.audioMessage?.text || msgNode?.audioMessage?.transcription || msgNode?.imageMessage?.caption || msgNode?.videoMessage?.caption || (typeof msgNode?.text === 'string' && msgNode.text.length > 0 ? msgNode.text : "") || payload?.text || "";
          messageId = payload?.data?.key?.id || payload?.message?.id || payload?.message?.key?.id || payload?.key?.id || msgNode?.id || payload?.message?.messageid || "";
          // Detecção robusta: checar msgType, msgNode.mediaType ("ptt"), msgNode.messageType ("AudioMessage"), e content.mimetype
          const contentMime = typeof msgNode?.content?.mimetype === 'string' ? msgNode.content.mimetype.toLowerCase() : "";
          hasAudio = msgType.toLowerCase().includes('audio') || msgType === 'ptt' || msgNode?.mediaType === 'ptt' || msgNode?.audioMessage || contentMime.includes('audio');
          hasImage = msgType.toLowerCase().includes('image') || msgType.toLowerCase().includes('video') || msgNode?.imageMessage || msgNode?.videoMessage || contentMime.includes('image');
          
          const docFileName = msgNode?.documentMessage?.fileName || msgNode?.documentWithCaptionMessage?.message?.documentMessage?.fileName || "";
          const hasDocument = msgType.toLowerCase().includes('document') || Boolean(msgNode?.documentMessage) || Boolean(msgNode?.documentWithCaptionMessage) || contentMime.includes('pdf') || contentMime.includes('application');
          const hasLocation = msgType.toLowerCase().includes('location') || Boolean(msgNode?.locationMessage);
          const hasContact = msgType.toLowerCase().includes('contact') || Boolean(msgNode?.contactMessage) || Boolean(msgNode?.contactsArrayMessage);

          if (!userMessage) {
              if (hasDocument) userMessage = `[📄 Documento / Arquivo PDF enviado pelo cliente${docFileName ? `: ${docFileName}` : ''}]`;
              else if (hasLocation) userMessage = `[📍 Localização compartilhada pelo cliente]`;
              else if (hasContact) userMessage = `[👤 Cartão de Contato enviado pelo cliente]`;
          }

          hasMedia = hasAudio || hasImage || hasDocument || msgType === 'media' || msgNode?.mediaType === 'ptt';
      }

      if (!remoteJid) {
          console.log(`[IGNORADO] remoteJid não encontrado.`);
          return;
      }

      remoteJid = remoteJid.split('@')[0].replace(/\D/g, '');
      if (!remoteJid.startsWith('55') && remoteJid.length >= 10 && remoteJid.length <= 11) {
          remoteJid = '55' + remoteJid;
      }
      const cleanPhone = remoteJid.replace(/^55/, '');
      const last8Digits = remoteJid.slice(-8);
      const allPhoneVariants = getPhoneVariants(remoteJid);

      // === 0. VERIFICAÇÃO ANTECIPADA E INFALÍVEL DE LISTA NEGRA (BLACKLIST) E SPAM ===
      const { data: earlyBlacklist } = await supabase
          .from('agent_memory')
          .select('content, created_at')
          .in('phone', allPhoneVariants)
          .in('content', ['BOT_IGNORAR', 'AMIGO_IGNORAR', 'LISTA_NEGRA', 'BOT_ATIVO', 'SPAM_ROBO'])
          .order('created_at', { ascending: false })
          .limit(1);

      if (earlyBlacklist && earlyBlacklist.length > 0) {
          const st = earlyBlacklist[0].content;
          if (st === 'BOT_IGNORAR' || st === 'AMIGO_IGNORAR' || st === 'LISTA_NEGRA' || st === 'SPAM_ROBO') {
              console.log(`[LISTA NEGRA / SPAM - BLOQUEIO ANTECIPADO] Contato ${remoteJid} bloqueado/ignorado (status: ${st}).`);
              return;
          }
      }

      if (last8Digits && last8Digits.length === 8) {
          const { data: partialBlocked } = await supabase
              .from('agent_memory')
              .select('phone, created_at')
              .in('content', ['BOT_IGNORAR', 'AMIGO_IGNORAR', 'LISTA_NEGRA', 'SPAM_ROBO'])
              .like('phone', `%${last8Digits}%`)
              .order('created_at', { ascending: false })
              .limit(1);
          if (partialBlocked && partialBlocked.length > 0) {
              console.log(`[LISTA NEGRA - BLOQUEIO POR FINAL ${last8Digits}] Contato ${remoteJid} bloqueado.`);
              return;
          }
      }

      // === 0.1 ESCUDO HEURÍSTICO ANTI-SPAM & ANTI-ROBÔ (BANCOS, OPERADORAS E OUTRAS IAS) ===
      const textToCheck = (userMessage || '').toLowerCase();
      const isSpamOrBankBot = (
          // Bancos e notificações automatizadas de OTP / faturas
          /(itau|itaú|bradesco|santander|banco do brasil|nubank|caixa econ[oô]mica|banco inter|c6 bank)/i.test(textToCheck) &&
          /(c[oó]digo de seguran[çc]a|chave pix|fatura fechada|fatura dispon[ií]vel|limite aprovado|cart[aã]o|token|n[aã]o compartilhe|transa[çc][aã]o suspeita|seguran[çc]a do banco|sua conta corrente)/i.test(textToCheck)
      ) || (
          // Operadoras e mensagens promocionais invasivas
          /(claro|vivo|tim)\s*(informa|recarga|promo[çc][aã]o|oferta|alerta)/i.test(textToCheck) ||
          /(recarga premiada|voc[eê] ganhou|parab[eé]ns voc[eê] foi selecionado|clube de vantagens|b[oô]nus de internet)/i.test(textToCheck)
      ) || (
          // Robôs de menu interativo de outras empresas
          /(digite \d para|escolha uma das op[çc][oõ]es|menu de atendimento:|protocolo de atendimento:|sou a assistente virtual|atendimento autom[aá]tico)/i.test(textToCheck)
      );

      if (isSpamOrBankBot) {
          console.log(`[ESCUDO ANTI-SPAM HEURÍSTICO] Mensagem automática ignorada de ${remoteJid}: "${userMessage.substring(0, 60)}..."`);
          // Etiqueta na memória como SPAM_ROBO
          await supabase.from('agent_memory').insert({ phone: remoteJid, role: 'user', content: 'SPAM_ROBO' });
          if (userMessage) {
              await supabase.from('agent_memory').insert({ phone: remoteJid, role: 'user', content: userMessage });
          }
          return; // Silêncio absoluto: não aciona Gemini e não responde WhatsApp
      }

      // Bloqueio de Mensagens de Grupos de WhatsApp
      const isGroup = msgNode?.isGroup || payload?.data?.isGroup || remoteJid.includes('@g.us');
      if (isGroup) {
          console.log(`[IGNORADO] Mensagem de grupo detectada. JID: ${remoteJid}`);
          return;
      }

      // Se for o próprio WhatsApp do Arnaldo (anotações próprias / teste pessoal)
      if (remoteJid === '5511947434455' || cleanPhone === '5511947434455' || cleanPhone === '11947434455') {
          console.log(`[ARNALDO DETECTADO] Mensagem do dono da empresa (${remoteJid}). Maria não atende o próprio dono como cliente.`);
          return;
      }
      
      // === CONSULTA DE CONTEXTO E IDENTIDADE (BANCO DE DADOS EM TEMPO REAL) ===
      let injectedContext = "Status deste Número: Desconhecido (Não cadastrado). TRATE COMO UM NOVO CONTATO / POSSÍVEL NOVO CLIENTE.";
      
      if (cleanPhone.includes("5511954598321") || cleanPhone.includes("11954598321") || last8Digits.includes("54598321")) {
          injectedContext = "Status deste Número: Este é o Sr Francisco (Técnico e Prestador de Serviço da Equipe). NUNCA tente vender nada ou citar regras de expediente. Seja muito gentil, acolha o recado/relatório e confirme que já passou para o Arnaldo.";
      } else if (cleanPhone.includes("5511913688307") || cleanPhone.includes("11913688307") || last8Digits.includes("13688307")) {
          injectedContext = "Status deste Número: Este é o Sr Maxwell (Técnico e Prestador de Serviço da Equipe). NUNCA tente vender nada ou citar regras de expediente. Seja muito gentil, acolha o recado/relatório e confirme que já passou para o Arnaldo.";
      } else if (cleanPhone.includes("5511915334136") || cleanPhone.includes("11915334136") || last8Digits.includes("15334136") || last8Digits.endsWith("5334136")) {
          injectedContext = "Status deste Número: Este é o Sergio Passarello (Pintor / Prestador Parceiro da Equipe). NUNCA trate como cliente, NUNCA ofereça serviços/orçamentos e NUNCA cite horários de expediente. Acolha com muita simpatia e parceria (ex: 'Oi Sergio, tudo bem? Já anotei seu recado e passei pro Arnaldo!'). Se ele perguntar do Arnaldo ou de alguma obra/pintura, responda com carinho e diga que o Arnaldo vai responder em breve.";
      } else {
          try {
              // 1. Busca Cliente por múltiplos formatos de telefone
              let dbCliente: any = null;
              const { data: clientMatches } = await supabase.from('clientes')
                  .select('id, nome_cliente, endereco_completo, documento_cpf_cnpj, relato_necessidade, whatsapp')
                  .or(`whatsapp.ilike.%${last8Digits}%,whatsapp.eq.${cleanPhone},whatsapp.eq.${remoteJid}`)
                  .limit(1);

              if (clientMatches && clientMatches.length > 0) {
                  dbCliente = clientMatches[0];
              }

              let osText = "";
              let propostasText = "";
              let agendaText = "";

              // 2. Busca Ordens de Serviço (OS) ativas e recentes
              if (dbCliente?.id) {
                  const { data: dbOS } = await supabase.from('ordens_servico')
                      .select('id_os, descricao_servico, data_agendamento, status_os, valor_total, observacoes, created_at')
                      .eq('cliente_id', dbCliente.id)
                      .order('created_at', { ascending: false })
                      .limit(5);

                  if (dbOS && dbOS.length > 0) {
                      osText = dbOS.map((os: any) => 
                          `- OS #${os.id_os} | Serviço: ${os.descricao_servico || 'Serviço Geral'} | Data/Hora Agendada: ${os.data_agendamento ? new Date(os.data_agendamento).toLocaleString('pt-BR') : 'A definir'} | Status: ${os.status_os || 'Aberta'}${os.valor_total ? ` | Valor: R$ ${os.valor_total}` : ''}${os.observacoes ? ` | Obs: ${os.observacoes}` : ''}`
                      ).join('\n');
                  }

                  // 3. Busca Propostas / Orçamentos
                  const { data: dbProp } = await supabase.from('propostas')
                      .select('id, servico_tipo, valor_estimado, status, data_proposta, fornecimento_materiais')
                      .eq('cliente_id', dbCliente.id)
                      .order('created_at', { ascending: false })
                      .limit(4);

                  if (dbProp && dbProp.length > 0) {
                      propostasText = dbProp.map((p: any) =>
                          `- Proposta/Orçamento: ${p.servico_tipo || 'Geral'} | Valor: R$ ${p.valor_estimado || 0} | Status: ${p.status || 'Pendente'} | Fornecimento: ${p.fornecimento_materiais || 'Padrão'}`
                      ).join('\n');
                  }
              }

              // 4. Busca Agendamentos e Missões da Maria
              const { data: dbAgenda } = await supabase.from('agent_memory')
                  .select('content, created_at')
                  .eq('phone', 'MARIA_TASK')
                  .like('content', `%"target_phone":%${last8Digits}%`)
                  .order('created_at', { ascending: false })
                  .limit(3);

              if (dbAgenda && dbAgenda.length > 0) {
                  const tasks = dbAgenda.map((a: any) => {
                      try {
                          const t = JSON.parse(a.content);
                          const sched = t.scheduled_for ? new Date(t.scheduled_for).toLocaleString('pt-BR') : 'Imediato';
                          return `- Missão Agendada: ${t.event_label || t.event_type} para ${sched} | Status: ${t.status} | Instruções: "${t.instructions}"`;
                      } catch {
                          return null;
                      }
                  }).filter(Boolean);
                  if (tasks.length > 0) agendaText = tasks.join('\n');
              }

              // Monta contexto completo
              if (dbCliente) {
                  injectedContext = `Status deste Número: CADASTRADO NO SISTEMA.\n` +
                      `Nome do Cliente: ${dbCliente.nome_cliente}\n` +
                      `Endereço Cadastrado (APENAS CONSULTA INTERNA - NUNCA CITAR ESPONTANEAMENTE): ${dbCliente.endereco_completo || 'Não informado'}\n` +
                      `CPF/CNPJ: ${dbCliente.documento_cpf_cnpj || 'Não informado'}\n\n` +
                      `⚠️ REGRAS CRÍTICAS ANTI-ALUCINAÇÃO PARA CLIENTE CADASTRADO:\n` +
                      `- NUNCA cite o "Endereço Cadastrado" espontaneamente! O endereço acima é apenas para conferência de sistema se o cliente perguntar ou confirmar. NUNCA comece mensagens dizendo "Sobre o endereço tal..." ou deduzindo locais!\n` +
                      `- NUNCA presuma serviços anteriores se o cliente apenas der um "Bom dia" ou pedir "retorno". Apenas responda ao que ele falou pontualmente com simpatia e pergunte como pode ajudar hoje.\n` +
                      `- Este cliente JÁ ESTÁ CADASTRADO no sistema. NUNCA peça Nome, Endereço ou CPF/CNPJ novamente!\n` +
                      `- Chame-o sempre pelo nome com simpatia (${dbCliente.nome_cliente}).\n` +
                      `- Se ele pedir um novo serviço, visita técnica, manutenção ou orçamento: acolha com presteza e informe com segurança que você já está registrando o chamado no sistema e encaminhando para a equipe técnica retornar.\n` +
                      `- NUNCA execute a ação CRIAR_CADASTRO para este cliente, pois ele já existe no banco!\n\n` +
                      `📋 SITUAÇÃO DE ORDENS DE SERVIÇO (OS) DESTE CLIENTE:\n` +
                      (osText || "Nenhuma Ordem de Serviço em aberto no momento.") + `\n\n` +
                      `📑 PROPOSTAS E ORÇAMENTOS RECENTES:\n` +
                      (propostasText || "Nenhuma proposta recente.") + `\n\n` +
                      `📅 AGENDAMENTOS NA AGENDA DA MARIA:\n` +
                      (agendaText || "Nenhum agendamento pendente.");
              } else {
                  injectedContext = `Status deste Número: Novo Contato / Cliente em Prospecção (Não cadastrado na tabela de clientes).\n` +
                      (agendaText ? `📅 AGENDAMENTOS NA AGENDA DA MARIA:\n${agendaText}\n` : "") +
                      `TRATE COM TOTAL ACOLHIMENTO E COLETE NOME, ENDEREÇO E DETALHES DO SERVIÇO SE ELE QUISER UM ATENDIMENTO/ORÇAMENTO.`;
              }

          } catch(dbErr) {
              console.error("Falha ao identificar cliente e OS:", dbErr);
          }
      }
      
      const { promptContext: tempoPromptContext } = buildTemporalContext();
      const finalSystemPrompt = systemPrompt
          .replace("[INJECT_TEMPORAL_CONTEXT]", tempoPromptContext)
          .replace("[INJECT_DB_CONTEXT]", injectedContext);
      
      // Sanitização Limpa antes de usar na Triagem de Arquivos
      if (typeof userMessage !== 'string') {
          userMessage = "";
      }

      const phoneVariants = allPhoneVariants;

      // CONTROLE DE PAUSA E COMANDOS DO GESTOR (Atendimento Humano Individual)
      const isMessageFromMe = payload?.message?.fromMe === true || 
                              payload?.fromMe === true || 
                              payload?.data?.key?.fromMe === true || 
                              payload?.data?.fromMe === true || 
                              payload?.data?.message?.key?.fromMe === true ||
                              payload?.event?.fromMe === true ||
                              msgNode?.fromMe === true;
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
              const { data: currentPause } = await supabase.from('agent_memory').select('content').in('phone', phoneVariants).in('content', ['BOT_PAUSADO', 'BOT_ATIVO']).order('created_at', { ascending: false }).limit(1);
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
      // DEFESA SUPREMA CONTRA MENSAGENS DUPLICADAS E FRAGMENTAÇÃO
      // (SMART DISTRIBUTED AGGREGATOR BUFFER - 18s)
      // Agrupa mensagens enviadas em partes pelo cliente e responde com 1 única resposta completa!
      // =========================================================================

      // 1. DEDUPLICAÇÃO IMEDIATA DE WEBHOOKS PARALELOS COM MESMO MESSAGE_ID
      if (messageId) {
          const { data: existingMsg } = await supabase
              .from('agent_memory')
              .select('id')
              .eq('phone', remoteJid)
              .ilike('content', `%[MSG_ID:${messageId}]%`)
              .limit(1);

          if (existingMsg && existingMsg.length > 0) {
              console.log(`[DEDUPLICAÇÃO SUPREMA] Webhook duplicado para MSG_ID ${messageId}. Abortando execução paralela.`);
              return;
          }
      }

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

      // 2. Grava a mensagem do usuário no banco (garantindo histórico em tempo real no CRM)
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
      const myCreatedAt = insertedData.created_at;

      // 3. VERIFICAÇÃO DE PAUSA GLOBAL MESTRE (AUTOATENDIMENTO: OFF)
      const { data: globalCfg } = await supabase
          .from('agent_memory')
          .select('content')
          .eq('phone', 'GLOBAL_CONFIG')
          .order('created_at', { ascending: false })
          .limit(1);

      if (globalCfg && globalCfg.length > 0 && globalCfg[0].content === 'GLOBAL_PAUSE') {
          console.log(`[PAUSA GLOBAL ATIVA] Autoatendimento está OFF. Mensagem registrada no chat, robô em silêncio.`);
          return;
      }

      // 4. VERIFICAÇÃO DE LISTA NEGRA E ATENDIMENTO HUMANO (PAUSA INDIVIDUAL)
      const { data: pauseState } = await supabase
          .from('agent_memory')
          .select('content, created_at')
          .in('phone', phoneVariants)
          .in('content', ['BOT_PAUSADO', 'BOT_ATIVO', 'BOT_IGNORAR', 'AMIGO_IGNORAR', 'LISTA_NEGRA'])
          .order('created_at', { ascending: false })
          .limit(1);
          
      if (pauseState && pauseState.length > 0) {
          const state = pauseState[0].content;
          const createdAt = new Date(pauseState[0].created_at || 0).getTime();
          const isRecentlyPaused = (Date.now() - createdAt) < (45 * 60 * 1000); // 45 minutos

          if (state === 'BOT_IGNORAR' || state === 'AMIGO_IGNORAR' || state === 'LISTA_NEGRA') {
              console.log(`[LISTA NEGRA] Mensagem registrada no chat, robô está permanentemente ignorado para ${remoteJid}.`);
              return;
          }
          if (state === 'BOT_PAUSADO') {
              if (isRecentlyPaused) {
                  console.log(`[ATENDIMENTO HUMANO / PAUSADO RECENTE] Mensagem registrada no chat, atendimento humano em andamento para ${remoteJid}. Robô em silêncio.`);
                  return;
              } else {
                  console.log(`[PAUSA EXPIRADA] Pausa humana de ${remoteJid} foi há mais de 45m. Maria Cecília assumindo novo chamado.`);
              }
          }
      }

      // 5. BUFFER INTELIGENTE DE DEBOUNCE OTIMIZADO (3s texto, 4s mídia/áudio)
      // Permite agregar mensagens rápidas sem estourar o timeout de 5-10s do webhook da UazAPI
      const currentCallTime = Date.now();
      userDebounceTimestamps.set(remoteJid, currentCallTime);

      const waitTime = hasMedia ? 4000 : 3000;
      console.log(`[DEBOUNCE AGREGADOR] Aguardando ${waitTime}ms para agregar mensagens adicionais de ${remoteJid}...`);
      await new Promise(r => setTimeout(r, waitTime));

      // 6. VERIFICAÇÃO DISTRIBUÍDA NO BANCO: O cliente enviou alguma mensagem mais recente enquanto esperávamos?
      const { data: newerUserMsgs } = await supabase
          .from('agent_memory')
          .select('id, created_at')
          .eq('phone', remoteJid)
          .eq('role', 'user')
          .not('content', 'ilike', 'BOT_%')
          .not('content', 'ilike', 'AMIGO_%')
          .not('content', 'ilike', 'LISTA_%')
          .not('content', 'ilike', 'LOCK_%')
          .gt('created_at', myCreatedAt)
          .limit(1);

      if (newerUserMsgs && newerUserMsgs.length > 0) {
          console.log(`[DEBOUNCE DISTRIBUÍDO] Detectada mensagem mais recente (${newerUserMsgs[0].id}) de ${remoteJid}. Esta chamada anterior cede a vez e foi agregada com sucesso.`);
          return;
      }

      // 7. TRAVA DISTRIBUÍDA DE EXECUÇÃO ÚNICA (CROSS-ISOLATE LOCK)
      // Garante que apenas 1 instância do servidor gere e envie a resposta ao cliente
      const leaderLockPhone = `LEADER_${remoteJid}`;
      const { data: recentLock } = await supabase
          .from('agent_memory')
          .select('id, created_at, content')
          .eq('phone', leaderLockPhone)
          .order('created_at', { ascending: false })
          .limit(1);

      if (recentLock && recentLock.length > 0) {
          const lockAge = Date.now() - new Date(recentLock[0].created_at).getTime();
          if (lockAge < 25000) {
              console.log(`[LOCK DISTRIBUÍDO] Outro isolate já está gerando/enviando resposta para ${remoteJid}. Abortando duplicidade.`);
              return;
          }
      }

      // Registra a reivindicação de liderança no banco
      await supabase.from('agent_memory').insert({
          phone: leaderLockPhone,
          role: 'user',
          content: `CLAIM_${myId}_${Date.now()}`
      });

      // 8. RE-VERIFICAÇÃO DE SEGURANÇA APÓS BUFFER (Se o usuário pausou durante os 18s)
      const { data: recheckGlobal } = await supabase
          .from('agent_memory')
          .select('content')
          .eq('phone', 'GLOBAL_CONFIG')
          .order('created_at', { ascending: false })
          .limit(1);

      if (recheckGlobal && recheckGlobal.length > 0 && recheckGlobal[0].content === 'GLOBAL_PAUSE') {
          console.log(`[PAUSA GLOBAL DETECTADA APÓS BUFFER] Autoatendimento desligado. Abortando.`);
          return;
      }

      const { data: recheckPause } = await supabase
          .from('agent_memory')
          .select('content, created_at')
          .in('phone', phoneVariants)
          .in('content', ['BOT_PAUSADO', 'BOT_ATIVO', 'BOT_IGNORAR', 'AMIGO_IGNORAR', 'LISTA_NEGRA'])
          .order('created_at', { ascending: false })
          .limit(1);

      if (recheckPause && recheckPause.length > 0) {
          const state = recheckPause[0].content;
          const createdAt = new Date(recheckPause[0].created_at || 0).getTime();
          const isRecentlyPaused = (Date.now() - createdAt) < (45 * 60 * 1000);

          if (state === 'BOT_IGNORAR' || state === 'AMIGO_IGNORAR' || state === 'LISTA_NEGRA') {
              console.log(`[PAUSA DETECTADA APÓS BUFFER] Status é ${state}. Abortando.`);
              return;
          }
          if (state === 'BOT_PAUSADO' && isRecentlyPaused) {
              console.log(`[PAUSA DETECTADA APÓS BUFFER] Status é BOT_PAUSADO recente. Abortando.`);
              return;
          }
      }

      // 9. BLINDAGEM ANTI-ATROPELO: Se Arnaldo conversou diretamente com este cliente nas últimas 2 horas
      const { data: arnaldoRecentMsg } = await supabase
          .from('agent_memory')
          .select('id, created_at, content')
          .eq('phone', remoteJid)
          .ilike('content', '%Arnaldo Trentin:%')
          .order('created_at', { ascending: false })
          .limit(1);

      if (arnaldoRecentMsg && arnaldoRecentMsg.length > 0) {
          const arnaldoMsgTime = new Date(arnaldoRecentMsg[0].created_at || 0).getTime();
          if ((Date.now() - arnaldoMsgTime) < (2 * 60 * 60 * 1000)) { // 2 horas de proteção ativa
              console.log(`[ANTI-ATROPELO] Arnaldo conversou diretamente com ${remoteJid} nas últimas 2h. Maria não vai responder por cima.`);
              return;
          }
      }

      console.log(`[LIDERANÇA ASSUMIDA] Gerando resposta consolidada e unificada para ${remoteJid}...`);

      // 4. Busca Histórico REAL no Banco
      const { data: historyData } = await supabase
          .from('agent_memory')
          .select('id, role, content, created_at')
          .eq('phone', remoteJid)
          .order('created_at', { ascending: false })
          .limit(40);

      // Invertemos para ficar em ordem cronológica
      let rawHistory = (historyData || []).reverse();

      // FILTRO DE TEMPO DO HISTÓRICO (Últimas 48h):
      // Mensagens antigas poluem o contexto da IA e causam alucinações de assuntos do passado.
      const nowMs = Date.now();
      const cutoff48h = nowMs - (48 * 60 * 60 * 1000);

      let hadLongGap = false;
      if (rawHistory.length > 1) {
          const prevMsgTime = new Date(rawHistory[rawHistory.length - 2]?.created_at || rawHistory[0].created_at).getTime();
          if (nowMs - prevMsgTime > 24 * 60 * 60 * 1000) {
              hadLongGap = true;
          }
      }

      rawHistory = rawHistory.filter(m => {
          if (!m.created_at) return true;
          return new Date(m.created_at).getTime() >= cutoff48h;
      });

      // Limita a no máximo 14 mensagens recentes
      if (rawHistory.length > 14) {
          rawHistory = rawHistory.slice(-14);
      }

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
      
      let promptToSend = currentPrompt;
      if (hasAudio && mediaPart) {
          promptToSend = `[ÁUDIO DE VOZ RECEBIDO DO CLIENTE]: Escute atentamente este áudio para extrair com máxima fidelidade e precisão todos os dados informados: Nome, Endereço completo (Rua, Número, Bairro, Cidade), CPF/CNPJ se informado, e detalhes do serviço.\n${currentPrompt}`;
      }
      if (hadLongGap) {
          promptToSend = `[NOVA CONVERSA/SESSÃO DO DIA - O contato anterior ocorreu há mais de 24 horas. NÃO deduza pendências, orçamentos antigos ou endereços do passado a menos que o cliente mencione explicitamente agora. Responda com simplicidade, acolhimento e foco estrito na mensagem de hoje]:\n${promptToSend}`;
      }

      const geminiInput = mediaPart 
          ? [{ text: promptToSend }, mediaPart] 
          : promptToSend;

      const completion = await chat.sendMessage(geminiInput);
      let aiResponse = completion.response.text();
      let whatsAppText = aiResponse;

      console.log(`[${botNameRaw}] GEMINI GEROU: ${aiResponse}`);

      // MULTI-ACTION ROUTER: Se o LLM Cuspiu um JSON para Banco de Dados
      try {
          if (aiResponse.includes('"acao"') || aiResponse.includes('"CRIAR_CADASTRO"') || aiResponse.includes('"LANCAR_CAIXA"') || aiResponse.includes('"IGNORAR_SPAM_ROBO"') || aiResponse.includes('"CRIAR_TAREFA_GESTOR"')) {
              // Extrair JSON robusto (mesmo se misturado com texto ou markdown)
              let jsonStr = aiResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
              
              // Se ainda tem texto antes/depois do JSON, tenta encontrar o JSON
              const jsonMatch = jsonStr.match(/\{[\s\S]*"acao"[\s\S]*\}/);
              if (jsonMatch) {
                  jsonStr = jsonMatch[0];
              }
              
              const actionData = JSON.parse(jsonStr);
              console.log(`[ACTION] Ação detectada: ${actionData.acao}`);

              // 🛡️ AÇÃO ANTI-SPAM / ANTI-ROBÔ DA IA
              if (actionData.acao === "IGNORAR_SPAM_ROBO") {
                  console.log(`[SPAM / ROBÔ DETECTADO PELA IA] Contato ${remoteJid} classificado como SPAM_ROBO. Silêncio mantido.`);
                  await supabase.from('agent_memory').insert({
                      phone: remoteJid,
                      role: 'user',
                      content: 'SPAM_ROBO'
                  });
                  return; // Silêncio absoluto, não envia WhatsApp e encerra
              }

              // 🎯 AÇÃO: CRIAR TAREFA PARA O ARNALDO (PEDIDOS / SOLICITAÇÕES)
              else if (actionData.acao === "CRIAR_TAREFA_GESTOR") {
                  const taskPayload = {
                      cliente_nome: actionData.nome_cliente || pushName || 'Cliente',
                      cliente_telefone: remoteJid,
                      tipo_solicitacao: actionData.tipo_solicitacao || 'ORCAMENTO',
                      titulo: actionData.titulo || 'Nova Solicitação do Cliente',
                      descricao: actionData.descricao || userMessage,
                      prioridade: actionData.prioridade || 'alta',
                      status: 'pendente',
                      resposta_ia: actionData.resposta_pro_cliente || actionData.mensagem_pro_cliente || '',
                      created_at: new Date().toISOString()
                  };

                  // 1. Tenta salvar na tabela dedicada tarefas_arnaldo
                  try {
                      const { error: taskDbErr } = await supabase.from('tarefas_arnaldo').insert(taskPayload);
                      if (taskDbErr) console.warn('[TAREFA ARNALDO] Tabela tarefas_arnaldo indisponível:', taskDbErr.message);
                      else console.log('[TAREFA ARNALDO] Salva com sucesso na tabela tarefas_arnaldo!');
                  } catch (dbErr) {
                      console.warn('[TAREFA ARNALDO] Erro ao gravar em tarefas_arnaldo:', dbErr);
                  }

                  // 2. Grava como redundância garantida em agent_memory com identificador único
                  const memoryTask = { id: `TASK_${Date.now()}`, ...taskPayload };
                  await supabase.from('agent_memory').insert({
                      phone: 'ARNALDO_TASK',
                      role: 'system',
                      content: JSON.stringify(memoryTask)
                  });

                  // 3. Atualiza relato do cliente na tabela clientes
                  try {
                      const { data: existClient } = await supabase.from('clientes')
                          .select('id, relato_necessidade')
                          .or(`whatsapp.ilike.%${last8Digits}%,whatsapp.eq.${cleanPhone},whatsapp.eq.${remoteJid}`)
                          .limit(1);

                      if (existClient && existClient.length > 0) {
                          const currRelato = existClient[0].relato_necessidade || '';
                          const updatedRelato = `${currRelato ? currRelato + '\n' : ''}[Solicitação ${new Date().toLocaleDateString('pt-BR')} - ${taskPayload.tipo_solicitacao}]: ${taskPayload.descricao}`;
                          await supabase.from('clientes').update({ relato_necessidade: updatedRelato }).eq('id', existClient[0].id);
                      } else if (actionData.nome_cliente && actionData.nome_cliente !== 'Cliente') {
                          await supabase.from('clientes').insert({
                              nome_cliente: actionData.nome_cliente,
                              whatsapp: remoteJid,
                              relato_necessidade: `[Solicitação ${new Date().toLocaleDateString('pt-BR')} - ${taskPayload.tipo_solicitacao}]: ${taskPayload.descricao}`
                          });
                      }
                  } catch (cErr) {
                      console.error('[TAREFA ARNALDO] Erro ao sincronizar cliente:', cErr);
                  }

                  whatsAppText = actionData.resposta_pro_cliente || actionData.mensagem_pro_cliente || "Perfeito! Já registrei todos os detalhes da sua solicitação e passei diretamente para o Arnaldo avaliar. Ele retornará em breve!";
              }

              else if (actionData.acao === "LANCAR_CAIXA") {
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
                  // Verificação Anti-Duplicação: Verifica se o WhatsApp ou final de 8 dígitos já existe em clientes
                  const { data: existingClients } = await supabase
                      .from('clientes')
                      .select('id, nome_cliente, relato_necessidade, endereco_completo, documento_cpf_cnpj')
                      .or(`whatsapp.ilike.%${last8Digits}%,whatsapp.eq.${cleanPhone},whatsapp.eq.${remoteJid}`)
                      .limit(1);

                  if (existingClients && existingClients.length > 0) {
                      const exist = existingClients[0];
                      console.log(`[ANTI-DUPLICAÇÃO] Cliente já cadastrado no banco (ID: ${exist.id}, Nome: ${exist.nome_cliente}). Atualizando registro.`);
                      const prevRelato = exist.relato_necessidade || '';
                      const newRelato = actionData.relato ? `${prevRelato ? prevRelato + '\n' : ''}[Novo Chamado ${new Date().toLocaleDateString('pt-BR')}]: ${actionData.relato}` : prevRelato;
                      
                      const updatePayload: Record<string, any> = { relato_necessidade: newRelato };
                      if (!exist.endereco_completo && actionData.endereco_completo) updatePayload.endereco_completo = actionData.endereco_completo;
                      if (!exist.documento_cpf_cnpj && actionData.cpf_cnpj) updatePayload.documento_cpf_cnpj = actionData.cpf_cnpj;

                      const { error: updErr } = await supabase.from('clientes').update(updatePayload).eq('id', exist.id);
                      if (updErr) console.error("[ANTI-DUPLICAÇÃO] Erro ao atualizar cliente existente:", updErr);
                      else console.log(`[ANTI-DUPLICAÇÃO] ✅ CLIENTE ATUALIZADO: ${exist.nome_cliente} | ID: ${exist.id}`);
                  } else {
                      const { error: insertErr } = await supabase.from('clientes').insert({
                          nome_cliente: actionData.nome_cliente,
                          whatsapp: remoteJid,
                          endereco_completo: actionData.endereco_completo,
                          documento_cpf_cnpj: actionData.cpf_cnpj,
                          relato_necessidade: actionData.relato
                      });
                      if (insertErr) console.error("[ACTION] Erro ao inserir novo cliente:", insertErr);
                      else console.log(`[ACTION] ✅ NOVO CLIENTE SALVO: ${actionData.nome_cliente} | ${remoteJid}`);
                  }
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
          content: whatsAppText
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

  // 3. Executar Processador com ciclo de vida garantido
  try {
      await processRequest();
  } catch (err) {
      console.error("[CRITICAL] Falha em processRequest:", err);
  }

  return new Response(JSON.stringify({ status: "OK" }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
