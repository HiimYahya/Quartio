const nodemailer = require('nodemailer');
const logger     = require('./logger');

// ─── Transport ────────────────────────────────────────────────────────────────
// En dev  : Mailtrap (attrape les emails sans les envoyer pour de vrai)
// En prod : SMTP réel (SendGrid, SES, Gmail SMTP...)
// Variables d'env requises :
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
const transport = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'sandbox.smtp.mailtrap.io',
  port:   parseInt(process.env.SMTP_PORT || '2525'),
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

const FROM = process.env.MAIL_FROM || 'Quartio <noreply@quartio.fr>';

// ─── Envoi générique ──────────────────────────────────────────────────────────
async function sendMail({ to, subject, html, text }) {
  try {
    const info = await transport.sendMail({ from: FROM, to, subject, html, text });
    logger.info(`[mailer] Email envoyé à ${to} - messageId: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error(`[mailer] Échec envoi à ${to}: ${err.message}`);
    throw err;
  }
}

// ─── Templates ────────────────────────────────────────────────────────────────

/**
 * Email de vérification à l'inscription.
 * @param {string} to    - adresse email du destinataire
 * @param {string} prenom
 * @param {string} code  - OTP 6 chiffres
 */
async function sendVerificationEmail(to, prenom, code) {
  return sendMail({
    to,
    subject: 'Quartio - Vérifiez votre adresse email',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
        <div style="background:#1a4a3a;padding:24px;text-align:center;border-radius:12px 12px 0 0">
          <h1 style="color:#34d399;margin:0;font-size:28px">Quartio</h1>
          <p style="color:rgba(255,255,255,0.7);margin:4px 0 0">Votre quartier, connecté</p>
        </div>
        <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <h2 style="color:#1a4a3a;margin-top:0">Bonjour ${prenom}</h2>
          <p style="color:#4b5563">Merci de vous être inscrit sur Quartio ! Pour activer votre compte, entrez le code ci-dessous dans l'application.</p>
          <div style="background:#f0faf5;border:2px solid #34d399;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
            <p style="margin:0 0 8px;color:#6b7280;font-size:14px">Votre code de vérification</p>
            <p style="margin:0;font-size:40px;font-weight:bold;letter-spacing:10px;color:#1a4a3a">${code}</p>
          </div>
          <p style="color:#6b7280;font-size:13px">Ce code est valable <strong>15 minutes</strong>.</p>
          <p style="color:#6b7280;font-size:13px">Si vous n'avez pas créé de compte, ignorez cet email.</p>
        </div>
      </div>
    `,
    text: `Bonjour ${prenom},\n\nVotre code de vérification Quartio : ${code}\n\nCe code expire dans 15 minutes.\n\nL'équipe Quartio`,
  });
}

/**
 * Email de réinitialisation du mot de passe.
 * @param {string} to
 * @param {string} prenom
 * @param {string} resetUrl - URL complète avec le token
 */
async function sendResetPasswordEmail(to, prenom, resetUrl) {
  return sendMail({
    to,
    subject: 'Quartio - Réinitialisation de votre mot de passe',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
        <div style="background:#1a4a3a;padding:24px;text-align:center;border-radius:12px 12px 0 0">
          <h1 style="color:#34d399;margin:0;font-size:28px">Quartio</h1>
        </div>
        <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <h2 style="color:#1a4a3a;margin-top:0">Réinitialisation du mot de passe</h2>
          <p style="color:#4b5563">Bonjour ${prenom},</p>
          <p style="color:#4b5563">Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${resetUrl}" style="background:#1a4a3a;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">
              Réinitialiser mon mot de passe
            </a>
          </div>
          <p style="color:#6b7280;font-size:13px">Ce lien expire dans <strong>1 heure</strong>.</p>
          <p style="color:#6b7280;font-size:13px">Si vous n'avez pas demandé de réinitialisation, ignorez cet email - votre compte reste sécurisé.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
          <p style="color:#9ca3af;font-size:12px">Lien alternatif : <a href="${resetUrl}" style="color:#2d7a5f">${resetUrl}</a></p>
        </div>
      </div>
    `,
    text: `Bonjour ${prenom},\n\nRéinitialisez votre mot de passe Quartio en cliquant sur ce lien (valable 1h) :\n${resetUrl}\n\nSi vous n'avez pas fait cette demande, ignorez cet email.\n\nL'équipe Quartio`,
  });
}

/**
 * Email de bienvenue après vérification réussie.
 */
async function sendWelcomeEmail(to, prenom) {
  return sendMail({
    to,
    subject: 'Quartio - Bienvenue dans votre quartier connecté !',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
        <div style="background:#1a4a3a;padding:24px;text-align:center;border-radius:12px 12px 0 0">
          <h1 style="color:#34d399;margin:0;font-size:28px">Quartio</h1>
        </div>
        <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <h2 style="color:#1a4a3a;margin-top:0">Bienvenue, ${prenom} !</h2>
          <p style="color:#4b5563">Votre compte est activé. Vous pouvez maintenant :</p>
          <ul style="color:#4b5563;line-height:2">
            <li>Publier et consulter des annonces de services</li>
            <li>Participer aux événements de votre quartier</li>
            <li>Échanger avec vos voisins</li>
            <li>Voter sur les décisions collectives</li>
          </ul>
          <div style="text-align:center;margin:24px 0">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="background:#1a4a3a;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold">
              Accéder à Quartio
            </a>
          </div>
        </div>
      </div>
    `,
    text: `Bienvenue sur Quartio, ${prenom} ! Votre compte est activé. Connectez-vous sur ${process.env.FRONTEND_URL || 'http://localhost:5173'}`,
  });
}

/**
 * Notification quand un contrat attend la signature de l'utilisateur.
 */
async function sendContratSignatureEmail(to, prenom, contratId, serviceNom) {
  const url = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/contrats/${contratId}`;
  return sendMail({
    to,
    subject: `Quartio - Votre signature est requise pour "${serviceNom}"`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
        <div style="background:#1a4a3a;padding:24px;text-align:center;border-radius:12px 12px 0 0">
          <h1 style="color:#34d399;margin:0;font-size:28px">Quartio</h1>
        </div>
        <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <h2 style="color:#1a4a3a;margin-top:0">Signature requise</h2>
          <p style="color:#4b5563">Bonjour ${prenom},</p>
          <p style="color:#4b5563">Un contrat pour le service <strong>"${serviceNom}"</strong> attend votre signature.</p>
          <div style="text-align:center;margin:24px 0">
            <a href="${url}" style="background:#1a4a3a;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold">
              Signer le contrat #${contratId}
            </a>
          </div>
        </div>
      </div>
    `,
    text: `Bonjour ${prenom},\n\nUn contrat pour "${serviceNom}" attend votre signature.\nSignez-le ici : ${url}`,
  });
}

module.exports = {
  sendMail,
  sendVerificationEmail,
  sendResetPasswordEmail,
  sendWelcomeEmail,
  sendContratSignatureEmail,
};
