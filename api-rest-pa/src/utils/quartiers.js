const { driver } = require('../config/neo4j');

// Retourne les pg_id des quartiers où l'utilisateur HABITE (Neo4j).
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

// Un admin / modérateur voit tout ; un habitant est restreint à son quartier.
const isPrivileged = (user) => user?.role === 'admin' || user?.role === 'moderateur';

module.exports = { getUserQuartierIds, isPrivileged };
