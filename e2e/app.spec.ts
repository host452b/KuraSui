import { test, expect } from '@playwright/test';

test('body, dates, trends and honest missing states stay linked', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '身体的时间地图' })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByTestId('organ-detail')).toContainText('肝脏');
  await page.getByRole('button', { name: '选择肺部', exact: true }).click();
  await expect(page.getByTestId('organ-detail')).toContainText('右肺上叶');
  await page.getByLabel('查看日期').fill('2026-03-12');
  await expect(page.getByTestId('records-table')).not.toContainText('2026-09-18');
  await page.getByLabel('查看日期').fill('2026-09-18');
  await page.getByRole('button', { name: '邻近记录', exact: true }).click();
  await page.getByRole('button', { name: '选择甲状腺', exact: true }).click();
  await expect(page.getByTestId('records-table')).toContainText('2026-09-05');
  await expect(page.getByTestId('records-table')).toContainText('13 天前');
  await page.getByRole('button', { name: '选择脑部', exact: true }).click();
  await expect(page.getByTestId('organ-detail')).toContainText('暂无记录');
  expect(errors).toEqual([]);
});

test('personal records can be added, edited, persisted, exported and deleted', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '我的数据', exact: true }).click();
  await expect(page.getByTestId('records-table')).toContainText('暂无记录');
  await page.getByRole('button', { name: '添加记录', exact: true }).click();
  await page.getByLabel('指标名称').fill('测试自定义指标');
  await page.getByLabel('检查日期', { exact: true }).fill('2026-09-20');
  await page.getByLabel('数值', { exact: true }).fill('4.2');
  await page.getByLabel('单位', { exact: true }).fill('mmol/L');
  await page.getByLabel('参考上限').fill('3.4');
  await page.getByLabel('记录来源').fill('本地测试报告');
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(page.getByTestId('records-table')).toContainText('测试自定义指标');
  await expect(page.getByTestId('records-table')).toContainText('超出范围');
  await page.reload();
  await expect(page.getByTestId('records-table')).toContainText('测试自定义指标');
  await page.getByRole('button', { name: '编辑 测试自定义指标' }).click();
  await page.getByLabel('数值', { exact: true }).fill('3.2');
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(page.getByTestId('records-table')).toContainText('范围内');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出数据', exact: true }).click();
  expect((await download).suggestedFilename()).toContain('personal');
  await page.getByRole('button', { name: '删除 测试自定义指标' }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.getByTestId('records-table')).toContainText('暂无记录');
  await page.reload();
  await expect(page.getByTestId('records-table')).toContainText('暂无记录');
  await page.getByRole('button', { name: '示例空间', exact: true }).click();
  await expect(page.getByTestId('records-table')).not.toContainText('测试自定义指标');
});

test('2D fallback and mobile navigation work without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?view=2d');
  await expect(page.getByTestId('body-fallback')).toBeVisible();
  await page.getByRole('button', { name: '选择肾脏', exact: true }).click();
  await expect(page.getByTestId('organ-detail')).toContainText('肾脏');
  const layout = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll('body *')]
      .filter(
        (el) =>
          el.getBoundingClientRect().right > window.innerWidth + 1 &&
          !el.closest('.timeline-track, .records-table-wrap'),
      )
      .slice(0, 30)
      .map((el) => ({
        tag: el.tagName,
        className: el.className,
        right: el.getBoundingClientRect().right,
      })),
  }));
  await page.screenshot({ path: 'artifacts/kurasui-mobile.png', fullPage: true });
  expect(layout.scrollWidth, JSON.stringify(layout)).toBeLessThanOrEqual(layout.width);
});

test('lesion follow-up requires confirmation and comparison preserves separate identities', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '添加记录', exact: true }).click();
  await page.getByLabel('记录类型').selectOption('lesion');
  await page.getByLabel('病灶身份').selectOption('LUNG-001');
  await page.getByLabel('检查日期', { exact: true }).fill('2026-09-22');
  await page.getByLabel('病灶尺寸').fill('6 × 4');
  await page.getByLabel('记录来源').fill('虚构测试 · 肺部随访');
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('确认');
  await page.getByLabel('我已核对报告，确认这是同一个病灶').check();
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(page.getByTestId('records-table')).toContainText('LUNG-001');
  await page.getByRole('button', { name: '邻近记录', exact: true }).click();
  await expect(page.getByTestId('records-table')).toContainText('LUNG-002');
  await page.getByRole('button', { name: '对比检查', exact: true }).first().click();
  await page.getByLabel('较早检查日期').fill('2026-09-18');
  await page.getByLabel('较晚检查日期').fill('2026-09-22');
  const row1 = page.locator('.compare-table tr').filter({ hasText: 'LUNG-001' });
  await expect(row1).toContainText('+1 / 0');
  const row2 = page.locator('.compare-table tr').filter({ hasText: 'LUNG-002' });
  await expect(row2).toContainText('缺少可比记录');
});

test('historical nearby records need explicit opt in and empty storage stays empty', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '选择肺部', exact: true }).click();
  await page.getByLabel('查看日期').fill('2026-09-10');
  await page.getByRole('button', { name: '邻近记录', exact: true }).click();
  await expect(page.getByTestId('records-table')).not.toContainText('2026-09-18');
  await page.getByLabel('同时包含之后 30 天').check();
  await expect(page.getByTestId('records-table')).toContainText('之后 8 天 · 后续记录');
  await expect(page.locator('.trend-card')).toContainText('1 次记录');
  await page.getByRole('button', { name: '数据管理', exact: true }).click();
  await page.getByRole('button', { name: /清空当前空间/ }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.getByTestId('records-table')).toContainText('暂无记录');
  await page.reload();
  await expect(page.getByTestId('records-table')).toContainText('暂无记录');
});

test('no WebGL gracefully degrades without external requests', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (name: string, ...args: unknown[]) {
      if (name.includes('webgl')) return null;
      return original.apply(this, [name, ...args] as never);
    } as typeof original;
  });
  const external: string[] = [];
  const baseURL = String(test.info().project.use.baseURL);
  page.on('request', (req) => {
    if (
      !req.url().startsWith(baseURL) &&
      !req.url().startsWith('data:') &&
      !req.url().startsWith('blob:')
    )
      external.push(req.url());
  });
  await page.goto('/');
  await expect(page.getByTestId('body-fallback')).toBeVisible();
  await page.getByRole('button', { name: '选择心脏', exact: true }).click();
  await expect(page.getByTestId('organ-detail')).toContainText('静息心率');
  expect(external).toEqual([]);
});

test('failed local persistence leaves the form open and does not claim success', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'kurasui:personal:v1')
        throw new DOMException('Storage full', 'QuotaExceededError');
      original.call(this, key, value);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: '我的数据', exact: true }).click();
  await page.getByRole('button', { name: '添加记录', exact: true }).click();
  await page.getByLabel('指标名称').fill('存储失败测试');
  await page.getByLabel('数值', { exact: true }).fill('2');
  await page.getByLabel('记录来源').fill('虚构测试');
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('更改尚未保存');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByTestId('records-table')).not.toContainText('存储失败测试');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
