const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Quartio - API REST',
      version: '2.0.0',
      description: `
API de gestion de quartier connecté.

**Bases de données :**
- PostgreSQL - utilisateurs, quartiers, contrats, transactions, votes
- MongoDB - annonces, événements, incidents, messages, conversations
- Neo4j - relations sociales (habite, signe, participe...)

**Authentification :** Bearer JWT - obtenez un token via \`POST /api/auth/login\`, puis passez-le dans le header \`Authorization: Bearer <token>\`.
      `.trim(),
      contact: { name: 'Équipe Quartio', email: 'contact@quartio.fr' },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Développement local' },
      { url: 'https://quartio-production.up.railway.app', description: 'Production' },
    ],
    tags: [
      { name: 'Auth',          description: 'Authentification et gestion de session' },
      { name: 'Utilisateurs',  description: 'Gestion des comptes utilisateurs' },
      { name: 'Quartiers',     description: 'Zones géographiques et leurs ressources' },
      { name: 'Annonces',      description: 'Annonces de services entre voisins' },
      { name: 'Événements',    description: 'Événements locaux' },
      { name: 'Votes',         description: 'Votes et sondages du quartier' },
      { name: 'Conversations', description: 'Messagerie - fils de discussion' },
      { name: 'Messages',      description: 'Messages individuels' },
      { name: 'Contrats',      description: 'Contrats de service et transferts de points' },
      { name: 'Transactions',  description: 'Historique des points échangés' },
      { name: 'Incidents',     description: 'Signalements d\'incidents' },
      { name: 'Notifications', description: 'Notifications in-app' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtenu via POST /api/auth/login',
        },
      },
      schemas: {
        // ── Pagination ──────────────────────────────────────────────────────
        PaginatedResponse: {
          type: 'object',
          properties: {
            data:        { type: 'array', items: {} },
            total:       { type: 'integer', example: 42 },
            page:        { type: 'integer', example: 1 },
            limit:       { type: 'integer', example: 20 },
            total_pages: { type: 'integer', example: 3 },
          },
        },
        // ── Erreur standard ─────────────────────────────────────────────────
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Message d\'erreur' },
          },
        },
        // ── Auth ────────────────────────────────────────────────────────────
        LoginResponse: {
          type: 'object',
          properties: {
            access_token:  { type: 'string', description: 'JWT court (1h)' },
            refresh_token: { type: 'string', description: 'JWT long (7j)' },
            expires_in:    { type: 'integer', example: 3600 },
            utilisateur: { $ref: '#/components/schemas/UtilisateurPublic' },
          },
        },
        // ── Utilisateur ─────────────────────────────────────────────────────
        UtilisateurPublic: {
          type: 'object',
          properties: {
            id_utilisateur:   { type: 'integer', example: 1 },
            nom:              { type: 'string', example: 'Dupont' },
            prenom:           { type: 'string', example: 'Jean' },
            email:            { type: 'string', format: 'email' },
            telephone:        { type: 'string', nullable: true },
            role:             { type: 'string', enum: ['user', 'admin', 'moderateur'] },
            points_solde:     { type: 'integer', example: 150 },
            langue:           { type: 'string', enum: ['fr', 'en'] },
            date_inscription: { type: 'string', format: 'date-time' },
          },
        },
        UtilisateurCreate: {
          type: 'object',
          required: ['nom', 'prenom', 'email', 'mot_de_passe'],
          properties: {
            nom:          { type: 'string', minLength: 2, example: 'Dupont' },
            prenom:       { type: 'string', minLength: 2, example: 'Jean' },
            email:        { type: 'string', format: 'email' },
            mot_de_passe: { type: 'string', minLength: 8, example: 'MonMotDePasse1!' },
            telephone:    { type: 'string', example: '+33612345678' },
            langue:       { type: 'string', enum: ['fr', 'en'], default: 'fr' },
          },
        },
        UtilisateurUpdate: {
          type: 'object',
          properties: {
            nom:       { type: 'string' },
            prenom:    { type: 'string' },
            telephone: { type: 'string', nullable: true },
            langue:    { type: 'string', enum: ['fr', 'en'] },
          },
        },
        // ── Quartier ────────────────────────────────────────────────────────
        Quartier: {
          type: 'object',
          properties: {
            id_quartier:   { type: 'integer', example: 1 },
            nom:           { type: 'string', example: 'Centre-Ville' },
            geometrie:     { type: 'string', nullable: true, description: 'GeoJSON Feature stringifié' },
            date_creation: { type: 'string', format: 'date-time' },
          },
        },
        QuartierCreate: {
          type: 'object',
          required: ['nom'],
          properties: {
            nom:       { type: 'string', minLength: 2, example: 'Belleville' },
            geometrie: { type: 'string', nullable: true, description: 'GeoJSON Feature stringifié' },
          },
        },
        // ── Annonce (MongoDB) ────────────────────────────────────────────────
        Annonce: {
          type: 'object',
          properties: {
            _id:              { type: 'string', example: '64a1b2c3d4e5f6a7b8c9d0e1' },
            titre:            { type: 'string', example: 'Cours de guitare' },
            description:      { type: 'string', nullable: true },
            type:             { type: 'string', enum: ['offre', 'demande'] },
            est_payant:       { type: 'boolean' },
            cout_points:      { type: 'integer', example: 50 },
            categorie:        { type: 'string', nullable: true },
            statut:           { type: 'string', enum: ['active', 'inactive', 'archivee'] },
            id_utilisateur_pg:{ type: 'integer' },
            date_publication: { type: 'string', format: 'date-time' },
          },
        },
        AnnonceCreate: {
          type: 'object',
          required: ['titre'],
          properties: {
            titre:       { type: 'string', example: 'Cours de guitare' },
            description: { type: 'string' },
            type:        { type: 'string', enum: ['offre', 'demande'], default: 'offre' },
            est_payant:  { type: 'boolean', default: false },
            cout_points: { type: 'integer', minimum: 0, default: 0 },
            categorie:   { type: 'string' },
            id_quartier: { type: 'integer', description: 'Optionnel : déduit du quartier de l\'auteur si absent' },
          },
        },
        // ── Événement (MongoDB) ──────────────────────────────────────────────
        Evenement: {
          type: 'object',
          properties: {
            _id:          { type: 'string' },
            titre:        { type: 'string', example: 'Marché de Noël' },
            description:  { type: 'string', nullable: true },
            date_debut:   { type: 'string', format: 'date-time' },
            date_fin:     { type: 'string', format: 'date-time', nullable: true },
            lieu:         { type: 'string', nullable: true },
            capacite_max: { type: 'integer', nullable: true },
            statut:       { type: 'string', enum: ['planifie', 'en_cours', 'termine', 'annule'] },
            id_quartier:  { type: 'integer' },
          },
        },
        EvenementCreate: {
          type: 'object',
          required: ['titre', 'date_debut'],
          properties: {
            titre:        { type: 'string' },
            description:  { type: 'string' },
            date_debut:   { type: 'string', format: 'date-time' },
            date_fin:     { type: 'string', format: 'date-time' },
            lieu:         { type: 'string' },
            capacite_max: { type: 'integer', minimum: 1 },
            id_quartier:  { type: 'integer', description: 'Optionnel : déduit du quartier de l\'organisateur si absent' },
          },
        },
        // ── Vote ────────────────────────────────────────────────────────────
        Vote: {
          type: 'object',
          properties: {
            _id:         { type: 'string' },
            titre:       { type: 'string', example: 'Faut-il un banc dans le parc ?' },
            description: { type: 'string', nullable: true },
            statut:       { type: 'string', enum: ['ouvert', 'ferme', 'archive'] },
            type_vote:    { type: 'string', enum: ['choix_multiple', 'oui_non', 'classement'] },
            nb_choix_max: { type: 'integer' },
            id_quartier:  { type: 'integer' },
            est_anonyme:  { type: 'boolean' },
            date_debut:   { type: 'string', format: 'date-time', nullable: true },
            date_fin:     { type: 'string', format: 'date-time', nullable: true },
            options: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  _id:     { type: 'string' },
                  libelle: { type: 'string' },
                  ordre:   { type: 'integer' },
                },
              },
            },
          },
        },
        VoteCreate: {
          type: 'object',
          required: ['titre'],
          properties: {
            titre:        { type: 'string' },
            description:  { type: 'string' },
            type_vote:    { type: 'string', enum: ['choix_multiple', 'oui_non', 'classement'], default: 'choix_multiple' },
            nb_choix_max: { type: 'integer', minimum: 1, default: 1 },
            est_anonyme:  { type: 'boolean', default: false },
            date_debut:   { type: 'string', format: 'date-time' },
            date_fin:     { type: 'string', format: 'date-time' },
            id_quartier:  { type: 'integer', description: 'Optionnel : déduit du quartier de l\'auteur si absent' },
            options: {
              description: 'Au moins 2 options (sauf type_vote=oui_non, généré côté serveur)',
              type: 'array', minItems: 2,
              items: {
                type: 'object',
                required: ['libelle'],
                properties: {
                  libelle: { type: 'string' },
                  ordre:   { type: 'integer', default: 0 },
                },
              },
            },
          },
        },
        // ── Contrat ─────────────────────────────────────────────────────────
        Contrat: {
          type: 'object',
          properties: {
            id_contrat:       { type: 'integer' },
            points_echanges:  { type: 'integer', example: 50 },
            statut:           { type: 'string', enum: ['en_attente', 'signe', 'annule', 'termine', 'litige'] },
            id_vendeur:       { type: 'integer', nullable: true },
            id_acheteur:      { type: 'integer', nullable: true },
            id_annonce_mongo: { type: 'string', nullable: true },
            signe_vendeur:    { type: 'boolean' },
            signe_acheteur:   { type: 'boolean' },
            motif_litige:     { type: 'string', nullable: true },
            date_litige:      { type: 'string', format: 'date-time', nullable: true },
            vendeur_nom:      { type: 'string', nullable: true },
            vendeur_prenom:   { type: 'string', nullable: true },
            acheteur_nom:     { type: 'string', nullable: true },
            acheteur_prenom:  { type: 'string', nullable: true },
            date_creation:    { type: 'string', format: 'date-time' },
            date_signature:   { type: 'string', format: 'date-time', nullable: true },
          },
        },
        // ── Conversation (MongoDB) ───────────────────────────────────────────
        Conversation: {
          type: 'object',
          properties: {
            _id:          { type: 'string' },
            participants: { type: 'array', items: { type: 'integer' }, description: 'IDs PostgreSQL' },
            createdAt:    { type: 'string', format: 'date-time' },
          },
        },
        // ── Message (MongoDB) ────────────────────────────────────────────────
        Message: {
          type: 'object',
          properties: {
            _id:          { type: 'string' },
            type:         { type: 'string', enum: ['texte', 'image', 'video', 'fichier'] },
            contenu:      { type: 'string' },
            media_url:    { type: 'string' },
            auteur_id:    { type: 'integer' },
            signale:      { type: 'boolean' },
            created_at:   { type: 'string', format: 'date-time' },
          },
        },
        // ── Incident (MongoDB) ───────────────────────────────────────────────
        Incident: {
          type: 'object',
          properties: {
            _id:         { type: 'string' },
            titre:       { type: 'string' },
            description: { type: 'string', nullable: true },
            type:        { type: 'string', nullable: true },
            priorite:    { type: 'string', enum: ['basse', 'normale', 'haute', 'critique'] },
            statut:      { type: 'string', enum: ['ouvert', 'en_cours', 'resolu', 'ferme'] },
            created_at:  { type: 'string', format: 'date-time' },
          },
        },
        // ── Transaction ──────────────────────────────────────────────────────
        Transaction: {
          type: 'object',
          properties: {
            id_transaction: { type: 'integer' },
            montant:        { type: 'integer', example: -50, description: 'Négatif = débit, positif = crédit' },
            motif:          { type: 'string' },
            date:           { type: 'string', format: 'date-time' },
          },
        },
        // ── Notification ─────────────────────────────────────────────────────
        Notification: {
          type: 'object',
          properties: {
            id_notification: { type: 'integer' },
            type:            { type: 'string', enum: ['message', 'evenement', 'contrat', 'vote', 'incident', 'systeme'] },
            titre:           { type: 'string' },
            contenu:         { type: 'string', nullable: true },
            id_ressource:    { type: 'string', nullable: true },
            type_ressource:  { type: 'string', nullable: true },
            est_lue:         { type: 'boolean' },
            date_creation:   { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
