const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API REST — Projet Annuel',
      version: '1.0.0',
      description: 'API de gestion de quartier — PostgreSQL + MongoDB + Neo4j',
    },
    servers: [{ url: 'http://localhost:3000', description: 'Serveur local' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
