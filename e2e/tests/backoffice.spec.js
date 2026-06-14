const { test, expect } = require('@playwright/test');
const db  = require('../helpers/db');
const api = require('../helpers/api');

// Pose un point sur la carte (un clic) à la position relative (rx, ry) dans la bounding box
async function clickMap(page, box, rx, ry, opts) {
  await page.mouse.click(box.x + box.width * rx, box.y + box.height * ry, opts);
}

test.describe('Backoffice - administration', () => {
  let admin;

  test.beforeAll(async () => {
    admin = await api.registerAndVerify({ nom: 'Admin', prenom: 'E2E', role: 'admin' });

    // Nettoie les quartiers créés par d'éventuelles exécutions précédentes du test,
    // pour que le coin de carte utilisé pour dessiner la nouvelle zone reste libre.
    const body = await fetch(`${api.API_URL}/quartiers?limit=100`).then((r) => r.json());
    const previous = (body.data ?? []).filter((q) => q.nom.startsWith('Quartier E2E '));
    for (const q of previous) {
      await fetch(`${api.API_URL}/quartiers/${q.id_quartier}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${admin.access_token}` },
      });
    }
  });

  test('connexion admin', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Connexion administrateur' })).toBeVisible();

    await page.getByPlaceholder('admin@quartio.fr').fill(admin.email);
    await page.getByPlaceholder('--------').fill(admin.mot_de_passe);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('créer un quartier en dessinant une zone sur la carte', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('admin@quartio.fr').fill(admin.email);
    await page.getByPlaceholder('--------').fill(admin.mot_de_passe);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/quartiers');
    await page.getByRole('button', { name: '+ Nouveau quartier' }).click();

    const nom = `Quartier E2E ${Date.now()}`;
    await page.getByPlaceholder('Ex: Centre-Ville').fill(nom);

    await page.getByRole('button', { name: /Dessiner la zone sur la carte/ }).click();
    await expect(page.getByText('Mode dessin actif')).toBeVisible();

    // Dessine un polygone dans un coin de la carte, loin des zones déjà définies
    const map = page.locator('.leaflet-container');
    await map.waitFor();
    const box = await map.boundingBox();
    await clickMap(page, box, 0.85, 0.05);
    await clickMap(page, box, 0.97, 0.05);
    await clickMap(page, box, 0.97, 0.17);
    await clickMap(page, box, 0.85, 0.17, { clickCount: 2 }); // double-clic ferme le polygone

    await expect(page.getByText('Zone définie - aucun chevauchement')).toBeVisible();

    await page.getByRole('button', { name: 'Créer' }).click();

    await expect(page.getByRole('button', { name: '+ Nouveau quartier' })).toBeVisible();
    await expect(page.getByText(nom)).toBeVisible();
  });

  test('gérer les incidents : création et changement de statut', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('admin@quartio.fr').fill(admin.email);
    await page.getByPlaceholder('--------').fill(admin.mot_de_passe);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/incidents');
    await page.getByRole('button', { name: '+ Nouvel incident' }).click();

    const titre = `Incident E2E ${Date.now()}`;
    const modal = page.locator('.fixed.inset-0');
    await modal.locator('input').first().fill(titre);
    await modal.locator('textarea').fill('Incident créé par le test E2E.');
    await modal.getByPlaceholder('voirie, éclairage...').fill('voirie');
    await modal.locator('select').selectOption('haute');
    await modal.getByRole('button', { name: 'Créer' }).click();

    const row = page.locator('div.rounded-xl.shadow-sm').filter({ has: page.getByRole('heading', { name: titre }) });
    await expect(row).toBeVisible();

    await row.locator('select').selectOption('en_cours');
    await expect(row.locator('select')).toHaveValue('en_cours');
  });
});

test.afterAll(async () => {
  await db.close();
});
