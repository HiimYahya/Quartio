const { createToken, Lexer } = require('chevrotain');

const Find     = createToken({ name: 'Find',     pattern: /FIND(?![a-zA-Z0-9_])/i });
const Insert   = createToken({ name: 'Insert',   pattern: /INSERT(?![a-zA-Z0-9_])/i });
const Update   = createToken({ name: 'Update',   pattern: /UPDATE(?![a-zA-Z0-9_])/i });
const Delete   = createToken({ name: 'Delete',   pattern: /DELETE(?![a-zA-Z0-9_])/i });
const Count    = createToken({ name: 'Count',    pattern: /COUNT(?![a-zA-Z0-9_])/i });
const Where    = createToken({ name: 'Where',    pattern: /WHERE(?![a-zA-Z0-9_])/i });
const Set      = createToken({ name: 'Set',      pattern: /SET(?![a-zA-Z0-9_])/i });
const Limit    = createToken({ name: 'Limit',    pattern: /LIMIT(?![a-zA-Z0-9_])/i });
const OrderBy  = createToken({ name: 'OrderBy',  pattern: /ORDER\s+BY(?![a-zA-Z0-9_])/i });
const Asc      = createToken({ name: 'Asc',      pattern: /ASC(?![a-zA-Z0-9_])/i });
const Desc     = createToken({ name: 'Desc',     pattern: /DESC(?![a-zA-Z0-9_])/i });
const And      = createToken({ name: 'And',      pattern: /AND(?![a-zA-Z0-9_])/i });
const Or       = createToken({ name: 'Or',       pattern: /OR(?![a-zA-Z0-9_])/i });
const In       = createToken({ name: 'In',       pattern: /IN(?![a-zA-Z0-9_])/i });
const Contains = createToken({ name: 'Contains', pattern: /CONTAINS(?![a-zA-Z0-9_])/i });
const Not      = createToken({ name: 'Not',      pattern: /NOT(?![a-zA-Z0-9_])/i });

const Neq = createToken({ name: 'Neq', pattern: /!=/ });
const Gte = createToken({ name: 'Gte', pattern: />=/ });
const Lte = createToken({ name: 'Lte', pattern: /<=/ });
const Gt  = createToken({ name: 'Gt',  pattern: />/ });
const Lt  = createToken({ name: 'Lt',  pattern: /</ });
const Eq  = createToken({ name: 'Eq',  pattern: /=/ });

const StringLiteral = createToken({
  name: 'StringLiteral',
  pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/,
});

const NumberLiteral = createToken({
  name: 'NumberLiteral',
  pattern: /-?(?:0|[1-9]\d*)(?:\.\d+)?/,
});

const BoolLiteral = createToken({
  name: 'BoolLiteral',
  pattern: /true|false/i,
});

const NullLiteral = createToken({
  name: 'NullLiteral',
  pattern: /null/i,
});

const Identifier = createToken({
  name: 'Identifier',
  pattern: /[a-zA-Z_][a-zA-Z0-9_.]*/,
});

const LCurly  = createToken({ name: 'LCurly',  pattern: /{/ });
const RCurly  = createToken({ name: 'RCurly',  pattern: /}/ });
const LParen  = createToken({ name: 'LParen',  pattern: /\(/ });
const RParen  = createToken({ name: 'RParen',  pattern: /\)/ });
const LBrack  = createToken({ name: 'LBrack',  pattern: /\[/ });
const RBrack  = createToken({ name: 'RBrack',  pattern: /\]/ });
const Comma   = createToken({ name: 'Comma',   pattern: /,/ });
const Colon   = createToken({ name: 'Colon',   pattern: /:/ });
const Dot     = createToken({ name: 'Dot',     pattern: /\./ });

const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

const allTokens = [
  WhiteSpace,
  Find, Insert, Update, Delete, Count,
  Where, Set, Limit, OrderBy, Asc, Desc,
  And, Or, In, Contains, Not,
  BoolLiteral, NullLiteral,
  Neq, Gte, Lte, Gt, Lt, Eq,
  StringLiteral, NumberLiteral,
  LCurly, RCurly, LParen, RParen, LBrack, RBrack,
  Comma, Colon, Dot,
  Identifier,
];

const QlLexer = new Lexer(allTokens, { recoveryEnabled: false });

module.exports = {
  QlLexer, allTokens,
  tokens: {
    Find, Insert, Update, Delete, Count,
    Where, Set, Limit, OrderBy, Asc, Desc,
    And, Or, In, Contains, Not,
    Neq, Gte, Lte, Gt, Lt, Eq,
    StringLiteral, NumberLiteral, BoolLiteral, NullLiteral,
    LCurly, RCurly, LParen, RParen, LBrack, RBrack,
    Comma, Colon, Dot,
    Identifier,
  },
};
