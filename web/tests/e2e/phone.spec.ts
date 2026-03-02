import { expect, test } from '@playwright/test';

test('opens phone and navigates menu/apps', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize({ width: 1920, height: 1080 });

  await expect(page.getByTestId('home-app-settings')).toBeVisible();
  await page.getByTestId('home-app-settings').evaluate((el: HTMLElement) => el.click());

  await expect(page.getByRole('button', { name: 'Apariencia' })).toBeVisible();
  await page.getByRole('button', { name: 'Seguridad' }).evaluate((el: HTMLElement) => el.click());
  await expect(page.getByText('Bloqueo por PIN')).toBeVisible();
});

test('validates iOS controls and notification preview', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize({ width: 1920, height: 1080 });

  await page.getByTestId('home-app-settings').evaluate((el: HTMLElement) => el.click());
  await expect(page.getByRole('button', { name: 'Apariencia' })).toBeVisible();

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('phone:keyUp', { detail: 'Backspace' }));
  });

  await page.evaluate(() => {
    window.dispatchEvent(new Event('phone:openControlCenter'));
  });
  await expect(page.getByTestId('preview-notification-btn')).toBeVisible();
  await page.getByTestId('preview-notification-btn').evaluate((el: HTMLElement) => el.click());
  await expect(page.getByText('WaveChat').first()).toBeVisible();
  await expect(page.getByText('Mensaje nuevo de Alex').first()).toBeVisible();
});

test('opens wavechat and gallery carousel controls', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize({ width: 1920, height: 1080 });

  await expect(page.getByTestId('home-app-wavechat')).toBeVisible();
  await page.getByTestId('home-app-wavechat').evaluate((el: HTMLElement) => el.click());
  await expect(page.getByRole('button', { name: 'Chats' })).toBeVisible();

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('phone:keyUp', { detail: 'Backspace' }));
  });
  await expect(page.getByTestId('home-app-gallery')).toBeVisible();

  await page.getByTestId('home-app-gallery').evaluate((el: HTMLElement) => el.click());
  await page.locator('img[alt="Photo"]').first().evaluate((el: HTMLElement) => el.click());
  await expect(page.getByText('1 / 2')).toBeVisible();
  await page.getByRole('button', { name: '›' }).last().evaluate((el: HTMLElement) => el.click());
  await expect(page.getByText('2 / 2')).toBeVisible();
});

test('supports drag gestures for top control surfaces', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize({ width: 1920, height: 1080 });

  await page.getByTestId('control-center-toggle').evaluate((el: HTMLElement) => {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientY: 2 }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientY: 92 }));
  });

  await expect(page.getByTestId('control-center-sheet')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar' }).last().evaluate((el: HTMLElement) => el.click());
  await expect(page.getByTestId('control-center-sheet')).toHaveCount(0);

  await page.getByTestId('notification-center-toggle').evaluate((el: HTMLElement) => {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientY: 2 }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientY: 92 }));
  });

  await expect(page.getByTestId('notification-center-sheet')).toBeVisible();
});

test('keeps desktop page state across app lifecycle', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize({ width: 1920, height: 1080 });

  await page.getByTestId('desktop-page-next').evaluate((el: HTMLElement) => el.click());
  await expect(page.getByTestId('home-app-weather')).toBeVisible();

  await page.getByTestId('home-app-weather').evaluate((el: HTMLElement) => el.click());
  await expect(page.getByText('Pronostico')).toBeVisible();

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('phone:keyUp', { detail: 'Backspace' }));
  });

  await expect(page.getByTestId('home-app-weather')).toBeVisible();

  const persistedPage = await page.evaluate(() => window.localStorage.getItem('gcphone:desktopPage'));
  expect(persistedPage).toBe('1');
});
