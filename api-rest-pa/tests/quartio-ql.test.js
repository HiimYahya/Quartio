const { QlLexer } = require('../src/lang/lexer');
const { parse }   = require('../src/lang/index');

describe('Quartio-QL - Lexer', () => {
  it('tokenise les mots-clés indépendamment de la casse', () => {
    const lex = QlLexer.tokenize('find annonces Where statut = "active"');
    expect(lex.errors).toHaveLength(0);
    const names = lex.tokens.map((t) => t.tokenType.name);
    expect(names).toEqual(['Find', 'Identifier', 'Where', 'Identifier', 'Eq', 'StringLiteral']);
  });

  it('distingue les opérateurs multi-caractères des opérateurs simples (>= avant >, != avant =)', () => {
    const lex = QlLexer.tokenize('points_solde >= 10 AND points_solde != 0 AND points_solde <= 100');
    expect(lex.errors).toHaveLength(0);
    const names = lex.tokens.map((t) => t.tokenType.name);
    expect(names).toContain('Gte');
    expect(names).toContain('Neq');
    expect(names).toContain('Lte');
    expect(names).not.toContain('Gt');
    expect(names).not.toContain('Eq');
  });

  it('ne tokenise pas un mot-clé comme préfixe d\'un identifiant (word boundary)', () => {
    // "FINDus" ne doit pas être lu comme Find + "us"
    const lex = QlLexer.tokenize('FINDus annonces');
    expect(lex.errors).toHaveLength(0);
    expect(lex.tokens[0].tokenType.name).toBe('Identifier');
    expect(lex.tokens[0].image).toBe('FINDus');
  });

  it('reconnaît ORDER BY comme un seul token malgré l\'espace', () => {
    const lex = QlLexer.tokenize('FIND annonces ORDER BY date_publication DESC');
    expect(lex.errors).toHaveLength(0);
    const names = lex.tokens.map((t) => t.tokenType.name);
    expect(names).toEqual(['Find', 'Identifier', 'OrderBy', 'Identifier', 'Desc']);
  });

  it('rejette un caractère inconnu', () => {
    const lex = QlLexer.tokenize('FIND annonces WHERE titre ~ "x"');
    expect(lex.errors.length).toBeGreaterThan(0);
  });

  it('ignore les espaces, tabulations et retours à la ligne (group: SKIPPED)', () => {
    const lex = QlLexer.tokenize('FIND   annonces\n\tWHERE statut = "active"');
    expect(lex.errors).toHaveLength(0);
    expect(lex.tokens.some((t) => t.tokenType.name === 'WhiteSpace')).toBe(false);
  });
});

describe('Quartio-QL - FIND', () => {
  it('FIND simple sans clause', () => {
    const ast = parse('FIND annonces');
    expect(ast).toEqual({ type: 'find', collection: 'annonces', filter: {}, sort: null, limit: 50 });
  });

  it('WHERE avec égalité (chaîne)', () => {
    const ast = parse('FIND annonces WHERE statut = "active"');
    expect(ast.filter).toEqual({ statut: 'active' });
  });

  it('WHERE avec opérateurs de comparaison numériques', () => {
    expect(parse('FIND annonces WHERE cout_points > 10').filter).toEqual({ cout_points: { $gt: 10 } });
    expect(parse('FIND annonces WHERE cout_points < 10').filter).toEqual({ cout_points: { $lt: 10 } });
    expect(parse('FIND annonces WHERE cout_points >= 10').filter).toEqual({ cout_points: { $gte: 10 } });
    expect(parse('FIND annonces WHERE cout_points <= 10').filter).toEqual({ cout_points: { $lte: 10 } });
    expect(parse('FIND annonces WHERE cout_points != 10').filter).toEqual({ cout_points: { $ne: 10 } });
  });

  it('WHERE avec CONTAINS -> $regex insensible à la casse', () => {
    const ast = parse('FIND annonces WHERE titre CONTAINS "jardin"');
    expect(ast.filter).toEqual({ titre: { $regex: 'jardin', $options: 'i' } });
  });

  it('WHERE avec IN -> $in', () => {
    const ast = parse('FIND annonces WHERE statut IN ("active", "inactive")');
    expect(ast.filter).toEqual({ statut: { $in: ['active', 'inactive'] } });
  });

  it('WHERE avec NOT IN -> $nin', () => {
    const ast = parse('FIND annonces WHERE statut NOT IN ("archivee")');
    expect(ast.filter).toEqual({ statut: { $nin: ['archivee'] } });
  });

  it('WHERE avec plusieurs conditions liées par AND', () => {
    const ast = parse('FIND annonces WHERE statut = "active" AND est_payant = true');
    expect(ast.filter).toEqual({ $and: [{ statut: 'active' }, { est_payant: true }] });
  });

  it('WHERE avec plusieurs conditions liées par OR', () => {
    const ast = parse('FIND annonces WHERE statut = "active" OR statut = "inactive"');
    expect(ast.filter).toEqual({ $or: [{ statut: 'active' }, { statut: 'inactive' }] });
  });

  it('WHERE mélange AND/OR : AND prioritaire, regroupé sous $or', () => {
    const ast = parse('FIND annonces WHERE statut = "active" AND cout_points > 0 OR statut = "inactive"');
    expect(ast.filter).toEqual({
      $or: [
        { $and: [{ statut: 'active' }, { cout_points: { $gt: 0 } }] },
        { statut: 'inactive' },
      ],
    });
  });

  it('valeur NULL et booléenne', () => {
    expect(parse('FIND annonces WHERE description = null').filter).toEqual({ description: null });
    expect(parse('FIND annonces WHERE est_payant = false').filter).toEqual({ est_payant: false });
  });

  it('ORDER BY avec direction ASC/DESC et défaut ASC', () => {
    expect(parse('FIND annonces ORDER BY date_publication DESC').sort).toEqual({ date_publication: -1 });
    expect(parse('FIND annonces ORDER BY date_publication ASC').sort).toEqual({ date_publication: 1 });
    expect(parse('FIND annonces ORDER BY date_publication').sort).toEqual({ date_publication: 1 });
  });

  it('LIMIT personnalisé et plafond de sécurité à 200', () => {
    expect(parse('FIND annonces LIMIT 5').limit).toBe(5);
    expect(parse('FIND annonces LIMIT 1000').limit).toBe(200);
  });

  it('combine WHERE, ORDER BY et LIMIT', () => {
    const ast = parse('FIND annonces WHERE statut = "active" ORDER BY cout_points DESC LIMIT 10');
    expect(ast).toEqual({
      type:       'find',
      collection: 'annonces',
      filter:     { statut: 'active' },
      sort:       { cout_points: -1 },
      limit:      10,
    });
  });
});

describe('Quartio-QL - COUNT', () => {
  it('COUNT sans clause', () => {
    expect(parse('COUNT annonces')).toEqual({ type: 'count', collection: 'annonces', filter: {} });
  });

  it('COUNT avec WHERE', () => {
    const ast = parse('COUNT incidents WHERE statut = "ouvert"');
    expect(ast).toEqual({ type: 'count', collection: 'incidents', filter: { statut: 'ouvert' } });
  });
});

describe('Quartio-QL - INSERT', () => {
  it('INSERT avec un document JSON simple', () => {
    const ast = parse('INSERT annonces { titre: "Test", cout_points: 5, est_payant: true }');
    expect(ast).toEqual({
      type:       'insert',
      collection: 'annonces',
      document:   { titre: 'Test', cout_points: 5, est_payant: true },
    });
  });

  it('INSERT avec un document JSON imbriqué', () => {
    const ast = parse('INSERT evenements { titre: "Fête", medias: { url: "x.png", type: "image" } }');
    expect(ast.document).toEqual({ titre: 'Fête', medias: { url: 'x.png', type: 'image' } });
  });

  it('INSERT accepte des clés entre guillemets', () => {
    const ast = parse('INSERT annonces { "titre": "Test" }');
    expect(ast.document).toEqual({ titre: 'Test' });
  });
});

describe('Quartio-QL - UPDATE', () => {
  it('UPDATE avec WHERE et SET', () => {
    const ast = parse('UPDATE annonces WHERE statut = "active" SET { statut: "inactive" }');
    expect(ast).toEqual({
      type:       'update',
      collection: 'annonces',
      filter:     { statut: 'active' },
      updates:    { statut: 'inactive' },
    });
  });

  it('UPDATE sans WHERE est une erreur de syntaxe (clause obligatoire)', () => {
    expect(() => parse('UPDATE annonces SET { statut: "inactive" }')).toThrow(/Erreur de syntaxe/);
  });
});

describe('Quartio-QL - DELETE', () => {
  it('DELETE avec WHERE', () => {
    const ast = parse('DELETE incidents WHERE statut = "ferme"');
    expect(ast).toEqual({ type: 'delete', collection: 'incidents', filter: { statut: 'ferme' } });
  });

  it('DELETE sans WHERE est une erreur de syntaxe (clause obligatoire)', () => {
    expect(() => parse('DELETE incidents')).toThrow(/Erreur de syntaxe/);
  });
});

describe('Quartio-QL - Erreurs', () => {
  it('rejette une requête vide', () => {
    expect(() => parse('')).toThrow();
  });

  it('rejette un mot-clé de requête inconnu', () => {
    expect(() => parse('SELECT annonces')).toThrow(/Erreur de syntaxe/);
  });

  it('rejette une chaîne non terminée (erreur de tokenisation)', () => {
    expect(() => parse('FIND annonces WHERE titre = "non fermé')).toThrow(/Erreur de tokenisation/);
  });

  it('rejette un opérateur de comparaison invalide', () => {
    expect(() => parse('FIND annonces WHERE titre ~= "x"')).toThrow();
  });
});
