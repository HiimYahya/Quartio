
function parseValue(node) {
  if (!node || !node.children) return null;
  const ch = node.children;

  if (ch.StringLiteral?.[0]) {
    const raw = ch.StringLiteral[0].image;
    return raw.slice(1, -1);
  }
  if (ch.NumberLiteral?.[0]) {
    return parseFloat(ch.NumberLiteral[0].image);
  }
  if (ch.BoolLiteral?.[0]) {
    return ch.BoolLiteral[0].image.toLowerCase() === 'true';
  }
  if (ch.NullLiteral?.[0]) {
    return null;
  }
  if (ch.Identifier?.[0]) {
    return ch.Identifier[0].image;
  }
  return null;
}

function parseCondition(node) {
  const ch   = node.children;
  const field = ch.field?.[0]?.image ?? ch.Identifier?.[0]?.image;

  if (ch.Contains) {
    const val = parseValue(ch.value?.[0]);
    return { [field]: { $regex: String(val), $options: 'i' } };
  }

  if (ch.In) {
    const vals = (ch.value ?? []).map(parseValue);
    return ch.Not
      ? { [field]: { $nin: vals } }
      : { [field]: { $in: vals } };
  }

  const opToken = ch.comparisonOp?.[0]?.children;
  const val     = parseValue(ch.value?.[0]);

  if (opToken?.Eq)  return { [field]: val };
  if (opToken?.Neq) return { [field]: { $ne: val } };
  if (opToken?.Gt)  return { [field]: { $gt: val } };
  if (opToken?.Lt)  return { [field]: { $lt: val } };
  if (opToken?.Gte) return { [field]: { $gte: val } };
  if (opToken?.Lte) return { [field]: { $lte: val } };

  return { [field]: val };
}

function parseWhereClause(node) {
  if (!node) return {};
  const ch = node.children;
  const conditions = ch.condition ?? [];
  const logicalOps = [...(ch.And ?? []), ...(ch.Or ?? [])].sort((a, b) => a.startOffset - b.startOffset);

  if (conditions.length === 0) return {};
  if (conditions.length === 1) return parseCondition(conditions[0]);

  const parts = [parseCondition(conditions[0])];
  for (let i = 0; i < logicalOps.length; i++) {
    const op   = logicalOps[i].tokenType.name;
    const cond = parseCondition(conditions[i + 1]);
    parts.push({ op, cond });
  }

  let andGroup = [parts[0]];
  const orGroups = [];

  for (let i = 1; i < parts.length; i++) {
    const { op, cond } = parts[i];
    if (op === 'And') {
      andGroup.push(cond);
    } else {
      orGroups.push(andGroup.length === 1 ? andGroup[0] : { $and: andGroup });
      andGroup = [cond];
    }
  }
  orGroups.push(andGroup.length === 1 ? andGroup[0] : { $and: andGroup });

  return orGroups.length === 1 ? orGroups[0] : { $or: orGroups };
}

function parseJsonObject(node) {
  if (!node) return {};
  const ch  = node.children;
  const obj = {};
  for (const pair of (ch.jsonPair ?? [])) {
    const pCh = pair.children;
    const rawKey = pCh.key?.[0]?.image ?? pCh.StringLiteral?.[0]?.image ?? pCh.Identifier?.[0]?.image ?? '';
    const key    = rawKey.startsWith('"') || rawKey.startsWith("'") ? rawKey.slice(1, -1) : rawKey;
    const valNode = pCh.val?.[0] ?? pCh.jsonValue?.[0];
    obj[key] = parseJsonValue(valNode);
  }
  return obj;
}

function parseJsonValue(node) {
  if (!node) return null;
  const ch = node.children;
  if (ch.StringLiteral?.[0]) return ch.StringLiteral[0].image.slice(1, -1);
  if (ch.NumberLiteral?.[0]) return parseFloat(ch.NumberLiteral[0].image);
  if (ch.BoolLiteral?.[0])   return ch.BoolLiteral[0].image.toLowerCase() === 'true';
  if (ch.NullLiteral?.[0])   return null;
  if (ch.jsonObject?.[0])    return parseJsonObject(ch.jsonObject[0]);
  return null;
}

function transpile(cst) {
  const root = cst.children;

  if (root.findQuery) {
    const q  = root.findQuery[0].children;
    const wh = q.whereClause?.[0];
    const ob = q.orderByClause?.[0];
    const lm = q.limitClause?.[0];

    let sort  = null;
    let limit = 50;

    if (ob) {
      const field = ob.children.field?.[0]?.image ?? ob.children.Identifier?.[0]?.image;
      const dir   = ob.children.Desc ? -1 : 1;
      sort = { [field]: dir };
    }
    if (lm) {
      const n = parseInt(lm.children.n?.[0]?.image ?? lm.children.NumberLiteral?.[0]?.image ?? '50');
      limit = Math.min(n, 200);
    }

    return {
      type:       'find',
      collection: q.collection[0].image,
      filter:     parseWhereClause(wh),
      sort,
      limit,
    };
  }

  if (root.countQuery) {
    const q  = root.countQuery[0].children;
    const wh = q.whereClause?.[0];
    return {
      type:       'count',
      collection: q.collection[0].image,
      filter:     parseWhereClause(wh),
    };
  }

  if (root.insertQuery) {
    const q = root.insertQuery[0].children;
    return {
      type:       'insert',
      collection: q.collection[0].image,
      document:   parseJsonObject(q.document?.[0]),
    };
  }

  if (root.updateQuery) {
    const q  = root.updateQuery[0].children;
    const wh = q.whereClause?.[0];
    return {
      type:       'update',
      collection: q.collection[0].image,
      filter:     parseWhereClause(wh),
      updates:    parseJsonObject(q.updates?.[0]),
    };
  }

  if (root.deleteQuery) {
    const q  = root.deleteQuery[0].children;
    const wh = q.whereClause?.[0];
    return {
      type:       'delete',
      collection: q.collection[0].image,
      filter:     parseWhereClause(wh),
    };
  }

  throw new Error('Type de requête non reconnu');
}

module.exports = { transpile };
