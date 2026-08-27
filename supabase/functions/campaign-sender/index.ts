import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') ?? '');

const UAZAPI_URL = (Deno.env.get('UAZAPI_URL') ?? '').replace(/\/$/, '');
const UAZAPI_TOKEN = Deno.env.get('UAZAPI_TOKEN') ?? '';

const CATEGORY_PROMPTS: Record<string, string> = {
  atendimento: `Você está fazendo contato PROATIVO com um cliente/lead. Seja calorosa, apresente-se rapidamente como Maria Cecília da Arnaldo Trentin Serviços, e siga as instruções do briefing abaixo. Mantenha a mensagem CURTA (máximo 3 parágrafos).`,
  orcamento: `Você está enviando informações sobre um ORÇAMENTO/PROPOSTA para o cliente. Mencione o serviço e valor se disponível. Seja profissional e direta. Mensagem CURTA (máximo 3 parágrafos). NÃO invente valores que não estejam nos dados.`,
  confirmacao: `Você está CONFIRMANDO um agendamento de serviço com o cliente. Mencione a data, horário e tipo de serviço. Peça confirmação. Mensagem CURTA e objetiva (máximo 2 parágrafos).`,
  pos_venda: `Você está fazendo PÓS-VENDA — verificando se o serviço ficou bom e se o cliente está satisfeito. Seja carinhosa e genuína. Mensagem CURTA (máximo 2 parágrafos). Se souber o nome do serviço realizado, mencione.`,
  cobranca: `Você está enviando um LEMBRETE DE PAGAMENTO de forma EDUCADA e firme. Mencione o valor e referência do serviço se disponível. Ofereça facilidades (PIX). NUNCA seja agressiva ou ameaçadora. Mensagem CURTA (máximo 2 parágrafos).`
};

const MARIA_BASE = `Você é Maria Cecília, Head of Customer Experience da Arnaldo Trentin Serviços. 
Personalidade: 36 anos, extremamente empática, educada (usa "querido(a)", "Sr(a)"). 
Tom de voz: Premium, seguro e acolhedor. Você NÃO é um bot; é a secretária de confiança do Arnaldo.
REGRAS: Não use markdown, asteriscos, emojis em excesso. Use no máximo 1-2 emojis. Escreva como uma mensagem natural de WhatsApp.`;

interface ClientePayload {
  id: string;
  nome: string;
  whatsapp: string;
  contexto?: string;
}

interface CampaignRequest {
  tipo: string;
  briefing: string;
  clientes: ClientePayload[];
  mode: 'preview' | 'send';
  enviado_por?: string;
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response('OK', { status: 200, headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'online', service: 'campaign-sender' }), { 
      status: 200, headers: corsHeaders 
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const body: CampaignRequest = await req.json();
    const { tipo, briefing, clientes, mode, enviado_por } = body;

    if (!tipo || !clientes || clientes.length === 0) {
      return new Response(JSON.stringify({ error: 'tipo e clientes são obrigatórios' }), { 
        status: 400, headers: corsHeaders 
      });
    }

    if (clientes.length > 30) {
      return new Response(JSON.stringify({ error: 'Máximo de 30 clientes por campanha' }), { 
        status: 400, headers: corsHeaders 
      });
    }

    const categoryPrompt = CATEGORY_PROMPTS[tipo] || CATEGORY_PROMPTS['atendimento'];
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `${MARIA_BASE}\n\n${categoryPrompt}`,
      generationConfig: { temperature: 0.8, maxOutputTokens: 1500 }
    });

    const results: Array<{
      cliente_id: string;
      cliente_nome: string;
      mensagem: string;
      status: string;
    }> = [];

    for (let i = 0; i < clientes.length; i++) {
      const cliente = clientes[i];
      
      try {
        // Build personalized prompt
        const userPrompt = [
          `BRIEFING DO GESTOR: ${briefing || 'Faça um contato cordial seguindo sua categoria.'}`,
          `\nDADOS DO CLIENTE:`,
          `- Nome: ${cliente.nome}`,
          `- WhatsApp: ${cliente.whatsapp}`,
          cliente.contexto ? `- Contexto adicional: ${cliente.contexto}` : '',
          `\nGere UMA mensagem de WhatsApp personalizada para este cliente. Apenas o texto da mensagem, sem aspas, sem prefixos.`
        ].filter(Boolean).join('\n');

        const completion = await model.generateContent(userPrompt);
        let mensagem = completion.response.text().trim();
        
        // Clean up any markdown artifacts
        mensagem = mensagem.replace(/```/g, '').replace(/\*\*/g, '').replace(/^["']|["']$/g, '').trim();

        if (mode === 'send') {
          // Send via UaZAPI
          const cleanNumber = cliente.whatsapp.replace(/\D/g, '');
          
          if (cleanNumber.length >= 10) {
            const endpoint = UAZAPI_URL.endsWith('/') ? `${UAZAPI_URL}send/text` : `${UAZAPI_URL}/send/text`;
            
            const uazRes = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'token': UAZAPI_TOKEN },
              body: JSON.stringify({ number: cleanNumber, text: mensagem })
            });

            const sendStatus = uazRes.ok ? 'enviado' : 'erro';
            
            // Log to database
            await supabase.from('campanhas_mensagens').insert({
              tipo,
              briefing: briefing || null,
              cliente_id: cliente.id,
              cliente_nome: cliente.nome,
              cliente_whatsapp: cleanNumber,
              mensagem_gerada: mensagem,
              status: sendStatus,
              enviado_por: enviado_por || null
            });

            results.push({
              cliente_id: cliente.id,
              cliente_nome: cliente.nome,
              mensagem,
              status: sendStatus
            });

            console.log(`[CAMPANHA] ${sendStatus.toUpperCase()} → ${cliente.nome} (${cleanNumber})`);

            // Anti-spam delay between messages (10 seconds)
            if (i < clientes.length - 1) {
              await new Promise(r => setTimeout(r, 10000));
            }
          } else {
            results.push({
              cliente_id: cliente.id,
              cliente_nome: cliente.nome,
              mensagem,
              status: 'erro_numero_invalido'
            });
          }
        } else {
          // Preview mode — just return generated messages
          results.push({
            cliente_id: cliente.id,
            cliente_nome: cliente.nome,
            mensagem,
            status: 'preview'
          });
        }
      } catch (genErr: any) {
        console.error(`[CAMPANHA] Erro ao gerar para ${cliente.nome}:`, genErr?.message);
        results.push({
          cliente_id: cliente.id,
          cliente_nome: cliente.nome,
          mensagem: `Erro: ${genErr?.message || 'Falha na geração'}`,
          status: 'erro'
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      mode,
      total: results.length,
      enviados: results.filter(r => r.status === 'enviado').length,
      erros: results.filter(r => r.status.startsWith('erro')).length,
      results 
    }), { status: 200, headers: corsHeaders });

  } catch (err: any) {
    console.error('[CAMPANHA] Erro geral:', err);
    return new Response(JSON.stringify({ error: err?.message || 'Erro interno' }), { 
      status: 500, headers: corsHeaders 
    });
  }
});
