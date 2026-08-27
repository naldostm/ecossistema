# Estrutura do Banco de Dados: Ecossistema Arnaldo Trentin

Este documento define as tabelas base para a operação do ecossistema, definindo os campos, tipos de dados e os responsáveis por suas interações.

## Tabela: `[01_Clientes]`

Responsável Principal: **Maria Cecília (Atendimento)**

| Campo                  | Tipo do Dado        | Descrição / Observação |
|------------------------|---------------------|------------------------|
| **Nome_Cliente**       | Texto               | Nome completo ou razão social do cliente. |
| **WhatsApp**           | Número              | Contato principal do cliente para comunicação das IAs. |
| **Endereco_Completo**  | Texto/Maps          | Endereço da obra ou local de atendimento. |
| **Documento_CPF_CNPJ** | Texto               | Documento de identificação para faturamento/contrato. |
| **Relato_Necessidade** | Texto Longo         | Descrição detalhada do problema ou serviço solicitado. |

---

## Tabela: `[02_Ordem_Servico]`

Responsáveis: **Maria Cecília (Criação), Ian Gillan (Execução/Validação), Márcia Ribeiro (Faturamento)**

| Campo                      | Tipo do Dado                          | Descrição / Observação |
|----------------------------|---------------------------------------|------------------------|
| **ID_OS**                  | Auto-incremento                       | Identificador único da Ordem de Serviço. |
| **Cliente_Vinculo**        | Relacional -> `01_Clientes`           | Conexão com o cadastro do cliente solicitante. |
| **Vendedor**               | Dropdown Alfabética                   | Responsável pela venda/captação do serviço. |
| **Servico_Tipo**           | Dropdown Alfabética                   | Categoria do serviço a ser executado. |
| **Materiais_Lista**        | Texto/Lista                           | Materiais necessários ou utilizados na OS. |
| **Colaborador**            | Dropdown (Arnaldo, Ajudante 1, 2)     | Equipe alocada para o serviço. |
| **Data_Hora**              | Data/Hora                             | Agendamento ou registro de início do serviço. |
| **Status_IA**              | Dropdown (Aberto, Em Campo, Validado, Finalizado) | Controle de fluxo de trabalho entre os agentes. |
| **Pasta_Midia_Instagram**  | Anexo/Fotos                           | Mídias do serviço (Antes/Depois) para Marketing. |

---

### Fluxo de Status (`Status_IA`) no Ecossistema de Agentes:
1. **Aberto**: Maria Cecília capta os dados, cadastra o cliente, e abre a OS.
2. **Em Campo**: Ian Gillan (Supervisor) ou equipe assume a OS para execução física.
3. **Validado**: Ian Gillan anexa as mídias (`Pasta_Midia_Instagram`) e valida tecnicamente o serviço prestado.
4. **Finalizado**: Márcia Ribeiro assume para faturamento, pós-venda e uso das mídias para publicações no Instagram.
