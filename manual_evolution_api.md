# 📱 O Guia Mestre: Conectando seu WhatsApp na Evolution API

A Evolution API é uma das pontes mais robustas do mundo para espelhar um celular inteiro (recebendo textos, áudios e PDFs) e jogar na Nuvem em tempo real. E é exatamente isso que precisamos para alimentar os nossos "cérebros" no n8n.

Aqui está o mapa de guerra para fazer isso hoje:

---

## Passo 1: Como você vai ligar o Motor da Evolution API?
A Evolution API é um "Servidor". Ela precisa ficar ligada 24 horas por dia, senão as I.A.s só trabalhariam quando seu computador estivesse ligado. Você tem duas opções para prosseguir agora:

**A) Alugar Pronta (O Mais Fácil):** Você assina plataformas "SaaS" brasileiras que já hospedam a Evolution API pra você (Cobram R$50 a R$100 por mês, como a *Z-API*, *MegaAPI*, *Zenzz*, etc). Eles te dão um painel bonitinho, você escaneia o QR Code com seu Zap e pronto.
**B) Instalar do Zero (Para quem gosta de TI):** Você aluga um servidor nuvem puro e barato (como Hetzner ou DigitalOcean por U$6), abre a tela preta e instala o motor em Node.js / Docker.

---

## Passo 2: O Pulo do Gato (O "Webhook" do n8n)
Independentemente de qual for a sua Evolution API (alugada ou instalada), ela terá um campo nas configurações escrito `"WEBHOOK URL"`. 

Esse campo é a boca de saída: Tudo que chegar de mensagem no WhatsApp, ela atira para esse link. E adivinha? **Aquele primeiro nó de todos os nossos 4 painéis do n8n (o Webhook Test) é exatamente o "Beco de Entrada" que te dá a URL.**

### Como plugar a Maria Cecília (Exemplo):
1. Vá no seu **n8n da Maria Cecília**.
2. Dê duplo clique no primeiro nó (WhatsApp Aguardando Mensagem).
3. Veja que existe ali um botão chamado **`Test URL`** ou **`Production URL`**. Ele vai te dar um link parecido com `https://arnaldotrentin.app.n8n.cloud/webhook/...`.
4. Copie esse link gigante do n8n!
5. Vá na sua conta da **Evolution API**, na parte de Webhooks, e cole lá.
6. Assinale no painel da Evolution que você quer redirecionar "Mensagens com Mensagem" e "Mídias/Fotos/Áudios".

---

## Passo 3: O Teste de Sangue
Com o link colado na Evolution API:
- Volte no n8n e clique no botão verde grande `Execute Workflow`. A caixinha da Maria Cecília ficará rodando (girando a chavinha) dizendo *"Listening for Events"*.
- Pegue o celular de um amigo seu.
- Mande um Zap de cliente para o celular do Arnaldo (O celular que você escaneou o QR Code). Mande algo como: *"Olá, quanto custa manutenção do VRF?"*
- **Aperte o cinto!** O painel do n8n vai estourar na tela em Verde, o Google Gemini via ler em 3 segundos, e lá no nosso Supabase vai nascer uma OS Pronta, refletindo na hora no gráfico do seu Dashboard web.

---
🚀 Responda: *Qual a sua infraestrutura da Evolution API agora? Já assinou uma empresa ou você mesmo vai rodar na sua máquina com Docker?*
