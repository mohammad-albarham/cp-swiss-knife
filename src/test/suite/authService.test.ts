import * as assert from 'assert';
import { initAuthService, getAuthService, AuthService } from '../../services/authService';
import { initStorageService } from '../../services/storageService';

/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
const vscode = require('vscode') as any;
const { createMockExtensionContext } = vscode._test;
/* eslint-enable @typescript-eslint/no-var-requires */

suite('AuthService', () => {
    let service: AuthService;
    let context: any;

    setup(() => {
        context = createMockExtensionContext();
        initStorageService(context);
        service = initAuthService();
    });

    test('initializes with stored session', async () => {
        const session = { handle: 'tourist', isLoggedIn: true, apiKey: 'k', apiSecret: 's' };
        await context.secrets.store('codeforces.session', JSON.stringify(session));
        
        await service.initialize();
        assert.strictEqual(service.isLoggedIn(), true);
        assert.strictEqual(service.getCurrentSession()?.apiKey, 'k');
    });

    test('login preserves existing credentials if handle is the same', async () => {
        // 1. Setup initial session with credentials
        const initialSession = { handle: 'tourist', isLoggedIn: true, apiKey: 'old-key', apiSecret: 'old-secret' };
        await context.secrets.store('codeforces.session', JSON.stringify(initialSession));
        await service.initialize();

        // 2. Mock UI to "login" without API credentials
        vscode.window.showInputBox = () => Promise.resolve('tourist'); // same handle
        vscode.window.showQuickPick = () => Promise.resolve({ value: 'without-api' });

        // 3. Perform login
        await service.login();

        // 4. Verify credentials are preserved
        const session = service.getCurrentSession();
        assert.strictEqual(session?.handle, 'tourist');
        assert.strictEqual(session?.apiKey, 'old-key');
        assert.strictEqual(session?.apiSecret, 'old-secret');
    });

    test('login clears existing credentials if handle is different', async () => {
        // 1. Setup initial session with credentials
        const initialSession = { handle: 'tourist', isLoggedIn: true, apiKey: 'old-key', apiSecret: 'old-secret' };
        await context.secrets.store('codeforces.session', JSON.stringify(initialSession));
        await service.initialize();

        // 2. Mock UI to "login" as a different user without API credentials
        vscode.window.showInputBox = () => Promise.resolve('petr'); // different handle
        vscode.window.showQuickPick = () => Promise.resolve({ value: 'without-api' });

        // 3. Perform login
        await service.login();

        // 4. Verify credentials are cleared
        const session = service.getCurrentSession();
        assert.strictEqual(session?.handle, 'petr');
        assert.strictEqual(session?.apiKey, undefined);
        assert.strictEqual(session?.apiSecret, undefined);
    });
});
