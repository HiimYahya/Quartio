const { test, expect } = require('@playwright/test');
const db  = require('../helpers/db');
const api = require('../helpers/api');

test.afterAll(async () => {
  await db.close();
});

// Dessine un trait simple sur le canvas de signature (react-signature-canvas)
async function drawSignature(page) {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 40, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.2);
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.8);
  await page.mouse.move(box.x + box.width - 40, box.y + box.height / 2);
  await page.mouse.up();
}

test.describe('Frontoffice - parcours utilisateur', () => {
  test('inscription, vérification email, connexion et publication d\'une annonce', async ({ page }) => {
    const email = api.uniqueEmail('e2e_front');
    const password = 'Password123';

    await test.step('inscription', async () => {
      await page.goto('/register');
      await page.locator('input[name="prenom"]').fill('Alice');
      await page.locator('input[name="nom"]').fill('Dupont');
      await page.locator('input[name="email"]').fill(email);
      await page.locator('input[name="mot_de_passe"]').fill(password);
      await page.getByRole('button', { name: "S'inscrire" }).click();
      await expect(page).toHaveURL(new RegExp(`/verify-email\\?email=${encodeURIComponent(email)}`));
    });

    await test.step('vérification de l\'email (code OTP lu en base)', async () => {
      let code;
      await expect(async () => {
        code = await db.getVerificationCode(email);
        expect(code).toBeTruthy();
      }).toPass({ timeout: 10000 });

      const digitInputs = page.locator('input');
      for (let i = 0; i < 6; i++) {
        await digitInputs.nth(i).fill(code[i]);
      }
      await page.getByRole('button', { name: /Vérifier/ }).click();
      await expect(page).toHaveURL(/\/login\?verified=1/, { timeout: 10000 });
    });

    await test.step('connexion', async () => {
      await page.locator('input[name="email"]').fill(email);
      await page.locator('input[name="mot_de_passe"]').fill(password);
      await page.getByRole('button', { name: 'Connexion' }).click();
      await expect(page).toHaveURL(/\/dashboard/);
    });

    await test.step('publication d\'une annonce', async () => {
      await page.goto('/annonces');
      await page.getByRole('button', { name: '+ Nouvelle annonce' }).click();

      const titre = `Cours de guitare E2E ${Date.now()}`;
      await page.getByPlaceholder('Ex: Cours de guitare, Garde de chat...').fill(titre);
      await page.getByPlaceholder('Décrivez votre service...').fill('Annonce créée par le test E2E.');
      await page.locator('select').nth(1).selectOption({ index: 1 }); // premier quartier disponible (select "Quartier *")
      await page.getByRole('button', { name: 'Publier' }).click();

      // Le formulaire se referme et l'annonce apparaît dans la liste
      await expect(page.getByRole('button', { name: '+ Nouvelle annonce' })).toBeVisible();
      await expect(page.getByText(titre)).toBeVisible();
    });
  });

  test('accepter un service payant et signer un contrat (double signature)', async ({ page, browser }) => {
    test.setTimeout(120000);

    const COUT = 20;
    let vendeur, acheteur, annonceId, contratId;

    await test.step('préparation des comptes et de l\'annonce payante (via API)', async () => {
      vendeur  = await api.registerAndVerify({ nom: 'Vendeur',  prenom: 'E2E' });
      acheteur = await api.registerAndVerify({ nom: 'Acheteur', prenom: 'E2E' });
      const id_quartier = await api.getFirstQuartierId();

      const annonce = await api.createAnnonce(vendeur.access_token, {
        titre: `Service payant E2E ${Date.now()}`,
        description: 'Service de test E2E',
        type: 'service',
        categorie: 'bricolage',
        est_payant: true,
        cout_points: COUT,
        id_quartier,
      });
      annonceId = annonce._id;
    });

    await test.step('connexion de l\'acheteur et acceptation du service', async () => {
      await page.goto('/login');
      await page.locator('input[name="email"]').fill(acheteur.email);
      await page.locator('input[name="mot_de_passe"]').fill(acheteur.mot_de_passe);
      await page.getByRole('button', { name: 'Connexion' }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      await page.goto(`/annonces/${annonceId}`);
      await page.getByRole('button', { name: new RegExp(`Accepter ce service \\(${COUT} pts\\)`) }).click();
      await expect(page).toHaveURL(/\/contrats\/[a-f0-9-]+/);
      contratId = page.url().split('/contrats/')[1];
    });

    await test.step('l\'acheteur signe le contrat', async () => {
      await page.getByRole('button', { name: 'Continuer ->' }).click();
      await page.getByRole('button', { name: /Passer cette étape ->/ }).click();
      await drawSignature(page);
      await page.getByRole('button', { name: 'Signer le contrat' }).click();
      await expect(page.getByText(/Vous avez signé/)).toBeVisible({ timeout: 15000 });
    });

    await test.step('le vendeur se connecte et signe à son tour (finalisation)', async () => {
      const vendeurContext = await browser.newContext();
      const vendeurPage = await vendeurContext.newPage();

      await vendeurPage.goto('/login');
      await vendeurPage.locator('input[name="email"]').fill(vendeur.email);
      await vendeurPage.locator('input[name="mot_de_passe"]').fill(vendeur.mot_de_passe);
      await vendeurPage.getByRole('button', { name: 'Connexion' }).click();
      await expect(vendeurPage).toHaveURL(/\/dashboard/);

      await vendeurPage.goto(`/contrats/${contratId}`);
      await vendeurPage.getByRole('button', { name: 'Continuer ->' }).click();
      await vendeurPage.getByRole('button', { name: /Passer cette étape ->/ }).click();
      await drawSignature(vendeurPage);
      await vendeurPage.getByRole('button', { name: 'Signer le contrat' }).click();

      await expect(vendeurPage.getByText(/Contrat finalisé/)).toBeVisible({ timeout: 15000 });
      await expect(vendeurPage.getByText(`${COUT} points transférés`)).toBeVisible();

      await vendeurContext.close();
    });
  });
});
