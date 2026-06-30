const EventEmitter = require('events');

// Bus d'événements interne de l'application.
// Un controller émet un événement métier (ex: 'contrat.finalise') sans
// connaître ses abonnés. Les modules qui veulent réagir à cet événement
// s'enregistrent dans src/hooks/ - voir src/hooks/index.js.
const appEvents = new EventEmitter();

module.exports = appEvents;
