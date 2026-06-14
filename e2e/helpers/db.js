const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

// Le port 5432 du host est occupé par un PostgreSQL natif (hors docker), donc
// le conteneur `quartio_db` n'est pas atteignable directement depuis le host
// via le port mappé. On passe par `docker exec ... psql` pour lire/écrire la
// base `pa_db` de la stack docker-compose (utilisé uniquement pour préparer
// des données - récupérer un code OTP, passer un compte en admin - que l'UI
// ne peut pas fournir sans envoi d'email réel).
async function psql(sql) {
  const { stdout } = await execFileAsync('docker', [
    'exec', 'quartio_db', 'psql', '-U', 'postgres', '-d', 'pa_db', '-t', '-A', '-c', sql,
  ]);
  return stdout.trim();
}

function escape(value) {
  return value.replace(/'/g, "''");
}

async function getVerificationCode(email) {
  const out = await psql(
    `SELECT ev.code FROM email_verification ev
     JOIN utilisateur u ON u.id_utilisateur = ev.id_utilisateur
     WHERE u.email = '${escape(email)}'
     ORDER BY ev.created_at DESC LIMIT 1;`
  );
  return out || null;
}

async function setRole(email, role) {
  await psql(`UPDATE utilisateur SET role = '${escape(role)}' WHERE email = '${escape(email)}';`);
}

async function close() {}

module.exports = { getVerificationCode, setRole, close };
