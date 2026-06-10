const { parse }    = require('../lang/index');
const Annonce      = require('../models/mongo/annonce.model');
const Evenement    = require('../models/mongo/evenement.model');
const Incident     = require('../models/mongo/incident.model');
const Conversation = require('../models/mongo/conversation.model');
const Message      = require('../models/mongo/message.model');

const COLLECTIONS = {
  annonces:      Annonce,
  annonce:       Annonce,
  evenements:    Evenement,
  evenement:     Evenement,
  incidents:     Incident,
  incident:      Incident,
  conversations: Conversation,
  conversation:  Conversation,
  messages:      Message,
  message:       Message,
};

// Opérations autorisées en lecture pour les modérateurs
const READ_ONLY_OPS = ['find', 'count'];

// POST /api/query
exports.execute = async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Paramètre "query" manquant' });
    }

    // Parse + transpile
    let ast;
    try {
      ast = parse(query.trim());
    } catch (parseErr) {
      return res.status(400).json({ error: parseErr.message, type: 'parse_error' });
    }

    // Vérification de la collection
    const model = COLLECTIONS[ast.collection.toLowerCase()];
    if (!model) {
      return res.status(400).json({
        error: `Collection inconnue : "${ast.collection}". Collections disponibles : ${Object.keys(COLLECTIONS).filter((k, i, arr) => arr.indexOf(k) === i).join(', ')}`,
      });
    }

    // Les modérateurs ne peuvent qu'en lecture
    if (req.user.role === 'moderateur' && !READ_ONLY_OPS.includes(ast.type)) {
      return res.status(403).json({ error: 'Les modérateurs n\'ont accès qu\'aux opérations FIND et COUNT' });
    }

    const start = Date.now();
    let result;
    let affected = null;

    switch (ast.type) {
      case 'find': {
        const q = model.find(ast.filter);
        if (ast.sort)  q.sort(ast.sort);
        if (ast.limit) q.limit(ast.limit);
        result = await q.lean();
        break;
      }

      case 'count': {
        result = await model.countDocuments(ast.filter);
        break;
      }

      case 'insert': {
        const doc = await model.create(ast.document);
        result   = doc.toObject();
        affected = 1;
        break;
      }

      case 'update': {
        if (!ast.filter || Object.keys(ast.filter).length === 0) {
          return res.status(400).json({ error: 'UPDATE sans clause WHERE est interdit' });
        }
        const upRes = await model.updateMany(ast.filter, { $set: ast.updates });
        affected    = upRes.modifiedCount;
        result      = { matched: upRes.matchedCount, modified: upRes.modifiedCount };
        break;
      }

      case 'delete': {
        if (!ast.filter || Object.keys(ast.filter).length === 0) {
          return res.status(400).json({ error: 'DELETE sans clause WHERE est interdit' });
        }
        const delRes = await model.deleteMany(ast.filter);
        affected     = delRes.deletedCount;
        result       = { deleted: delRes.deletedCount };
        break;
      }

      default:
        return res.status(400).json({ error: `Opération non supportée : ${ast.type}` });
    }

    res.json({
      type:        ast.type,
      collection:  ast.collection,
      filter:      ast.filter ?? null,
      result,
      affected,
      duration_ms: Date.now() - start,
      ast,
    });
  } catch (err) { next(err); }
};
