import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI, FunctionCallingMode } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('OK', { status: 200, headers: corsHeaders });
  }

  try {
    const { text, userRole, history = [] } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: 'Texto da mensagem é obrigatório' }), { 
        status: 400, headers: corsHeaders 
      });
    }

    // Initialize Supabase Client with the user's JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const authHeader = req.headers.get('Authorization')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Extract basic metrics for context
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0,0,0,0);
    const dateStr = currentMonthStart.toISOString();

    // 1. Receitas Faturadas
    const { data: faturamentos, error: fatErr } = await supabase
      .from('faturamentos')
      .select('valor_geral, status')
      .gte('created_at', dateStr);

    let totalReceitasMes = 0;
    let inadimplenciaMes = 0;
    if (faturamentos) {
      faturamentos.forEach(f => {
        if (f.status === 'Pago') totalReceitasMes += Number(f.valor_geral);
        if (f.status === 'Faturado' || f.status === 'Pendente') inadimplenciaMes += Number(f.valor_geral);
      });
    }

    // 2. Fluxo de Caixa (Saídas/Despesas)
    const { data: caixa, error: cxErr } = await supabase
      .from('fluxo_caixa')
      .select('valor, tipo_movimento, categoria')
      .gte('created_at', dateStr);

    let totalDespesasMes = 0;
    if (caixa) {
      caixa.forEach(c => {
        if (c.tipo_movimento === 'Saida') totalDespesasMes += Number(c.valor);
        if (c.tipo_movimento === 'Entrada') totalReceitasMes += Number(c.valor); // Adiciona extras do caixa
      });
    }

    // 3. Comissões a Pagar
    const { data: comissoes, error: comErr } = await supabase
      .from('comissoes')
      .select('valor_pagar, status_pagamento')
      .gte('created_at', dateStr);

    let comissoesPendentes = 0;
    if (comissoes) {
      comissoes.forEach(c => {
        if (c.status_pagamento !== 'Pago') comissoesPendentes += Number(c.valor_pagar);
      });
    }

    // 4. Parâmetros da Calculadora de Custos Operacionais
    const { data: configData } = await supabase
      .from('sistema_configuracoes')
      .select('valor')
      .eq('chave', 'calc_config')
      .single();
      
    let calcContext = "Não há parâmetros de calculadora configurados no momento.";
    if (configData && configData.valor) {
      const p = configData.valor.params || {};
      calcContext = `Parâmetros de Custo Operacional (Dias Úteis: ${p.diasUteis || 22}, Horas/Dia: ${p.horasDia || 8}). Total de horas trabalhadas no mês: ${(p.diasUteis || 22) * (p.horasDia || 8)}h. Custo por Hora: R$ ${(((p.diasUteis || 22) * (p.horasDia || 8)) > 0 ? (totalDespesasMes / ((p.diasUteis || 22) * (p.horasDia || 8))) : 0).toFixed(2)}`;
    }

    // 5. Estoque (Materiais / Produtos)
    const { data: materiais } = await supabase.from('materiais').select('quantidade, preco_compra, valor_unitario');
    let totalCustoEstoque = 0;
    let totalVendaEstoque = 0;
    let produtosEmBaixa = 0;
    if (materiais) {
      materiais.forEach(m => {
        totalCustoEstoque += (Number(m.quantidade) * Number(m.preco_compra || 0));
        totalVendaEstoque += (Number(m.quantidade) * Number(m.valor_unitario || 0));
        if (Number(m.quantidade) <= 5) produtosEmBaixa++;
      });
    }

    // 6. Serviços e Obras (Resumo)
    const { count: countServicos } = await supabase.from('servicos').select('*', { count: 'exact', head: true });
    const { count: countObrasAtivas } = await supabase.from('obras').select('*', { count: 'exact', head: true }).neq('status_obra', 'Finalizada').neq('status_obra', 'Cancelada');

    const saldoAtual = totalReceitasMes - totalDespesasMes - comissoesPendentes;

    const contextoFinanceiro = `
RESUMO FINANCEIRO E ESTRATÉGICO DESTE MÊS (Apenas para basear sua resposta, não repita os números a não ser que solicitado):

1. FLUXO DE CAIXA:
- Total de Receitas (Caixa + Faturamentos Pagos): R$ ${totalReceitasMes.toFixed(2)}
- Despesas (Saídas do Caixa): R$ ${totalDespesasMes.toFixed(2)}
- Valores a Receber (Faturamentos Pendentes): R$ ${inadimplenciaMes.toFixed(2)}
- Comissões a Pagar para a Equipe: R$ ${comissoesPendentes.toFixed(2)}
- Saldo Projetado: R$ ${saldoAtual.toFixed(2)}

2. ESTOQUE E PRODUTOS:
- Custo Total do Estoque Atual (Dinheiro Parado): R$ ${totalCustoEstoque.toFixed(2)}
- Potencial de Receita do Estoque (Se vender tudo): R$ ${totalVendaEstoque.toFixed(2)}
- Produtos com Estoque Baixo (<= 5 unid): ${produtosEmBaixa} produtos

3. OPERACIONAL:
- Serviços Ativos no Catálogo: ${countServicos || 0}
- Obras em Andamento: ${countObrasAtivas || 0}

4. CALCULADORA:
${calcContext}
    `;

    // Initialize Gemini (SDK v0.21.0 — Function Calling estável)
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada no servidor.");

    const genAI = new GoogleGenerativeAI(apiKey);

    const toolDeclarations = [
      {
        name: "ajustar_precos_servicos",
        description: "Aumenta ou diminui o valor base de todos os serviços do catálogo em um determinado percentual. Use apenas quando o usuário solicitar alteração ou reajuste de preços de serviços.",
        parameters: {
          type: "OBJECT" as const,
          properties: {
            percentual: { type: "NUMBER" as const, description: "O percentual de reajuste. Exemplo: 10 para aumentar 10%, -5 para diminuir 5%." }
          },
          required: ["percentual"]
        }
      },
      {
        name: "adicionar_lancamento_caixa",
        description: "Adiciona um novo lançamento de receita ou despesa no fluxo de caixa central. Use quando o usuário pedir para lançar, registrar ou adicionar gastos, despesas, receitas ou qualquer movimentação financeira.",
        parameters: {
          type: "OBJECT" as const,
          properties: {
            tipo_movimento: { type: "STRING" as const, description: "Deve ser 'Entrada' para receitas ou 'Saida' para despesas/gastos" },
            categoria: { type: "STRING" as const, description: "A categoria da movimentação, ex: 'Transporte', 'Alimentação', 'Combustível', 'Material', 'Venda'" },
            valor: { type: "NUMBER" as const, description: "O valor numérico da movimentação em reais" },
            descricao: { type: "STRING" as const, description: "Uma breve descrição do lançamento" }
          },
          required: ["tipo_movimento", "categoria", "valor", "descricao"]
        }
      }
    ];

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: [{ functionDeclarations: toolDeclarations }],
    });

    const systemPrompt = `Você é Márcia Ribeiro, Diretora Financeira rigorosa e estratégica da empresa 'Arnaldo Trentin Serviços'.
Você é direta, profissional e focada em resultados e lucratividade. Não use jargões difíceis demais, mas seja pragmática.
Seu papel é analisar os números da empresa, aprovar ou barrar decisões baseadas em custo, e aconselhar o diretor (Arnaldo) sobre fluxo de caixa. Você também possui permissão para executar tarefas e alterações de banco de dados caso o Diretor peça.

IMPORTANTE SOBRE FUNCTION CALLING:
- Quando o usuário pedir para LANÇAR, REGISTRAR ou ADICIONAR qualquer gasto, despesa, receita ou movimentação, você DEVE usar a função 'adicionar_lancamento_caixa'.
- Quando o usuário pedir para REAJUSTAR preços, use 'ajustar_precos_servicos'.
- NÃO diga que vai fazer — simplesmente EXECUTE a função correspondente.

${contextoFinanceiro}

Sempre responda em português do Brasil de forma clara e assertiva. Se a saúde financeira (Saldo Projetado) estiver negativa ou baixa, você deve expressar preocupação e recomendar cortes de gastos ou aumento nas cobranças de pendentes. O usuário com quem você está falando tem o cargo: ${userRole || 'Diretoria'}. Use formatação HTML básica (<b>, <br>, <ul>, <li>) para sua resposta ser renderizada no chat. NÃO use Markdown asteriscos (**), APENAS tags HTML!`;

    const chatHistory = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Entendido. Operarei como Márcia Ribeiro, controlando as finanças e orientando com base nos dados fornecidos. Estou pronta para executar ações no banco quando solicitado." }] }
    ];

    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        chatHistory.push({ role: msg.role, parts: [{ text: msg.text }] });
      });
    }

    const chat = model.startChat({
      history: chatHistory,
      generationConfig: { maxOutputTokens: 2048, temperature: 0.7 }
    });

    let currentResult = await chat.sendMessage(text);
    let respostaMarcia = "";

    // Helper: Executa uma function call e retorna o resultado
    async function executeFunction(fnCall: any): Promise<Record<string, any>> {
      console.log(`[finance-advisor] Executing function: ${fnCall.name}`, JSON.stringify(fnCall.args));

      if (fnCall.name === 'ajustar_precos_servicos') {
        const percentual = fnCall.args.percentual as number;
        const { data: servicosAll, error: fetchErr } = await supabase.from('servicos').select('id, valor_base');
        if (servicosAll && !fetchErr) {
          const updates = servicosAll.map((s: any) => ({
            id: s.id,
            valor_base: Number((Number(s.valor_base) * (1 + percentual / 100)).toFixed(2))
          }));
          const { error: upsertErr } = await supabase.from('servicos').upsert(updates);
          return { success: !upsertErr, message: upsertErr ? upsertErr.message : `Todos os ${servicosAll.length} preços atualizados em ${percentual}%` };
        }
        return { success: false, message: "Erro ao buscar serviços: " + (fetchErr?.message || 'Desconhecido') };

      } else if (fnCall.name === 'adicionar_lancamento_caixa') {
        const { tipo_movimento, categoria, valor, descricao } = fnCall.args as Record<string, any>;
        const { error: insertErr } = await supabase.from('fluxo_caixa').insert([{
          tipo_movimento,
          categoria,
          valor: Number(valor),
          descricao,
          data_ocorrencia: new Date().toISOString().split('T')[0]
        }]);
        console.log('[finance-advisor] Insert result:', insertErr ? `ERROR: ${insertErr.message}` : 'SUCCESS');
        return {
          success: !insertErr,
          message: insertErr ? `Erro ao inserir: ${insertErr.message}` : `Lançamento de ${tipo_movimento} de R$${Number(valor).toFixed(2)} na categoria "${categoria}" registrado com sucesso.`
        };
      }
      return { success: false, message: `Função desconhecida: ${fnCall.name}` };
    }

    // Loop de Function Calling: processa TODAS as chamadas (inclusive multi-turn)
    const MAX_TURNS = 10;
    let turn = 0;

    while (turn < MAX_TURNS) {
      const calls = currentResult.response.functionCalls();
      if (!calls || calls.length === 0) break;

      console.log(`[finance-advisor] Turn ${turn + 1}: ${calls.length} function call(s) detected`);

      // Executa TODAS as function calls desta rodada
      const functionResponses = [];
      for (const fnCall of calls) {
        const fnResult = await executeFunction(fnCall);
        functionResponses.push({
          functionResponse: {
            name: fnCall.name,
            response: fnResult
          }
        });
      }

      // Envia TODOS os resultados de volta ao modelo
      currentResult = await chat.sendMessage(functionResponses);
      turn++;
    }

    // Extrai texto final da resposta
    try {
      respostaMarcia = currentResult.response.text();
    } catch (_e) {
      respostaMarcia = "";
    }

    // Fallback: se a resposta ficou vazia mesmo após function calling
    if (!respostaMarcia || respostaMarcia.trim() === "") {
      respostaMarcia = "Processamento concluído. As operações solicitadas foram executadas com sucesso. Posso ajudar com mais alguma coisa?"
    }

    return new Response(JSON.stringify({ 
      success: true, 
      dados: respostaMarcia,
      correlationId: `fc-${Date.now()}`
    }), { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error("Erro no finance-advisor:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, headers: corsHeaders 
    });
  }
});
