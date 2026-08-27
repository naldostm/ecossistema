/**
 * ═══ MAPA RBAC GRANULAR ═══
 * Define as permissões por cargo para cada módulo do sistema.
 */
export const RBAC = {
    tecnico: {
        clientes: { ver: false, modificar: false, excluir: false, precos: false },
        ordens: { ver: true, modificar: true, excluir: false, precos: false },
        colaboradores: { ver: true, modificar: false, excluir: false, precos: false },
        materiais: { ver: true, modificar: false, excluir: false, precos: true },
        ferramentas: { ver: true, modificar: true, excluir: false, precos: false },
        servicos: { ver: true, modificar: false, excluir: false, precos: false },
        fornecedores: { ver: true, modificar: false, excluir: false, precos: false },
        obras: { ver: true, modificar: false, excluir: false, precos: false },
        caixa: { ver: false, modificar: false, excluir: false, precos: false },
        contratos: { ver: true, modificar: false, excluir: false, precos: false },
        relatorios: { ver: false, modificar: false, excluir: false, precos: false },
        finances_widget: { ver: false },
        chat_arquiteto: { ver: false }
    },
    atendimento: {
        clientes: { ver: true, modificar: true, excluir: false, precos: true },
        ordens: { ver: true, modificar: true, excluir: false, precos: true },
        colaboradores: { ver: true, modificar: false, excluir: false, precos: false },
        materiais: { ver: true, modificar: true, excluir: false, precos: true },
        ferramentas: { ver: true, modificar: true, excluir: false, precos: false },
        servicos: { ver: true, modificar: true, excluir: false, precos: true },
        fornecedores: { ver: true, modificar: true, excluir: false, precos: true },
        obras: { ver: true, modificar: true, excluir: false, precos: true },
        caixa: { ver: false, modificar: false, excluir: false, precos: false },
        contratos: { ver: false, modificar: false, excluir: false, precos: false },
        relatorios: { ver: false, modificar: false, excluir: false, precos: false },
        finances_widget: { ver: false },
        chat_arquiteto: { ver: false }
    },
    financeiro: {
        clientes: { ver: true, modificar: false, excluir: false, precos: true },
        ordens: { ver: true, modificar: false, excluir: false, precos: true },
        colaboradores: { ver: true, modificar: false, excluir: false, precos: false },
        materiais: { ver: true, modificar: false, excluir: false, precos: true },
        ferramentas: { ver: true, modificar: false, excluir: false, precos: true },
        servicos: { ver: true, modificar: false, excluir: false, precos: true },
        fornecedores: { ver: true, modificar: false, excluir: false, precos: true },
        obras: { ver: true, modificar: false, excluir: false, precos: true },
        caixa: { ver: true, modificar: true, excluir: true, precos: true },
        contratos: { ver: true, modificar: false, excluir: false, precos: true },
        relatorios: { ver: true, modificar: false, excluir: false, precos: true },
        finances_widget: { ver: true },
        chat_arquiteto: { ver: true }
    },
    admin: {
        clientes: { ver: true, modificar: true, excluir: true, precos: true },
        ordens: { ver: true, modificar: true, excluir: true, precos: true },
        colaboradores: { ver: true, modificar: true, excluir: true, precos: true },
        materiais: { ver: true, modificar: true, excluir: true, precos: true },
        ferramentas: { ver: true, modificar: true, excluir: true, precos: true },
        servicos: { ver: true, modificar: true, excluir: true, precos: true },
        fornecedores: { ver: true, modificar: true, excluir: true, precos: true },
        obras: { ver: true, modificar: true, excluir: true, precos: true },
        caixa: { ver: true, modificar: true, excluir: true, precos: true },
        contratos: { ver: true, modificar: true, excluir: true, precos: true },
        relatorios: { ver: true, modificar: true, excluir: true, precos: true },
        finances_widget: { ver: true },
        chat_arquiteto: { ver: true }
    }
};

/**
 * Retorna as permissões para um cargo e módulo específicos.
 * @param {string} cargo 
 * @param {string} modulo 
 */
export function getPermissions(cargo, modulo) {
    const roleLimits = RBAC[cargo] || RBAC.tecnico;
    return roleLimits[modulo] || { ver: false, modificar: false, excluir: false, precos: false };
}
