import { getPermissions } from '../frontend/js/utils/rbac.js';

function test() {
    console.log('--- Starting RBAC Unit Tests (Node standalone) ---');
    let passed = 0;
    let failed = 0;

    const runTest = (name, fn) => {
        try {
            fn();
            console.log(`✅ ${name}`);
            passed++;
        } catch (e) {
            console.error(`❌ ${name}: ${e.message}`);
            failed++;
        }
    };

    runTest('Technical user denies finance access', () => {
        const perms = getPermissions('tecnico', 'caixa');
        if (perms.ver !== false) throw new Error('Technical user should not see finance');
    });

    runTest('Admin user allows everything', () => {
        const perms = getPermissions('admin', 'clientes');
        if (!perms.ver || !perms.modificar || !perms.excluir || !perms.precos) {
            throw new Error('Admin should have full access');
        }
    });

    runTest('Technical user allows tool modification', () => {
        const perms = getPermissions('tecnico', 'ferramentas');
        if (!perms.ver || !perms.modificar) throw new Error('Technician should modify tools');
    });

    console.log(`\nTests finished. Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0) process.exit(1);
}

test();
