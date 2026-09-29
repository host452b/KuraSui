import { test, expect } from '@playwright/test';

test('desktop anatomy renders and controls change the scene', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto('/');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByRole('button', { name: '模型 肝脏', exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/kurasui-desktop.png', fullPage: true });
  const front = await canvas.screenshot();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 70, bounds.y + bounds.height / 2, {
    steps: 10,
  });
  await page.mouse.up();
  await expect(async () => {
    expect((await canvas.screenshot()).equals(front)).toBe(false);
  }).toPass();
  await page.getByRole('button', { name: '重置视角' }).click();
  // The tool strip overlaps the canvas bounds. Move away so its hover color
  // cannot be mistaken for a camera reset failure.
  await page.mouse.move(20, 20);
  await expect(async () => {
    expect((await canvas.screenshot()).equals(front)).toBe(true);
  }).toPass({ timeout: 5000 });
  await page.getByRole('button', { name: '背面', exact: true }).click();
  await expect(async () => {
    expect((await canvas.screenshot()).equals(front)).toBe(false);
  }).toPass();
  await page.getByRole('button', { name: '正面', exact: true }).click();
  await page.getByRole('button', { name: '模型 肝脏', exact: true }).click();
  await expect(page.getByTestId('organ-detail')).toContainText('肝脏');
  await page.getByRole('button', { name: '切换透明层' }).click();
  await page.getByRole('button', { name: '放大人体' }).click();
  await page.getByRole('button', { name: '重置视角' }).click();
});
