const { CstParser } = require('chevrotain');
const { allTokens, tokens: T } = require('./lexer');

class QlParser extends CstParser {
  constructor() {
    super(allTokens, { recoveryEnabled: false });

    const $ = this;

    $.RULE('query', () => {
      $.OR([
        { ALT: () => $.SUBRULE($.findQuery) },
        { ALT: () => $.SUBRULE($.insertQuery) },
        { ALT: () => $.SUBRULE($.updateQuery) },
        { ALT: () => $.SUBRULE($.deleteQuery) },
        { ALT: () => $.SUBRULE($.countQuery) },
      ]);
    });

    $.RULE('findQuery', () => {
      $.CONSUME(T.Find);
      $.CONSUME(T.Identifier, { LABEL: 'collection' });
      $.OPTION(() => $.SUBRULE($.whereClause));
      $.OPTION2(() => $.SUBRULE($.orderByClause));
      $.OPTION3(() => $.SUBRULE($.limitClause));
    });

    $.RULE('countQuery', () => {
      $.CONSUME(T.Count);
      $.CONSUME(T.Identifier, { LABEL: 'collection' });
      $.OPTION(() => $.SUBRULE($.whereClause));
    });

    $.RULE('insertQuery', () => {
      $.CONSUME(T.Insert);
      $.CONSUME(T.Identifier, { LABEL: 'collection' });
      $.SUBRULE($.jsonObject, { LABEL: 'document' });
    });

    $.RULE('updateQuery', () => {
      $.CONSUME(T.Update);
      $.CONSUME(T.Identifier, { LABEL: 'collection' });
      $.SUBRULE($.whereClause);
      $.CONSUME(T.Set);
      $.SUBRULE($.jsonObject, { LABEL: 'updates' });
    });

    $.RULE('deleteQuery', () => {
      $.CONSUME(T.Delete);
      $.CONSUME(T.Identifier, { LABEL: 'collection' });
      $.SUBRULE($.whereClause);
    });

    $.RULE('whereClause', () => {
      $.CONSUME(T.Where);
      $.SUBRULE($.condition);
      $.MANY(() => {
        $.OR([
          { ALT: () => $.CONSUME(T.And) },
          { ALT: () => $.CONSUME(T.Or) },
        ]);
        $.SUBRULE2($.condition);
      });
    });

    $.RULE('condition', () => {
      $.CONSUME(T.Identifier, { LABEL: 'field' });
      $.OR([
        {
          ALT: () => {
            $.SUBRULE($.comparisonOp);
            $.SUBRULE($.value);
          },
        },
        {
          ALT: () => {
            $.CONSUME(T.Contains);
            $.SUBRULE2($.value);
          },
        },
        {
          ALT: () => {
            $.OPTION(() => $.CONSUME(T.Not));
            $.CONSUME(T.In);
            $.CONSUME(T.LParen);
            $.SUBRULE3($.value);
            $.MANY(() => {
              $.CONSUME(T.Comma);
              $.SUBRULE4($.value);
            });
            $.CONSUME(T.RParen);
          },
        },
      ]);
    });

    $.RULE('comparisonOp', () => {
      $.OR([
        { ALT: () => $.CONSUME(T.Neq) },
        { ALT: () => $.CONSUME(T.Gte) },
        { ALT: () => $.CONSUME(T.Lte) },
        { ALT: () => $.CONSUME(T.Gt) },
        { ALT: () => $.CONSUME(T.Lt) },
        { ALT: () => $.CONSUME(T.Eq) },
      ]);
    });

    $.RULE('value', () => {
      $.OR([
        { ALT: () => $.CONSUME(T.StringLiteral) },
        { ALT: () => $.CONSUME(T.NumberLiteral) },
        { ALT: () => $.CONSUME(T.BoolLiteral) },
        { ALT: () => $.CONSUME(T.NullLiteral) },
        { ALT: () => $.CONSUME(T.Identifier) },
      ]);
    });

    $.RULE('orderByClause', () => {
      $.CONSUME(T.OrderBy);
      $.CONSUME(T.Identifier, { LABEL: 'field' });
      $.OPTION(() => {
        $.OR([
          { ALT: () => $.CONSUME(T.Asc) },
          { ALT: () => $.CONSUME(T.Desc) },
        ]);
      });
    });

    $.RULE('limitClause', () => {
      $.CONSUME(T.Limit);
      $.CONSUME(T.NumberLiteral, { LABEL: 'n' });
    });

    $.RULE('jsonObject', () => {
      $.CONSUME(T.LCurly);
      $.OPTION(() => {
        $.SUBRULE($.jsonPair);
        $.MANY(() => {
          $.CONSUME(T.Comma);
          $.SUBRULE2($.jsonPair);
        });
      });
      $.CONSUME(T.RCurly);
    });

    $.RULE('jsonPair', () => {
      $.OR([
        { ALT: () => $.CONSUME(T.StringLiteral, { LABEL: 'key' }) },
        { ALT: () => $.CONSUME(T.Identifier, { LABEL: 'key' }) },
      ]);
      $.CONSUME(T.Colon);
      $.SUBRULE($.jsonValue, { LABEL: 'val' });
    });

    $.RULE('jsonValue', () => {
      $.OR([
        { ALT: () => $.CONSUME(T.StringLiteral) },
        { ALT: () => $.CONSUME(T.NumberLiteral) },
        { ALT: () => $.CONSUME(T.BoolLiteral) },
        { ALT: () => $.CONSUME(T.NullLiteral) },
        { ALT: () => $.SUBRULE($.jsonObject) },
      ]);
    });

    this.performSelfAnalysis();
  }
}

module.exports = new QlParser();
