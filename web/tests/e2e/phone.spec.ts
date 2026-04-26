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
  await page.evaluate(() => window.gcphoneMock?.showHome());
  await expectHomeVisible(page);
}

async function openLockedPhone(page: Page) {
  await page.goto('/');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await waitForMock(page);
  await page.waitForTimeout(180);
  await page.evaluate(() => window.gcphoneMock?.showLocked());
  await expect(page.getByText('Desbloquear Gcphone-Next')).toBeVisible();
}

async function unlockWithPin(page: Page, pin = '1234') {
  for (const digit of pin) {
    await page.getByRole('button', { name: digit, exact: true }).click();
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
  await page.getByRole('button', { name: 'Cerrar' }).last().click();
  await expect(page.getByTestId('control-center-sheet')).toHaveCount(0);

  await page.evaluate(() => window.gcphoneMock?.openNotificationCenter?.());

  await expect(page.getByTestId('notification-center-sheet')).toBeVisible();
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
