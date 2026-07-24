const { driver } = require('../config/neo4j');

async function getUserQuartierIds(uid) {
  const session = driver.session();
  try {
    const result = await session.run(
      'MATCH (u:Utilisateur {pg_id: $uid})-[:HABITE]->(q:Quartier) RETURN q.pg_id AS id',
      { uid }
    );
    return result.records.map((r) => {
      const v = r.get('id');
      return v && typeof v.toNumber === 'function' ? v.toNumber() : parseInt(v);
    }).filter(Number.isFinite);
  } finally {
    await session.close();
  }
}

// Ids PG des habitants d'un quartier (relations HABITE)
async function getQuartierHabitantIds(qid) {
  const session = driver.session();
  try {
    const result = await session.run(
      'MATCH (u:Utilisateur)-[:HABITE]->(q:Quartier {pg_id: $qid}) RETURN u.pg_id AS id',
      { qid }
    );
    return result.records.map((r) => {
      const v = r.get('id');
      return v && typeof v.toNumber === 'function' ? v.toNumber() : parseInt(v);
    }).filter(Number.isFinite);
  } finally {
    await session.close();
  }
}

const isPrivileged = (user) => user?.role === 'admin' || user?.role === 'moderateur';

module.exports = { getUserQuartierIds, getQuartierHabitantIds, isPrivileged };
