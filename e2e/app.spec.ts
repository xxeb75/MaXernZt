import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

type Pose = { name: string; x: number; y: number; rot: number; sx: number; sy: number };

/** Ouvre l'appli sans visite guidée, en surveillant les erreurs de la page. */
async function openApp(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { try { localStorage.setItem('maxernzt.tour', '1'); localStorage.setItem('maxernzt.nopicker', '1'); } catch { /* ignoré */ } });
  await page.goto('/' + query);
  await page.waitForFunction(() => !!(window as any).__app);
  return errors;
}

/** Ajoute un carré de couleur au centre (x, y) de la feuille. */
const addSquare = (page: Page, name: string, color: string, x: number, y: number, size = 140) => page.evaluate(({ name, color, x, y, size }) => {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!; g.fillStyle = color; g.fillRect(0, 0, size, size);
  (window as any).__app.addLayer(c, name, { pos: { x, y }, rot: 0, scale: { x: 1, y: 1 } });
}, { name, color, x, y, size });

/** État réel des calques, de l'arrière vers l'avant. */
const poses = (page: Page): Promise<Pose[]> => page.evaluate(() => (window as any).__app.layers.map((l: any) => ({ name: l.name, x: l.box.x, y: l.box.y, rot: l.box.rotation, sx: l.box.scale.x, sy: l.box.scale.y })));
const names = async (page: Page) => (await poses(page)).map(p => p.name);
/** Indices d'empilement dans Pixi : doivent croître avec l'ordre des calques. */
const stackIdx = (page: Page): Promise<number[]> => page.evaluate(() => (window as any).__app.layers.map((l: any) => l.box.parent.getChildIndex(l.box)));
const project = (page: Page) => page.evaluate(() => JSON.parse((window as any).__app.projectJson()));

/** Position écran (px de la page) du centre d'un calque. */
const screenPos = (page: Page, name: string) => page.evaluate(n => {
  const a = (window as any).__app, l = a.layers.find((q: any) => q.name === n), g = l.box.getGlobalPosition(), r = a.app.canvas.getBoundingClientRect();
  return { x: r.left + g.x, y: r.top + g.y };
}, name);

/** Le nom du calque dans le panneau (le centre de la ligne tombe sur des boutons). */
const row = (page: Page, name: string) => page.locator('#layer-list li.ly .nm', { hasText: new RegExp(`^${name}$`) });

/** Enregistre par le bouton Enregistrer (chemin « téléchargement ») et renvoie le texte du fichier. */
async function saveViaButton(page: Page): Promise<string> {
  const dl = page.waitForEvent('download');
  await page.click('#btn-save');
  const path = await (await dl).path();
  return readFileSync(path, 'utf8');
}
/** Rouvre un fichier par le vrai champ « Ouvrir ». */
async function openViaInput(page: Page, name: string, text: string) {
  await page.setInputFiles('#file-proj', { name, mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#status')).toContainText('ouvert', { timeout: 15_000 });
}

test.describe('MaXernZt : invariants fonctionnels', () => {
  test('projet simple : transformer, enregistrer, rouvrir → même état', async ({ page }) => {
    const errors = await openApp(page);
    await addSquare(page, 'rouge', '#d33', 400, 500);
    await addSquare(page, 'vert', '#3a3', 700, 500);
    await addSquare(page, 'bleu', '#33d', 550, 900);

    // déplacement réel à la souris
    const before = (await poses(page)).find(p => p.name === 'bleu')!;
    const s = await screenPos(page, 'bleu');
    await page.mouse.move(s.x, s.y); await page.mouse.down(); await page.mouse.move(s.x + 40, s.y + 20, { steps: 4 }); await page.mouse.move(s.x + 90, s.y + 45, { steps: 6 }); await page.mouse.up();
    const after = (await poses(page)).find(p => p.name === 'bleu')!;
    expect(after.x).toBeGreaterThan(before.x + 20);
    expect(after.y).toBeGreaterThan(before.y + 10);

    const saved = await poses(page);
    const text = await saveViaButton(page);
    expect(JSON.parse(text)).toMatchObject({ format: 'maxernzt', version: 2 });

    await page.click('#btn-new');                      // feuille vide (annulable, donc sans confirmation si rien de modifié depuis l'enregistrement)
    await page.waitForFunction(() => (window as any).__app.layers.length === 0, null, { timeout: 5000 }).catch(() => {});
    await openViaInput(page, 'rt.maxernzt', text);
    const reopened = await poses(page);
    expect(reopened.map(p => p.name)).toEqual(saved.map(p => p.name));
    reopened.forEach((p, i) => { expect(p.x).toBeCloseTo(saved[i].x, 3); expect(p.y).toBeCloseTo(saved[i].y, 3); expect(p.rot).toBeCloseTo(saved[i].rot, 6); expect(p.sx).toBeCloseTo(saved[i].sx, 6); });
    expect(errors).toEqual([]);
  });

  test('calques : sélectionner et déplacer ne change pas l\'ordre ; « monter » le change', async ({ page }) => {
    const errors = await openApp(page);
    for (const [i, n] of ['a', 'b', 'c', 'd'].entries()) await addSquare(page, n, ['#d33', '#3a3', '#33d', '#da3'][i], 250 + i * 300, 500);
    expect(await names(page)).toEqual(['a', 'b', 'c', 'd']);

    await row(page, 'b').click();                      // sélection par le panneau
    expect(await names(page)).toEqual(['a', 'b', 'c', 'd']);
    const s = await screenPos(page, 'a');              // sélection et déplacement sur la feuille
    await page.mouse.move(s.x, s.y); await page.mouse.down(); await page.mouse.move(s.x + 30, s.y + 30, { steps: 5 }); await page.mouse.up();
    expect(await names(page)).toEqual(['a', 'b', 'c', 'd']);
    expect((await stackIdx(page))).toEqual([...(await stackIdx(page))].sort((x, y) => x - y));

    await row(page, 'a').click(); await page.click('#btn-up');
    expect(await names(page)).toEqual(['b', 'a', 'c', 'd']);
    const idx = await stackIdx(page);
    expect(idx).toEqual([...idx].sort((x, y) => x - y));
    await page.keyboard.press('Control+z');
    expect(await names(page)).toEqual(['a', 'b', 'c', 'd']);
    expect(errors).toEqual([]);
  });

  test('groupes : grouper, verrouiller, masquer, enregistrer, rouvrir', async ({ page }) => {
    const errors = await openApp(page);
    for (const [i, n] of ['a', 'b', 'c', 'd'].entries()) await addSquare(page, n, ['#d33', '#3a3', '#33d', '#da3'][i], 250 + i * 300, 500);

    await row(page, 'b').click(); await row(page, 'c').click({ modifiers: ['Control'] });
    await page.click('#btn-group');
    let p = await project(page);
    expect(p.tree).toHaveLength(3);                                    // a, [b c], d
    expect(p.tree[1]).toMatchObject({ name: expect.any(String), c: [{ l: p.layers[1].id }, { l: p.layers[2].id }] });
    expect(p.layers.map((l: any) => l.name)).toEqual(['a', 'b', 'c', 'd']);   // grouper ne change pas l'ordre

    await page.click('#btn-lock');                                     // verrouille la sélection (le groupe)
    p = await project(page);
    expect(p.tree[1].k).toBe(true);
    const sb = await screenPos(page, 'b'), before = (await poses(page)).find(q => q.name === 'b')!;
    await page.mouse.move(sb.x, sb.y); await page.mouse.down(); await page.mouse.move(sb.x + 60, sb.y + 40, { steps: 5 }); await page.mouse.up();
    expect((await poses(page)).find(q => q.name === 'b')).toMatchObject({ x: before.x, y: before.y });   // un élément verrouillé ne bouge pas

    await page.locator('#layer-list li.grp .eye').first().click();    // masque le groupe
    expect((await project(page)).tree[1].v).toBe(false);

    const text = await saveViaButton(page);
    await page.click('#btn-new');
    await openViaInput(page, 'g.maxernzt', text);
    const q = await project(page);
    expect(q.tree).toEqual(JSON.parse(text).tree);
    expect(q.tree[1]).toMatchObject({ v: false, k: true });
    expect(await page.evaluate(() => (window as any).__app.layers.filter((l: any) => !l.box.visible).map((l: any) => l.name))).toEqual(['b', 'c']);
    expect(errors).toEqual([]);
  });

  test('animation : une trajectoire ne modifie pas la pose de repos, projet animé ouvert à t=0', async ({ page }) => {
    const errors = await openApp(page);
    await addSquare(page, 'x', '#d33', 400, 500);
    const rest = (await poses(page))[0];

    await page.keyboard.press('p');                                    // outil trajectoire : on dessine à partir de l'élément
    const s = await screenPos(page, 'x');
    await page.mouse.move(s.x, s.y); await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(s.x + i * 18, s.y + Math.sin(i / 2) * 40, { steps: 2 });
    await page.mouse.up();
    expect(await page.evaluate(() => !!(window as any).__app.layers[0].anim)).toBe(true);

    await page.keyboard.press('Escape'); await page.keyboard.press('v'); // retour à l'outil déplacer
    await page.click('#btn-play');
    await page.waitForTimeout(900);
    const live = (await poses(page))[0];
    expect(Math.hypot(live.x - rest.x, live.y - rest.y)).toBeGreaterThan(5);        // ça bouge bien
    const during = (await project(page)).layers[0];                                  // mais le fichier garde la pose de repos
    expect(during.x).toBeCloseTo(rest.x, 3); expect(during.y).toBeCloseTo(rest.y, 3);
    await page.click('#btn-stop');
    expect((await poses(page))[0].x).toBeCloseTo(rest.x, 3);

    const text = await saveViaButton(page);
    await page.click('#btn-new');
    await openViaInput(page, 'anim.maxernzt', text);
    expect(await page.evaluate(() => !!(window as any).__app.layers[0].anim)).toBe(true);
    expect((await project(page)).layers[0].anim.pts.length).toBeGreaterThan(5);

    // exemple animé à la timeline : à l'ouverture, pose de l'instant 0 puis la pose de repos reste celle du fichier
    await page.goto('/?open=examples/mots-qui-dansent.maxernzt');
    await page.waitForFunction(() => (window as any).__app?.layers.length > 5);
    const orig = await (await page.request.get('/examples/mots-qui-dansent.maxernzt')).json();
    await page.waitForTimeout(500);
    const saved = await project(page);
    saved.layers.forEach((l: any, i: number) => { expect(l.x).toBeCloseTo(orig.layers[i].x, 3); expect(l.y).toBeCloseTo(orig.layers[i].y, 3); });
    expect(errors).toEqual([]);
  });

  test('audio : importer, analyser, danser, enregistrer, rouvrir', async ({ page }) => {
    const errors = await openApp(page);
    for (const [i, n] of ['a', 'b', 'c'].entries()) await addSquare(page, n, ['#d33', '#3a3', '#33d'][i], 300 + i * 350, 500);

    // 8 s de grosse caisse à 120 BPM, en WAV 16 bits mono
    const sr = 22050, n = sr * 8, buf = Buffer.alloc(44 + n * 2);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) { const t = i / sr, ph = t % 0.5; buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 60 * ph) * Math.exp(-ph / 0.05) * 20000), 44 + i * 2); }
    await page.setInputFiles('#file-audio', { name: 'kicks.wav', mimeType: 'audio/wav', buffer: buf });
    await expect(page.locator('#btn-dance')).toBeEnabled({ timeout: 20_000 });

    await page.click('#btn-dance'); await page.click('#dance-go');
    await expect.poll(() => page.evaluate(() => (window as any).__app.layers.filter((l: any) => l.tl).length)).toBeGreaterThan(0);
    const p = await project(page);
    expect(p.audio).toMatchObject({ name: 'kicks.wav' });
    expect(p.layers.every((l: any) => Number.isFinite(l.x) && Number.isFinite(l.y))).toBe(true);

    const text = await saveViaButton(page);
    await page.click('#btn-new');
    await openViaInput(page, 'danse.maxernzt', text);
    const q = await project(page);
    expect(q.audio?.name).toBe('kicks.wav');
    expect(q.layers.map((l: any) => !!l.tl)).toEqual(p.layers.map((l: any) => !!l.tl));
    expect(errors).toEqual([]);
  });

  test('export : image, calques en .zip, vidéo', async ({ page }) => {
    const errors = await openApp(page, '?open=examples/ciel-de-nuit.maxernzt');
    await page.waitForFunction(() => (window as any).__app?.layers.length > 5);

    let dl = page.waitForEvent('download'); await page.click('#btn-export');
    let d = await dl; expect(d.suggestedFilename()).toMatch(/\.png$/);
    expect(readFileSync(await d.path()!).subarray(1, 4).toString()).toBe('PNG');

    dl = page.waitForEvent('download'); await page.click('#btn-export-layers');
    d = await dl; expect(d.suggestedFilename()).toMatch(/\.zip$/);
    expect(readFileSync(await d.path()!).subarray(0, 2).toString()).toBe('PK');

    await page.click('#btn-video');
    await page.fill('#vid-dur', '1 s'); await page.dispatchEvent('#vid-dur', 'input');
    dl = page.waitForEvent('download', { timeout: 80_000 }); await page.click('#vid-go');
    d = await dl; expect(d.suggestedFilename()).toMatch(/\.(mp4|webm)$/);
    expect(readFileSync(await d.path()!).length).toBeGreaterThan(2000);
    await expect(page.locator('#render-ov')).not.toHaveClass(/on/);
    expect(errors).toEqual([]);
  });
  test('ressources Pixi : supprimer un calque chiffonné détruit toutes ses textures', async ({ page }) => {
    const errors = await openApp(page);
    await addSquare(page, 'k', '#d33', 500, 500, 200);
    // chiffonnage de 0 à 1 en une seconde, via une timeline enregistrée puis rouverte
    const p = await project(page);
    p.layers[0].tl = { crumple: [{ t: 0, v: 0, e: 'smooth' }, { t: 1, v: 1, e: 'smooth' }] };
    await openViaInput(page, 'c.maxernzt', JSON.stringify(p));
    await page.click('#btn-play');
    await page.waitForTimeout(1800);                                   // la feuille est en boule : les textures de plis existent
    const created = await page.evaluate(() => {
      const l = (window as any).__app.layers[0]; (window as any).__ball = l.ball;
      return { frames: l.ball?.frames.length ?? 0, spr: !!l.ball?.spr, sprite: !!l.sprite.texture, base: l.sprite.texture.label };
    });
    expect(created.frames).toBeGreaterThan(5);
    await page.click('#btn-stop');
    await row(page, 'k').click();
    await page.click('#btn-del');
    expect(await page.evaluate(() => (window as any).__app.layers.length)).toBe(0);
    const left = await page.evaluate(() => {
      const b = (window as any).__ball;
      return { frames: b.frames.filter((t: any) => !t.destroyed).length, spr: !b.spr.texture?.destroyed && !b.spr.destroyed ? 1 : 0 };
    });
    expect(left.frames, 'textures de plis restées vivantes après la suppression').toBe(0);
    expect(errors).toEqual([]);
  });
});
