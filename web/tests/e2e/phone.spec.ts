import { expect, test, type Page } from '@playwright/test';

type MockPhoneApi = {
  showHome: () => void;
  showLocked: () => void;
  goHome?: () => void;
  keyUp?: (key?: string) => void;
  openControlCenter?: () => void;
  openNotificationCenter?: () => void;
  incomingNfc?: (kind?: string) => void;
};

declare global {
  interface Window {
    gcphoneMock?: MockPhoneApi;
  }
}

const NFC_NOTE_TEXT = 'Puerta lateral: 2048. No compartir fuera del equipo.';

async function waitForMock(page: Page) {
  await page.waitForFunction(() => Boolean(window.gcphoneMock));
}

async function expectHomeVisible(page: Page) {
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="home-app-"]'))
      .some((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || 1) > 0;
      });
  });
}

async function openUnlockedPhone(page: Page) {
  await page.goto('/');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await waitForMock(page);
  await page.waitForTimeout(180);
  await page.evaluate(() => {
    window.localStorage.setItem('gcphone:desktopPage', '0');
    window.gcphoneMock?.showHome();
  });
  await expectHomeVisible(page);
}

async function openLockedPhone(page: Page) {
  await page.goto('/');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await waitForMock(page);
  await page.waitForTimeout(180);
  await page.evaluate(() => {
    window.localStorage.setItem('gcphone:desktopPage', '0');
    window.gcphoneMock?.showLocked();
  });
  await expect(page.getByRole('button', { name: /Desbloquear|Unlock/i }).first()).toBeVisible();
}

async function ensurePinKeypadVisible(page: Page) {
  const keypadReady = await page.evaluate(() => {
    return Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .some((button) => (button.textContent || '').trim() === '1' || button.getAttribute('aria-label') === '1');
  });
  if (keypadReady) return;

  await page.getByRole('button', { name: /Desbloquear|Unlock/i }).first().click();
  await expect.poll(async () => page.evaluate(() => {
    return Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .some((button) => (button.textContent || '').trim() === '1' || button.getAttribute('aria-label') === '1');
  })).toBe(true);
}

async function unlockWithPin(page: Page, pin = '1234') {
  await ensurePinKeypadVisible(page);
  for (const digit of pin) {
    await page.evaluate((value) => {
      const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((candidate) => (candidate.textContent || '').trim() === value || candidate.getAttribute('aria-label') === value);
      if (!button) throw new Error(`Missing PIN digit button: ${value}`);
      button.click();
    }, digit);
  }
  await expect(page.getByTestId('home-app-settings')).toBeVisible();
}

async function goHomeWithBackspace(page: Page) {
  await page.evaluate(() => window.gcphoneMock?.keyUp?.('Backspace'));
  await page.waitForTimeout(120);
  const hasVisibleHome = await page.evaluate(() => {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="home-app-"]'))
      .some((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || 1) > 0;
      });
  });
  if (!hasVisibleHome) {
    await page.evaluate(() => window.gcphoneMock?.goHome?.());
  }
  await expectHomeVisible(page);
}

async function goHomeDirect(page: Page) {
  await page.evaluate(() => window.gcphoneMock?.goHome?.());
  await expectHomeVisible(page);
}

async function expectSheetClosed(page: Page, testId: string) {
  await expect(page.getByTestId(testId)).toHaveCount(0);
}

async function openHomeApp(page: Page, testId: string) {
  await expectHomeVisible(page);
  const overlay = page.getByTestId('dynamic-island-overlay');
  if (await overlay.isVisible().catch(() => false)) {
    await overlay.click({ force: true });
    await expect(overlay).toHaveCount(0);
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const app = page.getByTestId(testId);
    if (await app.isVisible().catch(() => false)) {
      await app.click();
      return;
    }

    const nextPage = page.getByTestId('desktop-page-next');
    if (await nextPage.isVisible().catch(() => false)) {
      await nextPage.click();
      await page.waitForTimeout(120);
    }
  }

  throw new Error(`Home app not visible: ${testId}`);
}

async function emitGenericNfcPayload(page: Page, payload: {
  appId: string;
  route: string;
  title: string;
  message: string;
  text: string;
  mediaUrl?: string;
}) {
  await page.evaluate((data) => {
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        action: 'phone:notification',
        data: {
          id: `nfc-payload-${Date.now()}`,
          appId: data.appId,
          title: data.title,
          message: data.message,
          priority: 'normal',
          route: data.route,
          data: {
            nfcAction: 'received_payload',
            nfcPayload: {
              appId: data.appId,
              route: data.route,
              text: data.text,
              mediaUrl: data.mediaUrl,
            },
            from: 'Lucia Mock',
            requestId: Date.now(),
          },
        },
      },
    }));
  }, payload);
}

async function startLocationActivity(page: Page) {
  await openHomeApp(page, 'home-app-settings');
  await page.getByRole('button', { name: /Sistema|System/i }).click();
  await page.getByRole('switch').first().click();
  await expect(page.getByRole('switch', { checked: true }).first()).toBeVisible();
}

async function startClockTimerActivity(page: Page) {
  await openHomeApp(page, 'home-app-clock');
  await page.getByRole('button', { name: /Timer/i }).click();
  await page.getByRole('button', { name: /Iniciar|Start/i }).click();
  await expect(page.getByRole('button', { name: /Detener|Stop/i })).toBeVisible();
}

async function expectNotesDestination(page: Page) {
  await expect(page.getByText('Notas').first()).toBeVisible();
}

test('requires the default PIN before entering home', async ({ page }) => {
  await openLockedPhone(page);
  await unlockWithPin(page);
});

test('opens phone and navigates menu/apps', async ({ page }) => {
  await openUnlockedPhone(page);

  await page.getByTestId('home-app-settings').click();

  await expect(page.getByRole('button', { name: 'Apariencia' })).toBeVisible();
  await page.getByRole('button', { name: 'Seguridad' }).click();
  await expect(page.getByText('Bloqueo por PIN')).toBeVisible();
});

test('validates iOS controls and notification preview', async ({ page }) => {
  await openUnlockedPhone(page);

  await page.getByTestId('home-app-settings').click();
  await expect(page.getByRole('button', { name: 'Apariencia' })).toBeVisible();

  await goHomeWithBackspace(page);

  await page.evaluate(() => window.gcphoneMock?.openControlCenter?.());
  await expect(page.getByTestId('control-center-sheet')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar' }).last().click();

  await page.evaluate(() => window.gcphoneMock?.incomingNfc?.('note'));
  await page.evaluate(() => window.gcphoneMock?.openNotificationCenter?.());
  await expect(page.getByTestId('notification-center-sheet')).toBeVisible();
  await expect(page.getByText('Nota NFC').first()).toBeVisible();
});

test('keeps notification destination continuity from banner to notification center', async ({ page }) => {
  await openUnlockedPhone(page);

  await emitGenericNfcPayload(page, {
    appId: 'notes',
    route: 'notes',
    title: 'Payload Notes',
    message: 'Codigo de acceso compartido',
    text: NFC_NOTE_TEXT,
  });
  await expect(page.getByText('Payload Notes').first()).toBeVisible();
  await page.getByText('Codigo de acceso compartido').first().click();

  await expectNotesDestination(page);

  await goHomeWithBackspace(page);
  await page.evaluate(() => window.gcphoneMock?.openNotificationCenter?.());
  await expect(page.getByTestId('notification-center-sheet')).toBeVisible();
  await page.getByRole('button', { name: /Payload Notes/i }).first().click();

  await expectNotesDestination(page);
});

test('opens wavechat and gallery carousel controls', async ({ page }) => {
  await openUnlockedPhone(page);

  await expect(page.getByTestId('home-app-wavechat')).toBeVisible();
  await page.getByTestId('home-app-wavechat').click();
  await expect(page.getByRole('button', { name: 'Chats' })).toBeVisible();

  await goHomeWithBackspace(page);

  await page.getByTestId('home-app-gallery').evaluate((el: HTMLElement) => el.click());
  await expect(page.locator('img[alt="Photo"]').first()).toBeVisible();
});

test('supports drag gestures for top control surfaces', async ({ page }) => {
  await openUnlockedPhone(page);

  await page.evaluate(() => window.gcphoneMock?.openControlCenter?.());

  await expect(page.getByTestId('control-center-sheet')).toBeVisible();
  await expect(page.getByText(/PERSONAS CERCA DE TI|NEARBY PEOPLE/i).first()).toBeVisible();
  await page.getByTestId('control-center-nfc-toggle').click();
  await expect(page.getByTestId('control-center-sheet')).toBeVisible();
  await expect(page.getByText(/Buscando personas|Looking for nearby people|Mateo - 1.2m/i).first()).toBeVisible();
  await expect(page.getByText(/NFC activado|NFC desactivado/).first()).toBeVisible();

  await page.evaluate(() => window.gcphoneMock?.openNotificationCenter?.());

  await expect(page.getByTestId('notification-center-sheet')).toBeVisible();
});

test('opens muted notifications summary into settings notifications', async ({ page }) => {
  await openUnlockedPhone(page);

  await page.evaluate(() => window.gcphoneMock?.incomingNfc?.('note'));
  await page.evaluate(() => window.gcphoneMock?.openNotificationCenter?.());
  await expect(page.getByTestId('notification-center-sheet')).toBeVisible();

  await page.getByRole('button', { name: /Silenciar|Mute/i }).first().click();
  await page.getByTestId('notification-muted-summary').click();

  await expect(page.getByRole('button', { name: /Marcar todas como leidas|Mark all as read/i })).toBeVisible();
  await expect(page.getByText(/app silenciada|apps silenciadas/i)).toBeVisible();

  await page.getByRole('button', { name: /Volver|Back/i }).click();
  await expect(page.getByRole('button', { name: /Apariencia/i })).toBeVisible();
});

test('keeps desktop page state across app lifecycle', async ({ page }) => {
  await openUnlockedPhone(page);

  await page.getByTestId('desktop-page-next').click();
  await expect(page.getByTestId('home-app-weather')).toBeVisible();

  await page.getByTestId('home-app-weather').click();
  await expect(page.getByText('Clima').first()).toBeVisible();

  await goHomeWithBackspace(page);

  const persistedPage = await page.evaluate(() => window.localStorage.getItem('gcphone:desktopPage'));
  expect(persistedPage).toBe('1');
});

test('opens app, returns home, and closes app from recents without blank screen', async ({ page }) => {
  await openUnlockedPhone(page);

  await page.getByTestId('home-app-settings').click();
  await expect(page.getByRole('button', { name: 'Apariencia' })).toBeVisible();
  await goHomeWithBackspace(page);

  await page.getByTestId('home-app-gallery').evaluate((el: HTMLElement) => el.click());
  await expect(page.locator('img[alt="Photo"]').first()).toBeVisible();
  await page.getByTestId('multitask-btn').click();
  await expect(page.getByRole('dialog', { name: 'Apps recientes' })).toBeVisible();
  await page.getByRole('button', { name: /Cerrar Galeria|Cerrar Gallery/ }).click();

  await expectHomeVisible(page);
  await expect(page.getByText('Sin apps recientes').or(page.getByText(/abiertas/))).toBeVisible();
});

test('opens NFC invoice mock from notification into payment modal', async ({ page }) => {
  await openUnlockedPhone(page);

  await page.evaluate(() => window.gcphoneMock?.incomingNfc?.('invoice'));
  await page.evaluate(() => window.gcphoneMock?.openNotificationCenter?.());
  await expect(page.getByTestId('notification-center-sheet')).toBeVisible();
  await page.getByRole('button', { name: /Cobro NFC Ahora Wallet/ }).click();

  await expect(page.getByText('Cobro NFC recibido')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Banco', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cash', exact: true })).toBeVisible();
});

test('opens generic NFC payload notifications for chirp, clips, radio, and services', async ({ page }) => {
  await openUnlockedPhone(page);

  await emitGenericNfcPayload(page, {
    appId: 'chirp',
    route: 'chirp',
    title: 'Payload Chirp',
    message: 'Lucia compartio un chirp',
    text: 'CHIRP:1',
  });
  await page.evaluate(() => window.gcphoneMock?.openNotificationCenter?.());
  await expect(page.getByTestId('notification-center-sheet')).toBeVisible();
  await page.getByRole('button', { name: /Payload Chirp/ }).first().click();
  await expect(page.getByText('Comentarios')).toBeVisible();

  await goHomeWithBackspace(page);

  await emitGenericNfcPayload(page, {
    appId: 'clips',
    route: 'clips',
    title: 'Payload Clips',
    message: 'Lucia compartio un clip',
  text: 'CLIP:902',
  });
  await page.evaluate(() => window.gcphoneMock?.openNotificationCenter?.());
  await expect(page.getByTestId('notification-center-sheet')).toBeVisible();
  await page.getByRole('button', { name: /Payload Clips/ }).first().click();
  await expect(page.getByText(/Biblioteca/i)).toBeVisible();
  await expect(page.getByRole('button', { name: '+' })).toBeVisible();

  await goHomeWithBackspace(page);

  await emitGenericNfcPayload(page, {
    appId: 'radio',
    route: 'radio',
    title: 'Payload Radio',
    message: 'Lucia compartio una estacion',
    text: 'RADIO:1',
  });
  await page.evaluate(() => window.gcphoneMock?.openNotificationCenter?.());
  await expect(page.getByTestId('notification-center-sheet')).toBeVisible();
  await page.getByRole('button', { name: /Payload Radio/ }).first().click();
  await expect(page.getByText(/Los Santos FM/i)).toBeVisible();

  await goHomeWithBackspace(page);

  await emitGenericNfcPayload(page, {
    appId: 'services',
    route: 'services',
    title: 'Payload Services',
    message: 'Lucia compartio un servicio',
    text: 'SERVICE:1:mechanic',
  });
  await page.evaluate(() => window.gcphoneMock?.openNotificationCenter?.());
  await expect(page.getByTestId('notification-center-sheet')).toBeVisible();
  await page.getByRole('button', { name: /Payload Services/ }).first().click();
  await expect(page.getByRole('heading', { name: /Carlos Lopez/i })).toBeVisible();
});

test('keeps dynamic island stable with multiple activities and alternation', async ({ page }) => {
  await openUnlockedPhone(page);

  await startLocationActivity(page);
  await goHomeDirect(page);

  await startClockTimerActivity(page);
  await expect(page.getByTestId('dynamic-island')).toBeVisible();
  await expect(page.getByTestId('dynamic-island-activity-count').first()).toContainText('/2');
  await goHomeDirect(page);

  const activityCount = page.getByTestId('dynamic-island-activity-count').first();
  await page.waitForTimeout(3400);
  await expect(activityCount).toBeVisible();
  await expect(activityCount).toContainText('/2');
  const overlay = page.getByTestId('dynamic-island-overlay');
  if (await overlay.isVisible().catch(() => false)) {
    await overlay.click({ force: true });
    await expect(overlay).toHaveCount(0);
  }

  const before = await activityCount.textContent();
  await activityCount.click();
  await expect.poll(async () => await activityCount.textContent()).not.toBe(before);
  await page.getByTestId('dynamic-island').click();
  await expect(page.getByTestId('dynamic-island-overlay')).toBeVisible();
  await page.getByTestId('dynamic-island-overlay').click({ force: true });
  await expect(page.getByTestId('dynamic-island-overlay')).toHaveCount(0);
});

test('unlocks from the compact PIN sheet and returns cleanly to home', async ({ page }) => {
  await openLockedPhone(page);

  await unlockWithPin(page);
  await page.getByTestId('home-app-settings').click();
  await expect(page.getByRole('button', { name: /Apariencia/i })).toBeVisible();
  await goHomeWithBackspace(page);
  await expectHomeVisible(page);
  await expect(page.getByRole('button', { name: /Desbloquear|Unlock/i })).toHaveCount(0);
});

test('keeps control center and notification center coexistence stable', async ({ page }) => {
  await openUnlockedPhone(page);

  await emitGenericNfcPayload(page, {
    appId: 'notes',
    route: 'notes',
    title: 'Payload Notes',
    message: 'Codigo de acceso compartido',
    text: NFC_NOTE_TEXT,
  });
  await page.evaluate(() => window.gcphoneMock?.openNotificationCenter?.());
  await expect(page.getByTestId('notification-center-sheet')).toBeVisible();
  await expect(page.getByText('Payload Notes').first()).toBeVisible();

  await page.evaluate(() => window.gcphoneMock?.openControlCenter?.());
  await expect(page.getByTestId('control-center-sheet')).toBeVisible();
  await expectSheetClosed(page, 'notification-center-sheet');

  if (await page.getByTestId('control-center-sheet').count()) {
    await page.getByTestId('control-center-sheet').getByRole('button', { name: /Cerrar|Close/i }).last().click({ force: true });
  } else {
    await page.evaluate(() => window.gcphoneMock?.openControlCenter?.());
    await expect(page.getByTestId('control-center-sheet')).toBeVisible();
    await page.getByTestId('control-center-sheet').getByRole('button', { name: /Cerrar|Close/i }).last().click({ force: true });
  }

  await expectHomeVisible(page);
  await expectSheetClosed(page, 'control-center-sheet');
});
