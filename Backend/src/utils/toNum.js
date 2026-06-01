// Neo4j driver v5 retourne parfois des entiers natifs JS (pas des neo4j.Integer)
// Cette fonction gère les deux cas
const toNum = (val) => {
  if (val === null || val === undefined) return null
  if (typeof val.toNumber === 'function') return val.toNumber()
  return Number(val)
}

module.exports = toNum
