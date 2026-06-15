# TODO Corrections — éléments à fournir par Swann

> Liste des identifiants/clés externes actuellement **vides** dans
> `api-rest-pa/.env`, qui bloquent certaines fonctionnalités. Tout le reste de
> l'application fonctionne sans ces valeurs (mode test activé en attendant, voir
> §1).

---

## 1. SMTP (envoi d'emails — vérification de compte, reset mot de passe, etc.)

**Fichier** : `api-rest-pa/.env`
```
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=        ← à compléter
SMTP_PASS=        ← à compléter
MAIL_FROM=Quartio <noreply@quartio.fr>
```

**À faire** :
1. Créer un compte gratuit sur https://mailtrap.io (ou utiliser un vrai
   fournisseur SMTP en prod : SendGrid, Brevo/Sendinblue, etc.).
2. Inbox → "SMTP Settings" → copier `Username` et `Password` dans `SMTP_USER` /
   `SMTP_PASS`.
3. Une fois renseigné, **repasser le flag temporaire à `false`** :
   ```
   SKIP_EMAIL_VERIFICATION=false
   ```
   (ce flag a été ajouté le 2026-06-13 pour pouvoir tester l'app sans SMTP : tant
   qu'il est à `true`, les comptes sont vérifiés automatiquement à l'inscription,
   sans code OTP — voir `GUIDE_TESTS_MANUELS.md` §0 et §1.1).
4. `docker compose restart api` (ou rebuild si le code a changé).
5. Tester : `/register` → un email doit arriver dans l'inbox Mailtrap, avec le
   code OTP → suivre `GUIDE_TESTS_MANUELS.md` §1.1.c.

**Fonctionnalités concernées** :
- Vérification d'email à l'inscription (`/verify-email`)
- Renvoi de code (`/verify-email` → "Renvoyer un nouveau code")
- Mot de passe oublié (`/forgot-password` → email avec lien de reset)
- Email de bienvenue après vérification
- Re-vérification après changement d'email (`/profil` → Sécurité)

---

## 2. Cloudinary (upload d'images)

**Fichier** : `api-rest-pa/.env`
```
CLOUDINARY_CLOUD_NAME=    ← à compléter
CLOUDINARY_API_KEY=       ← à compléter
CLOUDINARY_API_SECRET=    ← à compléter
```

**À faire** :
1. Créer un compte gratuit sur https://cloudinary.com.
2. Dashboard → copier `Cloud name`, `API Key`, `API Secret` dans les 3 variables
   ci-dessus.
3. `docker compose restart api`.
4. Tester : dans une conversation (`/messages/:id`), envoyer une image via le
   bouton 📎 → l'image doit s'afficher dans la conversation (voir
   `GUIDE_TESTS_MANUELS.md` §6.3).

**Fonctionnalités concernées** :
- Envoi d'images dans la messagerie (`POST /api/conversations/:id/messages/media`)
- Sans ces clés : l'upload échoue (erreur Cloudinary "Invalid cloud_name" ou
  équivalent), tout le reste de la messagerie (texte, temps réel, signalement)
  fonctionne normalement.

---

## 3. (Bonus / avant mise en prod) JWT_SECRET

**Fichier** : `api-rest-pa/.env`
```
JWT_SECRET=supersecretkey_changeme_in_prod
```
Valeur de développement par défaut — à remplacer par une chaîne aléatoire longue
(ex. `openssl rand -hex 32`) avant tout déploiement public. Pas bloquant pour les
tests en local.

---

## Récapitulatif

| Variable | Statut | Bloque |
|---|---|---|
| `SMTP_USER` / `SMTP_PASS` | ⬜ vide | Emails (vérification, reset, etc.) — contourné par `SKIP_EMAIL_VERIFICATION=true` |
| `SKIP_EMAIL_VERIFICATION` | ✅ `true` (temporaire) | À repasser à `false` une fois SMTP configuré |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | ⬜ vide | Envoi d'images en messagerie |
| `JWT_SECRET` | ⚠️ valeur par défaut | Sécurité en production uniquement |
