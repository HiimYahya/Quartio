/**
 * Extrait et normalise les paramètres de pagination depuis req.query
 * @param {object} query - req.query
 * @returns {{ page, limit, skip }}
 */
const getPagination = (query) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Formate la réponse paginée standard
 */
const paginate = (data, total, page, limit) => ({
  data,
  pagination: {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  },
});

module.exports = { getPagination, paginate };
