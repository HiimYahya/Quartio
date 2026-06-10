# Quartio-QL — Documentation technique du langage d'interrogation maison

## Sommaire

1. [Pourquoi un langage maison ?](#1-pourquoi-un-langage-maison-)
2. [Architecture des 4 couches](#2-architecture-des-4-couches)
3. [Grammaire formelle (BNF)](#3-grammaire-formelle-bnf)
4. [Couche 1 — Lexer (`lang/lexer.js`)](#4-couche-1--lexer-langlexerjs)
5. [Couche 2 — Parser (`lang/parser.js`)](#5-couche-2--parser-langparserjs)
6. [Couche 3 — Transpileur (`lang/transpiler.js`)](#6-couche-3--transpileur-langtranspilerjs)
7. [Couche 4 — Point d'entrée (`lang/index.js`)](#7-couche-4--point-dentrée-langindexjs)
8. [Exécution (`controllers/query.controller.js`)](#8-exécution-controllersquerycontrollerjs)
9. [Route HTTP (`routes/query.routes.js`)](#9-route-http-routesqueryroutesjs)
10. [Flux complet — exemple tracé](#10-flux-complet--exemple-tracé)
11. [Sécurité](#11-sécurité)
12. [Étendre le langage](#12-étendre-le-langage)

---

## 1. Pourquoi un langage maison ?

Le cahier des charges impose de créer un **langage d'interrogation maison** pour manipuler les documents MongoDB, plutôt que d'exposer directement les requêtes Mongoose au client. Cela remplit trois objectifs :

1. **Sécurité** : les requêtes passent par une grammaire stricte avant d'atteindre la base. Une chaîne malformée est rejetée au stade du lexer, avant tout contact avec MongoDB.
2. **Abstraction** : l'administrateur écrit `FIND annonces WHERE statut = "active"` et n'a pas à connaître la syntaxe Mongoose `{ statut: "active" }`.
3. **Extensibilité** : ajouter un opérateur ou une clause nécessite de modifier la grammaire à un seul endroit.

---

## 2. Architecture des 4 couches

```
Texte brut (string)
        │
        ▼
┌─────────────────┐
│   1. LEXER      │  Découpe le texte en tokens (unités élémentaires)
│   lexer.js      │  "FIND annonces WHERE statut = "active""
│                 │  → [Find]["annonces"][Where]["statut"][Eq]["active"]
└────────┬────────┘
         │ tableau de tokens
         ▼
┌─────────────────┐
│   2. PARSER     │  Vérifie que les tokens respectent la grammaire
│   parser.js     │  Produit un CST (arbre syntaxique concret)
│                 │  → findQuery { collection, whereClause { condition... } }
└────────┬────────┘
         │ CST (arbre d'objets imbriqués)
         ▼
┌─────────────────┐
│  3. TRANSPILEUR │  Traduit le CST en structure Mongoose
│  transpiler.js  │  → { type:"find", collection:"annonces",
│                 │       filter:{statut:"active"}, limit:50 }
└────────┬────────┘
         │ AST (objet JS simple)
         ▼
┌─────────────────┐
│  4. CONTROLLER  │  Exécute la requête Mongoose, retourne le résultat JSON
│  query.controller│
└─────────────────┘
```

**Pourquoi CST et pas directement AST ?**
Chevrotain produit un **CST** (Concrete Syntax Tree) qui conserve chaque token consommé, même les parenthèses et virgules. Le **transpileur** est ensuite responsable d'extraire uniquement ce qui est utile pour construire l'AST final. Cette séparation permet de tester le parser indépendamment du transpileur.

---

## 3. Grammaire formelle (BNF)

```bnf
query         ::= findQuery | countQuery | insertQuery | updateQuery | deleteQuery

findQuery     ::= "FIND"   collection whereClause? orderByClause? limitClause?
countQuery    ::= "COUNT"  collection whereClause?
insertQuery   ::= "INSERT" collection jsonObject
updateQuery   ::= "UPDATE" collection whereClause "SET" jsonObject
deleteQuery   ::= "DELETE" collection whereClause

collection    ::= Identifier

whereClause   ::= "WHERE" condition (("AND" | "OR") condition)*

condition     ::= Identifier comparisonOp value
               |  Identifier "CONTAINS" value
               |  Identifier "NOT"? "IN" "(" value ("," value)* ")"

comparisonOp  ::= "=" | "!=" | ">" | "<" | ">=" | "<="

value         ::= StringLiteral | NumberLiteral | BoolLiteral | NullLiteral | Identifier

orderByClause ::= "ORDER BY" Identifier ("ASC" | "DESC")?
limitClause   ::= "LIMIT" NumberLiteral

jsonObject    ::= "{" (jsonPair ("," jsonPair)*)? "}"
jsonPair      ::= (StringLiteral | Identifier) ":" jsonValue
jsonValue     ::= StringLiteral | NumberLiteral | BoolLiteral | NullLiteral | jsonObject
```

---

## 4. Couche 1 — Lexer (`lang/lexer.js`)

Le lexer est la **première passe** : il lit le texte caractère par caractère et produit une liste de tokens. Un token est l'unité élémentaire du langage : un mot-clé, un opérateur, un littéral, etc.

### 4.1 Import

```js
const { createToken, Lexer } = require('chevrotain');
```

- `createToken` : fonction Chevrotain qui crée la définition d'un type de token. Elle associe un **nom** (pour l'affichage et le débogage) à un **pattern** (regex qui reconnaît ce token dans le texte).
- `Lexer` : classe qui, à partir d'une liste ordonnée de définitions de tokens, peut tokeniser une chaîne entière.

---

### 4.2 Mots-clés avec word boundary

```js
const Find = createToken({ name: 'Find', pattern: /FIND(?![a-zA-Z0-9_])/i });
```

- `name: 'Find'` : nom interne du token, utilisé dans les messages d'erreur et les nœuds CST.
- `pattern: /FIND(?![a-zA-Z0-9_])/i` : regex qui reconnaît la séquence de caractères `FIND`.
  - Le flag `i` rend la regex **insensible à la casse** : `find`, `FIND`, `Find` sont tous reconnus.
  - `(?![a-zA-Z0-9_])` est un **lookahead négatif** : il vérifie que `FIND` n'est **pas suivi** d'un caractère alphanumérique ou underscore. Sans cette précaution, le mot `FINDER` serait tokenisé comme `FIND` + `ER`, ce qui produirait une erreur cryptique plutôt que de reconnaître `FINDER` comme un identifiant. De même, `incidents` commençant par `in` serait capté par le token `IN` si ce lookahead n'était pas présent.

Ce même pattern avec `(?![a-zA-Z0-9_])` est appliqué à **chaque mot-clé** : `INSERT`, `UPDATE`, `DELETE`, `COUNT`, `WHERE`, `SET`, `LIMIT`, `ASC`, `DESC`, `AND`, `OR`, `IN`, `CONTAINS`, `NOT`.

```js
const OrderBy = createToken({ name: 'OrderBy', pattern: /ORDER\s+BY(?![a-zA-Z0-9_])/i });
```

`ORDER BY` est traité comme un **token unique** (pas deux tokens séparés) car il contient un espace. `\s+` accepte un ou plusieurs espaces/tabulations entre `ORDER` et `BY`, ce qui tolère `ORDER  BY` (double espace).

---

### 4.3 Opérateurs — ordre des multi-chars avant mono-char

```js
const Neq = createToken({ name: 'Neq', pattern: /!=/ });
const Gte = createToken({ name: 'Gte', pattern: />=/ });
const Lte = createToken({ name: 'Lte', pattern: /<=/ });
const Gt  = createToken({ name: 'Gt',  pattern: />/ });
const Lt  = createToken({ name: 'Lt',  pattern: /</ });
const Eq  = createToken({ name: 'Eq',  pattern: /=/ });
```

Chevrotain essaie les tokens **dans l'ordre de la liste** `allTokens`. Si `>` était déclaré avant `>=`, alors `>=` serait tokenisé comme `>` puis `=` (deux tokens séparés), ce qui casserait le parser. En déclarant `Gte` avant `Gt` et `Lte` avant `Lt`, on garantit que le préfixe le plus long est reconnu en premier.

---

### 4.4 Littéraux

```js
const StringLiteral = createToken({
  name: 'StringLiteral',
  pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/,
});
```

Cette regex reconnaît deux formes de chaînes :
- `"(?:[^"\\]|\\.)*"` : une chaîne entre guillemets doubles.
  - `[^"\\]` : tout caractère sauf `"` et `\` (caractères normaux dans la chaîne).
  - `|\\.` : **ou** un backslash suivi de n'importe quel caractère (séquence d'échappement : `\"`, `\\`, `\n`, etc.).
  - `(?:...)*` : le groupe est non-capturant et peut se répéter 0 à N fois.
- `'(?:[^'\\]|\\.)*'` : idem avec guillemets simples.

Résultat : `"bonjour"`, `'hello'`, `"c'est \"ok\""` sont tous reconnus.

```js
const NumberLiteral = createToken({
  name: 'NumberLiteral',
  pattern: /-?(?:0|[1-9]\d*)(?:\.\d+)?/,
});
```

- `-?` : signe moins optionnel (nombres négatifs).
- `(?:0|[1-9]\d*)` : soit `0` seul, soit un chiffre 1-9 suivi de n'importe quels chiffres. Cette formulation interdit `07` (zéro initial inutile), standard JSON.
- `(?:\.\d+)?` : partie décimale optionnelle.

```js
const BoolLiteral = createToken({ name: 'BoolLiteral', pattern: /true|false/i });
const NullLiteral = createToken({ name: 'NullLiteral', pattern: /null/i });
```

`BoolLiteral` et `NullLiteral` sont déclarés **avant** `Identifier` dans `allTokens`. Sans cela, `true` serait reconnu comme un `Identifier` (le pattern `[a-zA-Z_][a-zA-Z0-9_.]*` correspond aussi à `true`). En les plaçant avant, Chevrotain les capte en priorité.

---

### 4.5 Identifier

```js
const Identifier = createToken({
  name: 'Identifier',
  pattern: /[a-zA-Z_][a-zA-Z0-9_.]*/,
});
```

Reconnaît les noms de collections (`annonces`, `incidents`) et les noms de champs (`statut`, `cout_points`, `date_debut`).

- `[a-zA-Z_]` : le premier caractère est une lettre ou underscore (pas un chiffre).
- `[a-zA-Z0-9_.]*` : les caractères suivants peuvent être des lettres, chiffres, underscores ou **points**. Le point permet les chemins imbriqués comme `auteur.nom` si un document MongoDB a cette structure.

---

### 4.6 WhiteSpace — groupe SKIPPED

```js
const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});
```

`group: Lexer.SKIPPED` indique à Chevrotain de **reconnaître** les espaces/tabulations/sauts de ligne mais de **ne pas les inclure** dans le tableau de tokens retourné. Le parser ne verra jamais de token `WhiteSpace` : les espaces sont "transparents" pour lui.

---

### 4.7 Ordre de `allTokens` — le cœur de la configuration

```js
const allTokens = [
  WhiteSpace,           // 1. Sauté immédiatement
  Find, Insert, Update, Delete, Count,  // 2. Mots-clés (avant Identifier)
  Where, Set, Limit, OrderBy, Asc, Desc,
  And, Or, In, Contains, Not,
  BoolLiteral, NullLiteral,             // 3. Littéraux typés (avant Identifier)
  Neq, Gte, Lte, Gt, Lt, Eq,           // 4. Opérateurs multi-chars avant mono-char
  StringLiteral, NumberLiteral,         // 5. Littéraux
  LCurly, RCurly, LParen, RParen, LBrack, RBrack, Comma, Colon, Dot,  // 6. Ponctuation
  Identifier,                           // 7. En dernier : capture ce que rien d'autre n'a reconnu
];
```

Chevrotain applique les tokens **dans cet ordre** sur chaque position du texte. Le premier token dont le pattern correspond "gagne". `Identifier` est en dernière position car son pattern très permissif (`[a-zA-Z_][a-zA-Z0-9_.]*`) engloberait les mots-clés si il était placé avant eux.

---

### 4.8 Instanciation du Lexer

```js
const QlLexer = new Lexer(allTokens, { recoveryEnabled: false });
```

- `allTokens` : la liste ordonnée définie ci-dessus.
- `recoveryEnabled: false` : désactive la récupération d'erreur. En mode recovery, le lexer essaie de continuer après une erreur en sautant des caractères. Ici on préfère s'arrêter immédiatement et retourner un message d'erreur précis à l'utilisateur.

---

### 4.9 Export

```js
module.exports = {
  QlLexer,    // l'instance du lexer (utilisée dans index.js)
  allTokens,  // la liste (utilisée par le parser pour sa configuration)
  tokens: { Find, Insert, ... },  // chaque token individuel (utilisé dans les règles du parser)
};
```

Les trois exports ont des usages distincts : `QlLexer` tokenise, `allTokens` configure le parser, et `tokens` sert de référence dans les `CONSUME` du parser.

---

## 5. Couche 2 — Parser (`lang/parser.js`)

Le parser lit la liste de tokens produite par le lexer et vérifie qu'ils forment une séquence syntaxiquement valide selon la grammaire. Il produit un **CST** (Concrete Syntax Tree).

### 5.1 Import et choix de CstParser

```js
const { CstParser } = require('chevrotain');
const { allTokens, tokens: T } = require('./lexer');
```

Chevrotain propose deux variantes de parser :
- `CstParser` : produit un arbre concret conservant **tous les tokens consommés**. C'est plus verbeux à traverser mais plus facile à déboguer.
- `EmbeddedActionsParser` : permet d'exécuter du code pendant le parsing (actions sémantiques embarquées), ce qui fait parser + transpilation en une seule passe.

On a choisi `CstParser` pour **séparer les responsabilités** : le parser ne sait rien de MongoDB, c'est le transpileur qui s'en charge. Cela permet de tester chaque couche indépendamment.

---

### 5.2 Classe et constructeur

```js
class QlParser extends CstParser {
  constructor() {
    super(allTokens, { recoveryEnabled: false });
    const $ = this;
```

- `super(allTokens, ...)` : transmet la liste de tokens au parser parent qui en a besoin pour ses vérifications internes.
- `const $ = this` : alias raccourci pour accéder aux méthodes DSL (`$.RULE`, `$.CONSUME`, etc.) à l'intérieur des closures de règles. Sinon `this` serait perdu dans les fonctions fléchées.

---

### 5.3 Règle racine `query`

```js
$.RULE('query', () => {
  $.OR([
    { ALT: () => $.SUBRULE($.findQuery)   },
    { ALT: () => $.SUBRULE($.insertQuery) },
    { ALT: () => $.SUBRULE($.updateQuery) },
    { ALT: () => $.SUBRULE($.deleteQuery) },
    { ALT: () => $.SUBRULE($.countQuery)  },
  ]);
});
```

- `$.RULE('query', fn)` : déclare une règle de grammaire nommée `query`. C'est le **point d'entrée** du parser — la règle qu'on appelle en premier sur n'importe quelle requête.
- `$.OR([...])` : tente chaque alternative dans l'ordre. Chevrotain regarde le **token courant** (lookahead) pour choisir la bonne alternative. Par exemple, si le premier token est `Find`, il choisit `findQuery`.
- `$.SUBRULE($.findQuery)` : délègue le parsing à la règle `findQuery` et incorpore son sous-arbre dans le CST courant.

---

### 5.4 Règle `findQuery`

```js
$.RULE('findQuery', () => {
  $.CONSUME(T.Find);
  $.CONSUME(T.Identifier, { LABEL: 'collection' });
  $.OPTION(()  => $.SUBRULE($.whereClause));
  $.OPTION2(() => $.SUBRULE($.orderByClause));
  $.OPTION3(() => $.SUBRULE($.limitClause));
});
```

- `$.CONSUME(T.Find)` : consomme le token `Find` depuis la liste. Si le token courant n'est pas `Find`, le parser déclenche une erreur de syntaxe.
- `$.CONSUME(T.Identifier, { LABEL: 'collection' })` : consomme un `Identifier` et lui attribue le label `collection` dans le CST. Ce label permet au transpileur de trouver ce token par son rôle plutôt que par sa position : `q.collection[0].image`.
- `$.OPTION(fn)` : exécute `fn` si et seulement si les tokens suivants correspondent au début de `whereClause`. Sinon, `fn` est sautée sans erreur. C'est ainsi qu'on rend `WHERE` **optionnel**.
- `$.OPTION2`, `$.OPTION3` : variantes numérotées nécessaires car Chevrotain interdit d'utiliser le même méthode dans une même règle deux fois — chaque appel doit avoir un identifiant unique pour que le parser puisse construire correctement ses tables de lookahead.

---

### 5.5 Règle `whereClause`

```js
$.RULE('whereClause', () => {
  $.CONSUME(T.Where);
  $.SUBRULE($.condition);
  $.MANY(() => {
    $.OR([
      { ALT: () => $.CONSUME(T.And) },
      { ALT: () => $.CONSUME(T.Or)  },
    ]);
    $.SUBRULE2($.condition);
  });
});
```

- `$.MANY(fn)` : répète `fn` zéro ou plusieurs fois tant que les tokens correspondent. C'est l'équivalent d'un `*` en BNF, ce qui permet des conditions chaînées : `a AND b OR c AND d`.
- `$.SUBRULE2` : même règle `condition` que `$.SUBRULE($.condition)` mais numérotée différemment car c'est le deuxième appel à `condition` dans cette règle.

---

### 5.6 Règle `condition`

```js
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
```

Une condition commence toujours par un `Identifier` (le nom du champ), puis prend l'une des trois formes :

1. **Comparaison** : `field op value` — ex: `statut = "active"`, `cout_points > 50`
2. **CONTAINS** : `field CONTAINS value` — ex: `titre CONTAINS "bruit"` → requête regex insensible à la casse
3. **IN** : `field [NOT] IN (v1, v2, ...)` — ex: `statut IN ("active", "inactive")`
   - `$.OPTION(() => $.CONSUME(T.Not))` : le `NOT` est optionnel, permettant `NOT IN`.
   - `$.SUBRULE3($.value)` : au moins une valeur obligatoire dans la liste.
   - `$.MANY(...)` : zéro ou plusieurs `,valeur` supplémentaires.

---

### 5.7 Règle `comparisonOp`

```js
$.RULE('comparisonOp', () => {
  $.OR([
    { ALT: () => $.CONSUME(T.Neq) },
    { ALT: () => $.CONSUME(T.Gte) },
    { ALT: () => $.CONSUME(T.Lte) },
    { ALT: () => $.CONSUME(T.Gt)  },
    { ALT: () => $.CONSUME(T.Lt)  },
    { ALT: () => $.CONSUME(T.Eq)  },
  ]);
});
```

Règle dédiée pour les opérateurs de comparaison. La séparer en règle distincte plutôt que d'inline les alternatives dans `condition` permet au transpileur d'accéder au sous-arbre `comparisonOp` directement pour identifier quel opérateur a été utilisé.

---

### 5.8 Règles `jsonObject` et `jsonPair`

```js
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
```

Reconnaît un objet `{ }` vide ou avec des paires clé/valeur séparées par des virgules.

```js
$.RULE('jsonPair', () => {
  $.OR([
    { ALT: () => $.CONSUME(T.StringLiteral, { LABEL: 'key' }) },
    { ALT: () => $.CONSUME(T.Identifier,    { LABEL: 'key' }) },
  ]);
  $.CONSUME(T.Colon);
  $.SUBRULE($.jsonValue, { LABEL: 'val' });
});
```

La clé peut être une chaîne (`"statut"`) ou un identifiant nu (`statut`). Les deux formes sont étiquetées `key` dans le CST. La valeur est étiquetée `val`.

---

### 5.9 `performSelfAnalysis`

```js
this.performSelfAnalysis();
```

Appel **obligatoire** à la fin du constructeur. Chevrotain analyse toutes les règles définies, construit les tables de lookahead (décisions de parsing), et vérifie l'absence d'ambiguïtés ou de récursions gauches illégales. Sans cet appel, le parser ne fonctionne pas.

---

### 5.10 Export d'une instance unique

```js
module.exports = new QlParser();
```

On exporte une **instance** plutôt que la classe. Le parser Chevrotain peut être réutilisé entre plusieurs appels à condition de réassigner `parser.input` avant chaque parsing (fait dans `index.js`).

---

## 6. Couche 3 — Transpileur (`lang/transpiler.js`)

Le transpileur parcourt le CST produit par le parser et le traduit en un objet JavaScript simple (l'AST) que le controller peut directement passer à Mongoose.

### 6.1 Pourquoi cette séparation ?

Le CST de Chevrotain est structuré autour de la grammaire (nœuds `findQuery`, `whereClause`, etc.) et conserve tous les tokens. L'AST final n'a besoin que des informations sémantiques : quel est le type d'opération, sur quelle collection, avec quel filtre. Le transpileur fait cette traduction.

---

### 6.2 `parseValue(node)` — extraction des littéraux

```js
function parseValue(node) {
  if (!node || !node.children) return null;
  const ch = node.children;
```

- `node` est un nœud CST de la règle `value`. `node.children` est un dictionnaire où les clés sont les noms des tokens consommés.
- La vérification `!node || !node.children` protège contre les nœuds vides ou absents (Chevrotain peut retourner `undefined` pour des clauses optionnelles non présentes).

```js
  if (ch.StringLiteral?.[0]) {
    const raw = ch.StringLiteral[0].image;
    return raw.slice(1, -1); // retire les guillemets
  }
```

- `ch.StringLiteral` est un tableau des tokens `StringLiteral` consommés dans ce nœud.
- `[0]` prend le premier (et unique).
- `.image` est la chaîne brute du token, guillemets inclus : `"active"`.
- `.slice(1, -1)` retire le premier et dernier caractère pour obtenir `active`.

```js
  if (ch.NumberLiteral?.[0]) {
    return parseFloat(ch.NumberLiteral[0].image);
  }
```

`parseFloat` est utilisé à la place de `parseInt` pour gérer les décimaux. `parseFloat("42")` retourne bien `42` (entier).

```js
  if (ch.BoolLiteral?.[0]) {
    return ch.BoolLiteral[0].image.toLowerCase() === 'true';
  }
```

Convertit la chaîne `"true"` ou `"TRUE"` (le flag `i` du lexer tolère les deux) en booléen JavaScript `true` ou `false`.

---

### 6.3 `parseCondition(node)` — condition → filtre Mongoose

```js
function parseCondition(node) {
  const ch    = node.children;
  const field = ch.field?.[0]?.image ?? ch.Identifier?.[0]?.image;
```

- `ch.field` correspond au token `Identifier` labellisé `field` dans la règle `condition`.
- `??` (nullish coalescing) : si `ch.field` est absent, on tente `ch.Identifier` comme fallback (certaines variantes du CST peuvent ne pas avoir le label).

```js
  if (ch.Contains) {
    const val = parseValue(ch.value?.[0]);
    return { [field]: { $regex: String(val), $options: 'i' } };
  }
```

`CONTAINS` génère une requête MongoDB `$regex` avec `$options: 'i'` (insensible à la casse). `String(val)` s'assure que même si `val` est un nombre, il est converti en chaîne avant d'être passé à `$regex`.

```js
  if (ch.In) {
    const vals = (ch.value ?? []).map(parseValue);
    return ch.Not
      ? { [field]: { $nin: vals } }
      : { [field]: { $in: vals } };
  }
```

- `ch.value` est un tableau de tous les nœuds `value` consommés (les éléments de la liste `IN`).
- `.map(parseValue)` extrait la valeur JS de chaque nœud.
- `ch.Not` est présent si le token `NOT` a été consommé → `$nin` (Not In MongoDB).

```js
  const opToken = ch.comparisonOp?.[0]?.children;
  const val     = parseValue(ch.value?.[0]);

  if (opToken?.Eq)  return { [field]: val };
  if (opToken?.Neq) return { [field]: { $ne: val } };
  if (opToken?.Gt)  return { [field]: { $gt: val } };
  if (opToken?.Lt)  return { [field]: { $lt: val } };
  if (opToken?.Gte) return { [field]: { $gte: val } };
  if (opToken?.Lte) return { [field]: { $lte: val } };
```

- Pour `=`, on retourne directement `{ field: val }` (syntaxe Mongoose pour l'égalité stricte, pas besoin de `$eq`).
- Pour les autres, on enveloppe dans l'opérateur Mongoose correspondant.

---

### 6.4 `parseWhereClause(node)` — gestion de AND/OR avec priorité

```js
function parseWhereClause(node) {
  if (!node) return {};
  const ch = node.children;
  const conditions  = ch.condition ?? [];
  const logicalOps  = [...(ch.And ?? []), ...(ch.Or ?? [])]
    .sort((a, b) => a.startOffset - b.startOffset);
```

Le CST stocke les tokens `And` et `Or` dans des tableaux séparés. Pour reconstruire l'ordre d'apparition, on les fusionne et trie par `startOffset` (position dans la chaîne d'entrée).

```js
  const parts = [parseCondition(conditions[0])];
  for (let i = 0; i < logicalOps.length; i++) {
    const op   = logicalOps[i].tokenType.name; // 'And' | 'Or'
    const cond = parseCondition(conditions[i + 1]);
    parts.push({ op, cond });
  }
```

On construit une liste plate comme :
```
[condA, {op:'And', cond:condB}, {op:'Or', cond:condC}, {op:'And', cond:condD}]
```

```js
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
```

Cette logique implémente la **priorité AND sur OR** (comme en SQL) :

- `A AND B OR C AND D` → `(A AND B) OR (C AND D)` → `{ $or: [{ $and: [A, B] }, { $and: [C, D] }] }`
- `A AND B AND C` → `{ $and: [A, B, C] }`
- `A OR B` → `{ $or: [A, B] }`
- Condition unique → retournée directement sans `$and`/`$or`

---

### 6.5 `parseJsonObject` et `parseJsonValue` — objets pour INSERT/UPDATE

```js
function parseJsonObject(node) {
  if (!node) return {};
  const ch  = node.children;
  const obj = {};
  for (const pair of (ch.jsonPair ?? [])) {
    const pCh = pair.children;
    const rawKey = pCh.key?.[0]?.image ?? pCh.StringLiteral?.[0]?.image ?? pCh.Identifier?.[0]?.image ?? '';
    const key = rawKey.startsWith('"') || rawKey.startsWith("'") ? rawKey.slice(1, -1) : rawKey;
```

- `ch.jsonPair` est un tableau des paires clé/valeur.
- `rawKey` extrait l'image brute de la clé (qui peut être un `StringLiteral` avec guillemets ou un `Identifier` nu).
- `.startsWith('"')` : si la clé est entre guillemets, on retire les guillemets avec `.slice(1, -1)`.

```js
    const valNode = pCh.val?.[0] ?? pCh.jsonValue?.[0];
    obj[key] = parseJsonValue(valNode);
```

`pCh.val` cherche le nœud labellisé `val` (défini dans `jsonPair`). Le fallback `pCh.jsonValue` gère les cas où le label n'est pas résolu.

```js
function parseJsonValue(node) {
  if (ch.jsonObject?.[0]) return parseJsonObject(ch.jsonObject[0]);
```

`parseJsonValue` est récursif pour les objets imbriqués. Exemple : `{ "auteur": { "nom": "Dupont" } }`.

---

### 6.6 `transpile(cst)` — point d'entrée

```js
function transpile(cst) {
  const root = cst.children;
```

La racine du CST est le nœud `query`. `cst.children` est un dictionnaire où une seule clé sera présente : `findQuery`, `countQuery`, etc.

```js
  if (root.findQuery) {
    const q  = root.findQuery[0].children;
    const lm = q.limitClause?.[0];
    ...
    if (lm) {
      const n = parseInt(lm.children.n?.[0]?.image ?? ... ?? '50');
      limit = Math.min(n, 200);
    }
```

- `Math.min(n, 200)` : plafond de sécurité — même si l'utilisateur écrit `LIMIT 10000`, seuls 200 documents sont retournés pour protéger les performances.
- Valeur par défaut `50` : si pas de clause `LIMIT`, on retourne au maximum 50 résultats.

---

## 7. Couche 4 — Point d'entrée (`lang/index.js`)

```js
const { QlLexer } = require('./lexer');
const parser      = require('./parser');
const { transpile } = require('./transpiler');

function parse(input) {
  // 1. Tokenisation
  const lex = QlLexer.tokenize(input);
  if (lex.errors.length > 0) {
    const err = lex.errors[0];
    throw new Error(`Erreur de tokenisation à la position ${err.offset}: ${err.message}`);
  }
```

`QlLexer.tokenize(input)` retourne `{ tokens, errors }`.
- Si `errors` n'est pas vide, le texte contient un caractère qui n'est reconnu par aucun token (ex: `@`, `#`).
- On relance uniquement la **première erreur** pour ne pas noyer l'utilisateur.
- `err.offset` est la position en caractères dans la chaîne, utile pour pointer l'endroit exact du problème.

```js
  // 2. Parsing
  parser.input = lex.tokens;
  const cst = parser.query();
  if (parser.errors.length > 0) {
    const err = parser.errors[0];
    throw new Error(`Erreur de syntaxe : ${err.message}`);
  }
```

- `parser.input = lex.tokens` : réinitialise le curseur du parser sur les nouveaux tokens. C'est pourquoi on peut réutiliser l'instance exportée par `parser.js` entre plusieurs appels : il suffit de réassigner `.input`.
- `parser.query()` : lance le parsing depuis la règle racine. Retourne le CST.
- Si `parser.errors` est non vide, le message de Chevrotain indique quel token était attendu et lequel a été trouvé.

```js
  // 3. Transpilation
  return transpile(cst);
}
```

Le CST valide est passé au transpileur. Le résultat est l'AST final prêt pour Mongoose.

---

## 8. Exécution (`controllers/query.controller.js`)

### 8.1 Mapping collections → modèles Mongoose

```js
const COLLECTIONS = {
  annonces:      Annonce,
  annonce:       Annonce,    // singulier accepté
  evenements:    Evenement,
  evenement:     Evenement,
  incidents:     Incident,
  incident:      Incident,
  conversations: Conversation,
  conversation:  Conversation,
  messages:      Message,
  message:       Message,
};
```

Les formes singulière et plurielle sont toutes deux acceptées pour chaque collection. Si l'utilisateur écrit `FIND annonce` ou `FIND annonces`, les deux mappent sur le même modèle `Annonce`. Cela rend le langage plus tolérant et naturel.

---

### 8.2 Validation du corps de requête

```js
const { query } = req.body;
if (!query || typeof query !== 'string') {
  return res.status(400).json({ error: 'Paramètre "query" manquant' });
}
```

Double vérification : `!query` attrape `null`, `undefined`, `""` (chaîne vide), et `typeof query !== 'string'` rejette les cas où quelqu'un enverrait un tableau ou un objet.

---

### 8.3 Isolation des erreurs de parsing

```js
let ast;
try {
  ast = parse(query.trim());
} catch (parseErr) {
  return res.status(400).json({ error: parseErr.message, type: 'parse_error' });
}
```

Le parsing est dans son propre `try/catch` pour distinguer les **erreurs de syntaxe** (HTTP 400, type `parse_error`) des erreurs d'exécution MongoDB (HTTP 500, gérées par le `catch` global avec `next(err)`). La frontend peut ainsi afficher un message adapté selon le `type`.

---

### 8.4 Guard contre UPDATE/DELETE sans WHERE

```js
case 'update': {
  if (!ast.filter || Object.keys(ast.filter).length === 0) {
    return res.status(400).json({ error: 'UPDATE sans clause WHERE est interdit' });
  }
```

Un `UPDATE` ou `DELETE` sans filtre affecterait **tous les documents** de la collection. Ce guard évite une suppression ou modification accidentelle massive. Même si la grammaire impose syntaxiquement un `WHERE` pour ces commandes, on vérifie aussi que le filtre résultant n'est pas vide (le transpileur retourne `{}` pour certaines clauses malformées).

---

### 8.5 `lean()` pour les requêtes FIND

```js
result = await model.find(ast.filter)
  .sort(ast.sort)
  .limit(ast.limit)
  .lean();
```

`.lean()` dit à Mongoose de retourner des **plain objects JavaScript** plutôt que des instances de Document Mongoose complètes. Les documents Mongoose ont des méthodes et des getters supplémentaires qui augmentent leur taille en mémoire. Pour une API qui sérialise en JSON, `.lean()` est plus performant.

---

### 8.6 Mesure de performance

```js
const start = Date.now();
// ... exécution ...
res.json({ ..., duration_ms: Date.now() - start });
```

`duration_ms` mesure uniquement le temps d'exécution Mongoose (pas le parsing). Utile dans la console pour identifier les requêtes lentes.

---

### 8.7 Retour de l'AST dans la réponse

```js
res.json({
  type, collection, filter, result, affected, duration_ms,
  ast,
});
```

L'AST est renvoyé dans la réponse pour permettre à la console backoffice de l'afficher dans la section "Voir l'AST généré". Cela aide à comprendre comment une requête a été interprétée et facilite le débogage.

---

## 9. Route HTTP (`routes/query.routes.js`)

```js
router.post('/', auth, role('admin', 'moderateur'), ctrl.execute);
```

- `auth` : vérifie que le JWT est valide et injecte `req.user`.
- `role('admin', 'moderateur')` : seuls les admins et modérateurs ont accès à la console. Les utilisateurs normaux ne peuvent pas interroger directement MongoDB.
- La restriction lecture-seule pour les modérateurs est gérée dans le controller plutôt qu'ici, car c'est une règle métier liée à l'AST (le type d'opération), pas à la route.

---

## 10. Flux complet — exemple tracé

Requête : `FIND annonces WHERE cout_points > 50 AND statut = "active" LIMIT 10`

### Étape 1 — Tokenisation

```
Input : FIND annonces WHERE cout_points > 50 AND statut = "active" LIMIT 10

Tokens produits :
  [Find]        "FIND"
  [Identifier]  "annonces"
  [Where]       "WHERE"
  [Identifier]  "cout_points"
  [Gt]          ">"
  [Number]      "50"
  [And]         "AND"
  [Identifier]  "statut"
  [Eq]          "="
  [String]      '"active"'
  [Limit]       "LIMIT"
  [Number]      "10"
```

### Étape 2 — Parsing (CST simplifié)

```
findQuery
├── Find: "FIND"
├── collection: Identifier "annonces"
├── whereClause
│   ├── Where: "WHERE"
│   ├── condition[0]
│   │   ├── field: Identifier "cout_points"
│   │   ├── comparisonOp: Gt ">"
│   │   └── value: Number "50"
│   ├── And: "AND"
│   └── condition[1]
│       ├── field: Identifier "statut"
│       ├── comparisonOp: Eq "="
│       └── value: String '"active"'
└── limitClause
    ├── Limit: "LIMIT"
    └── n: Number "10"
```

### Étape 3 — Transpilation (AST)

```js
{
  type:       "find",
  collection: "annonces",
  filter:     { $and: [ { cout_points: { $gt: 50 } }, { statut: "active" } ] },
  sort:       null,
  limit:      10
}
```

### Étape 4 — Exécution Mongoose

```js
Annonce.find({ $and: [ { cout_points: { $gt: 50 } }, { statut: "active" } ] })
  .limit(10)
  .lean()
```

---

## 11. Sécurité

| Menace | Protection |
|---|---|
| Injection MongoDB (ex: `{ $where: ... }`) | Impossible : la grammaire n'accepte pas les opérateurs MongoDB en entrée. Seuls les identifiants et littéraux sont reconnus. |
| Requête sans filtre destructrice | Guard explicite : `UPDATE`/`DELETE` sans `WHERE` → HTTP 400. |
| Accès non autorisé | Middleware `auth` + `role('admin', 'moderateur')` sur la route. |
| Modérateur qui modifie des données | Contrôle dans le controller : seuls `find` et `count` sont autorisés pour le rôle `moderateur`. |
| Résultat massif (FIND sans LIMIT) | Limite par défaut de 50, plafond à 200 même si `LIMIT` est spécifié. |
| Collections hors périmètre | Whitelist explicite dans `COLLECTIONS` — toute collection non listée retourne HTTP 400. |

---

## 12. Étendre le langage

### Ajouter un nouveau mot-clé (ex: `TOP`)

1. **Lexer** : créer `const Top = createToken({ name: 'Top', pattern: /TOP(?![a-zA-Z0-9_])/i })` et l'ajouter dans `allTokens` avant `Identifier`.
2. **Parser** : utiliser `$.CONSUME(T.Top)` dans la règle appropriée.
3. **Transpileur** : gérer `root.top` dans la fonction `transpile`.
4. **Exporter** : ajouter `Top` dans l'export `tokens` du lexer.

### Ajouter une nouvelle collection

Ajouter simplement une entrée dans `COLLECTIONS` du controller :
```js
const Vote = require('../models/mongo/vote.model'); // ou PG si applicable
COLLECTIONS.votes = Vote;
COLLECTIONS.vote  = Vote;
```

### Ajouter un opérateur (ex: `STARTSWITH`)

1. **Lexer** : `const StartsWith = createToken({ name: 'StartsWith', pattern: /STARTSWITH(?![a-zA-Z0-9_])/i })`.
2. **Parser** : ajouter une alternative dans `condition` : `{ ALT: () => { $.CONSUME(T.StartsWith); $.SUBRULE5($.value); } }`.
3. **Transpileur** : dans `parseCondition`, ajouter `if (ch.StartsWith) return { [field]: { $regex: '^' + String(val) } }`.
