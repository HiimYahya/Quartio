const { QlLexer } = require('./lexer');
const parser      = require('./parser');
const { transpile } = require('./transpiler');

function parse(input) {
  const lex = QlLexer.tokenize(input);
  if (lex.errors.length > 0) {
    const err = lex.errors[0];
    throw new Error(`Erreur de tokenisation à la position ${err.offset}: ${err.message}`);
  }

  parser.input = lex.tokens;
  const cst = parser.query();
  if (parser.errors.length > 0) {
    const err = parser.errors[0];
    throw new Error(`Erreur de syntaxe : ${err.message}`);
  }

  return transpile(cst);
}

module.exports = { parse };
