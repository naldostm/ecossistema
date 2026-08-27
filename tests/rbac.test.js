import { describe, it, expect } from 'vitest';
import { getPermissions } from '../frontend/js/utils/rbac.js';

describe('RBAC System', () => {
    it('should deny technical users access to financial data', () => {
        const perms = getPermissions('tecnico', 'caixa');
        expect(perms.ver).toBe(false);
    });

    it('should allow admin users full access to everything', () => {
        const perms = getPermissions('admin', 'clientes');
        expect(perms.ver).toBe(true);
        expect(perms.modificar).toBe(true);
        expect(perms.excluir).toBe(true);
        expect(perms.precos).toBe(true);
    });

    it('should allow technical users to see and modify tools (ferramentas)', () => {
        const perms = getPermissions('tecnico', 'ferramentas');
        expect(perms.ver).toBe(true);
        expect(perms.modificar).toBe(true);
    });

    it('should default to tecnico permissions for unknown roles', () => {
        const perms = getPermissions('desconhecido', 'caixa');
        expect(perms.ver).toBe(false);
    });
});
