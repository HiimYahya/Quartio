package com.quartio.desktop.dao;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

public class DatabaseService {

    private static final String DB_URL = "jdbc:h2:./quartio_local;AUTO_SERVER=TRUE";
    private static final String DB_USER = "sa";
    private static final String DB_PASS = "";

    private static DatabaseService instance;

    private DatabaseService() {
        initSchema();
    }

    public static synchronized DatabaseService getInstance() {
        if (instance == null) {
            instance = new DatabaseService();
        }
        return instance;
    }

    public Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);
    }

    private void initSchema() {
        try (Connection conn = getConnection(); Statement stmt = conn.createStatement()) {

            stmt.execute("""
                CREATE TABLE IF NOT EXISTS incidents (
                    id              VARCHAR(64) PRIMARY KEY,
                    titre           VARCHAR(255) NOT NULL,
                    description     TEXT,
                    type            VARCHAR(32),
                    statut          VARCHAR(32) DEFAULT 'NOUVEAU',
                    priorite        INT DEFAULT 1,
                    commentaire_admin TEXT,
                    id_utilisateur_pg INT,
                    date_signalement TIMESTAMP NOT NULL,
                    date_resolution  TIMESTAMP,
                    updated_at      TIMESTAMP NOT NULL,
                    est_synchronise BOOLEAN DEFAULT FALSE
                )
            """);

            stmt.execute("""
                CREATE TABLE IF NOT EXISTS evenements (
                    id              VARCHAR(64) PRIMARY KEY,
                    titre           VARCHAR(255) NOT NULL,
                    description     TEXT,
                    type            VARCHAR(32) DEFAULT 'AUTRE',
                    date_debut      TIMESTAMP,
                    date_fin        TIMESTAMP,
                    lieu            VARCHAR(255),
                    nb_participants INT DEFAULT 0,
                    id_utilisateur_pg INT DEFAULT 0,
                    created_at      TIMESTAMP NOT NULL,
                    updated_at      TIMESTAMP,
                    est_synchronise BOOLEAN DEFAULT FALSE
                )
            """);

            stmt.execute("""
                CREATE TABLE IF NOT EXISTS voisins (
                    id                      VARCHAR(64) PRIMARY KEY,
                    nom                     VARCHAR(128) NOT NULL,
                    prenom                  VARCHAR(128) NOT NULL,
                    email                   VARCHAR(255),
                    telephone               VARCHAR(32),
                    role                    VARCHAR(32),
                    langue                  VARCHAR(8),
                    date_inscription        TIMESTAMP,
                    nb_incidents_signales   INT DEFAULT 0,
                    nb_alertes_signalees    INT DEFAULT 0,
                    nb_evenements_participes INT DEFAULT 0,
                    nb_services_rendus      INT DEFAULT 0,
                    points_solde            INT DEFAULT 0,
                    derniere_activite       TIMESTAMP,
                    updated_at              TIMESTAMP NOT NULL,
                    est_synchronise         BOOLEAN DEFAULT FALSE
                )
            """);

            stmt.execute("""
                CREATE TABLE IF NOT EXISTS alertes (
                    id                  VARCHAR(64) PRIMARY KEY,
                    titre               VARCHAR(255) NOT NULL,
                    description         TEXT,
                    niveau              VARCHAR(32) DEFAULT 'INFO',
                    statut              VARCHAR(32) DEFAULT 'ACTIVE',
                    signale_par         VARCHAR(255),
                    date_creation       TIMESTAMP NOT NULL,
                    date_acquittement   TIMESTAMP,
                    updated_at          TIMESTAMP NOT NULL,
                    est_synchronise     BOOLEAN DEFAULT FALSE
                )
            """);

            stmt.execute("""
                CREATE TABLE IF NOT EXISTS sync_log (
                    id              INT AUTO_INCREMENT PRIMARY KEY,
                    date_debut      TIMESTAMP NOT NULL,
                    date_fin        TIMESTAMP,
                    nb_envoyes      INT DEFAULT 0,
                    nb_recus        INT DEFAULT 0,
                    nb_conflits     INT DEFAULT 0,
                    statut          VARCHAR(16) DEFAULT 'EN_COURS',
                    message_erreur  TEXT
                )
            """);

            stmt.execute("""
                CREATE TABLE IF NOT EXISTS config (
                    cle     VARCHAR(64) PRIMARY KEY,
                    valeur  VARCHAR(255)
                )
            """);

            stmt.execute("""
                MERGE INTO config (cle, valeur)
                KEY(cle)
                VALUES ('last_sync_at', '1970-01-01T00:00:00')
            """);

            try {
                stmt.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS id_utilisateur_pg INT");
                stmt.execute("ALTER TABLE voisins ADD COLUMN IF NOT EXISTS points_solde INT DEFAULT 0");
                stmt.execute("ALTER TABLE voisins ADD COLUMN IF NOT EXISTS telephone VARCHAR(32)");
                stmt.execute("ALTER TABLE voisins ADD COLUMN IF NOT EXISTS role VARCHAR(32)");
                stmt.execute("ALTER TABLE voisins ADD COLUMN IF NOT EXISTS langue VARCHAR(8)");
                stmt.execute("ALTER TABLE voisins ADD COLUMN IF NOT EXISTS date_inscription TIMESTAMP");
                stmt.execute("ALTER TABLE evenements ADD COLUMN IF NOT EXISTS id_utilisateur_pg INT DEFAULT 0");
                stmt.execute("ALTER TABLE evenements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP");
                stmt.execute("ALTER TABLE evenements ADD COLUMN IF NOT EXISTS est_synchronise BOOLEAN DEFAULT FALSE");
            } catch (SQLException ignored) {}

            insertDemoDataIfEmpty(stmt);

        } catch (SQLException e) {
            throw new RuntimeException("Erreur d'initialisation de la base locale", e);
        }
    }

    private void insertDemoDataIfEmpty(Statement stmt) throws SQLException {
        var rs = stmt.executeQuery("SELECT COUNT(*) FROM incidents");
        rs.next();
        if (rs.getInt(1) > 0) return;

        stmt.execute("""
            INSERT INTO incidents (id, titre, description, type, statut, priorite,
                commentaire_admin, date_signalement, date_resolution, updated_at, est_synchronise)
            VALUES
            ('inc_001', 'Lampadaire cassé rue Voltaire',
                'Le lampadaire au n°42 est hors service depuis 3 jours. Zone très sombre la nuit.',
                'INFRASTRUCTURE', 'EN_COURS', 2,
                'Équipe technique contactée, intervention prévue cette semaine.',
                DATEADD('DAY',-12,NOW()), NULL, DATEADD('DAY',-2,NOW()), TRUE),

            ('inc_002', 'Tags sur le mur de l''école',
                'Des graffitis sont apparus sur le mur sud de l''école primaire Jules Ferry.',
                'NUISANCE', 'RESOLU', 1,
                'Mur nettoyé par le service municipal le 28/05.',
                DATEADD('DAY',-20,NOW()), DATEADD('DAY',-5,NOW()), DATEADD('DAY',-5,NOW()), TRUE),

            ('inc_003', 'Nid de poule avenue de la République',
                'Grand nid de poule (30cm) avenue de la République, dangereux pour les cyclistes.',
                'INFRASTRUCTURE', 'NOUVEAU', 3,
                NULL, DATEADD('DAY',-3,NOW()), NULL, DATEADD('DAY',-3,NOW()), TRUE),

            ('inc_004', 'Dépôt sauvage parking Leclerc',
                'Des encombrants (canapé, frigo) ont été abandonnés dans le parking du supermarché.',
                'NUISANCE', 'EN_COURS', 2,
                'Signalement transmis à la déchetterie municipale.',
                DATEADD('DAY',-7,NOW()), NULL, DATEADD('DAY',-1,NOW()), TRUE),

            ('inc_005', 'Fuite d''eau rue des Acacias',
                'Une fuite visible sous le trottoir devant le n°18, eau qui remonte depuis 2 jours.',
                'INFRASTRUCTURE', 'RESOLU', 3,
                'Intervention du réseau eau le 30/05. Fuite colmatée.',
                DATEADD('DAY',-15,NOW()), DATEADD('DAY',-8,NOW()), DATEADD('DAY',-8,NOW()), TRUE),

            ('inc_006', 'Bruit de chantier le dimanche',
                'Travaux bruyants le dimanche matin à partir de 7h30 impasse des Roses, contrevient à l''arrêté municipal.',
                'NUISANCE', 'REJETE', 1,
                'Chantier autorisé par dérogation préfectorale temporaire.',
                DATEADD('DAY',-25,NOW()), DATEADD('DAY',-22,NOW()), DATEADD('DAY',-22,NOW()), TRUE),

            ('inc_007', 'Poubelles non ramassées depuis 5 jours',
                'Le bac vert du n°7 au n°23 rue Gambetta n''a pas été collecté depuis mardi.',
                'INFRASTRUCTURE', 'RESOLU', 2,
                'Collecte effectuée en rattrapage le 01/06.',
                DATEADD('DAY',-6,NOW()), DATEADD('DAY',-1,NOW()), DATEADD('DAY',-1,NOW()), TRUE),

            ('inc_008', 'Vitesse excessive rue du Moulin',
                'Les véhicules roulent régulièrement à plus de 60 km/h malgré les 30 km/h. Danger pour les enfants.',
                'SECURITE', 'EN_COURS', 3,
                'Demande de radar pédagogique transmise à la mairie.',
                DATEADD('DAY',-30,NOW()), NULL, DATEADD('DAY',-10,NOW()), TRUE),

            ('inc_009', 'Jeu de toboggan cassé parc central',
                'La glissière du toboggan présente une arête métallique coupante. Dangereux pour les enfants.',
                'SECURITE', 'RESOLU', 3,
                'Toboggan condamné puis remplacé. Réouverture le 27/05.',
                DATEADD('DAY',-18,NOW()), DATEADD('DAY',-4,NOW()), DATEADD('DAY',-4,NOW()), TRUE),

            ('inc_010', 'Grille d''égout obstruée place de l''Église',
                'Grille bouchée par des feuilles, provoque des inondations à chaque pluie.',
                'INFRASTRUCTURE', 'NOUVEAU', 2,
                NULL, DATEADD('DAY',-2,NOW()), NULL, DATEADD('DAY',-2,NOW()), TRUE),

            ('inc_011', 'Câble électrique pendant allée des Pins',
                'Un câble basse tension pend à 1,80m de hauteur après la tempête du 28/05. Risque électrique.',
                'SECURITE', 'EN_COURS', 3,
                'ENEDIS contacté, intervention programmée demain matin.',
                DATEADD('DAY',-4,NOW()), NULL, DATEADD('DAY',-4,NOW()), TRUE),

            ('inc_012', 'Stationnement gênant devant PMR',
                'Une voiture occupe quotidiennement la place réservée PMR devant la pharmacie.',
                'NUISANCE', 'NOUVEAU', 1,
                NULL, DATEADD('DAY',-1,NOW()), NULL, DATEADD('DAY',-1,NOW()), TRUE),

            ('inc_013', 'Banc cassé square Ronsard',
                'Le banc central du square est cassé, une planche peut provoquer des blessures.',
                'INFRASTRUCTURE', 'RESOLU', 1,
                'Banc remplacé par les services techniques le 31/05.',
                DATEADD('DAY',-22,NOW()), DATEADD('DAY',-2,NOW()), DATEADD('DAY',-2,NOW()), TRUE),

            ('inc_014', 'Vandalisme cabine téléphonique',
                'La cabine téléphonique de la gare a été vandalisée, vitres brisées, téléphone arraché.',
                'SECURITE', 'EN_COURS', 2,
                'Plainte déposée. Opérateur informé pour remplacement.',
                DATEADD('DAY',-9,NOW()), NULL, DATEADD('DAY',-9,NOW()), TRUE),

            ('local_a1b2', 'Bruit excessif cette nuit',
                'Fête bruyante jusqu''à 3h du matin au n°15 rue des Lilas. Musique forte, voisins excédés.',
                'NUISANCE', 'NOUVEAU', 2,
                NULL, NOW(), NULL, NOW(), FALSE)
        """);

        stmt.execute("""
            INSERT INTO alertes (id, titre, description, niveau, statut, signale_par,
                date_creation, date_acquittement, updated_at, est_synchronise)
            VALUES
            ('alt_001', 'Incendie signalé rue des Lilas',
                'Fumée visible depuis plusieurs fenêtres du 3ème étage du n°8. Les pompiers ont été appelés.',
                'DANGER', 'ACQUITTEE', 'Marie Dupont',
                DATEADD('DAY',-5,NOW()), DATEADD('DAY',-5,NOW()), DATEADD('DAY',-5,NOW()), TRUE),

            ('alt_002', 'Coupure d''eau demain matin',
                'Travaux réseau : coupure totale entre 9h et 14h dans les rues Voltaire, Hugo et Gambetta.',
                'AVERTISSEMENT', 'ACTIVE', 'Service des eaux',
                DATEADD('DAY',-1,NOW()), NULL, DATEADD('DAY',-1,NOW()), TRUE),

            ('alt_003', 'Individu suspect rôdant autour des voitures',
                'Un individu avec une capuche a été vu en train d''inspecter plusieurs voitures garées rue du Moulin.',
                'DANGER', 'ACTIVE', 'Paul Leroy',
                DATEADD('HOUR',-3,NOW()), NULL, DATEADD('HOUR',-3,NOW()), TRUE),

            ('alt_004', 'Verglas sur le parvis de l''église',
                'Parvis très glissant ce matin, plusieurs personnes ont failli tomber. Attention aux personnes âgées.',
                'AVERTISSEMENT', 'ACQUITTEE', 'Sophie Bernard',
                DATEADD('DAY',-10,NOW()), DATEADD('DAY',-10,NOW()), DATEADD('DAY',-10,NOW()), TRUE),

            ('alt_005', 'Chien errant agressif parc Ronsard',
                'Un berger allemand sans maître est présent depuis ce matin dans le parc. A mordu un jogger.',
                'DANGER', 'ACTIVE', 'Claire Moreau',
                DATEADD('HOUR',-6,NOW()), NULL, DATEADD('HOUR',-6,NOW()), TRUE),

            ('alt_006', 'Résultats collecte alimentaire',
                'La collecte du week-end a permis de récolter 180 kg de denrées. Merci à tous les participants !',
                'INFO', 'ACQUITTEE', 'Association EntrAide',
                DATEADD('DAY',-3,NOW()), DATEADD('DAY',-3,NOW()), DATEADD('DAY',-3,NOW()), TRUE),

            ('alt_007', 'Panne ascenseur résidence Les Tilleuls',
                'L''ascenseur de la résidence est en panne depuis vendredi. Technicien attendu lundi.',
                'AVERTISSEMENT', 'ACTIVE', 'Syndic Les Tilleuls',
                DATEADD('DAY',-2,NOW()), NULL, DATEADD('DAY',-2,NOW()), TRUE),

            ('alt_008', 'Réunion d''urgence jeudi 19h',
                'Réunion convoquée par le conseil de quartier suite aux incidents de la semaine. Salle polyvalente.',
                'INFO', 'ACTIVE', 'Conseil de quartier',
                DATEADD('DAY',-1,NOW()), NULL, DATEADD('DAY',-1,NOW()), TRUE),

            ('alt_009', 'Fuite de gaz suspectée impasse des Roses',
                'Forte odeur de gaz signalée. Les résidents sont invités à évacuer par précaution. GRDF alerté.',
                'DANGER', 'ACQUITTEE', 'Jean Martin',
                DATEADD('DAY',-14,NOW()), DATEADD('DAY',-14,NOW()), DATEADD('DAY',-14,NOW()), TRUE),

            ('local_b3c4', 'Voiture suspecte garée depuis 3 jours',
                'Véhicule avec plaque illisible, stationné devant le n°8 sans bouger. Coffre légèrement ouvert.',
                'AVERTISSEMENT', 'ACTIVE', 'Jean Martin',
                DATEADD('DAY',-3,NOW()), NULL, DATEADD('DAY',-3,NOW()), FALSE)
        """);

        stmt.execute("""
            INSERT INTO voisins (id, nom, prenom, email,
                nb_incidents_signales, nb_alertes_signalees,
                nb_evenements_participes, nb_services_rendus,
                derniere_activite, updated_at, est_synchronise)
            VALUES
            ('voi_001', 'Dupont',   'Marie',    'marie.dupont@email.fr',    5, 2, 8,  3, DATEADD('DAY',-1,NOW()),  NOW(), TRUE),
            ('voi_002', 'Martin',   'Jean',     'jean.martin@email.fr',     3, 1, 4,  1, DATEADD('DAY',-3,NOW()),  NOW(), TRUE),
            ('voi_003', 'Bernard',  'Sophie',   'sophie.b@email.fr',        1, 0, 2,  0, DATEADD('DAY',-7,NOW()),  NOW(), TRUE),
            ('voi_004', 'Leroy',    'Paul',     'paul.leroy@email.fr',      2, 1, 1,  0, DATEADD('DAY',-2,NOW()),  NOW(), TRUE),
            ('voi_005', 'Moreau',   'Claire',   'claire.m@email.fr',        7, 3, 12, 6, NOW(),                    NOW(), TRUE),
            ('voi_006', 'Petit',    'Lucas',    'lucas.petit@email.fr',     0, 0, 1,  0, DATEADD('DAY',-15,NOW()), NOW(), TRUE),
            ('voi_007', 'Roux',     'Isabelle', 'isabelle.roux@email.fr',   4, 1, 6,  2, DATEADD('DAY',-4,NOW()),  NOW(), TRUE),
            ('voi_008', 'Garnier',  'Thomas',   'thomas.g@email.fr',        2, 0, 3,  4, DATEADD('DAY',-5,NOW()),  NOW(), TRUE),
            ('voi_009', 'Faure',    'Nathalie', 'nathalie.f@email.fr',      6, 2, 9,  5, DATEADD('DAY',-1,NOW()),  NOW(), TRUE),
            ('voi_010', 'Blanc',    'Antoine',  'antoine.blanc@email.fr',   1, 0, 0,  0, DATEADD('DAY',-20,NOW()), NOW(), TRUE),
            ('voi_011', 'Chevalier','Emma',     'emma.chev@email.fr',       3, 1, 5,  2, DATEADD('DAY',-6,NOW()),  NOW(), TRUE),
            ('voi_012', 'Mercier',  'David',    'david.mercier@email.fr',   0, 0, 2,  1, DATEADD('DAY',-12,NOW()), NOW(), TRUE)
        """);

        stmt.execute("""
            INSERT INTO evenements (id, titre, description, type,
                date_debut, date_fin, lieu, nb_participants, created_at)
            VALUES
            ('evt_001', 'Réunion de quartier — Budget participatif',
                'Présentation des projets soumis par les habitants. Vote pour les 3 projets retenus.',
                'REUNION',
                DATEADD('DAY', 4, NOW()), DATEADD('HOUR', 2, DATEADD('DAY', 4, NOW())),
                'Salle polyvalente — 12 rue de la Mairie', 24, NOW()),

            ('evt_002', 'Collecte alimentaire mensuelle',
                'Apportez vos conserves, pâtes, riz et produits d''hygiène. Redistribution aux familles dans le besoin.',
                'COLLECTE',
                DATEADD('DAY', 11, NOW()), DATEADD('HOUR', 4, DATEADD('DAY', 11, NOW())),
                'Parking du marché couvert', 18, NOW()),

            ('evt_003', 'Atelier compostage collectif',
                'Initiation gratuite au compostage et au jardinage naturel. Animé par l''association Terre Vivante.',
                'ACTIVITE',
                DATEADD('DAY', 2, NOW()), DATEADD('HOUR', 3, DATEADD('DAY', 2, NOW())),
                'Jardin partagé — allée des Iris', 12, NOW()),

            ('evt_004', 'Grande fête de quartier',
                'Barbecue géant, jeux pour enfants, concert de l''harmonie municipale. Amenez vos chaises et bonne humeur !',
                'FETE',
                DATEADD('DAY', 21, NOW()), DATEADD('HOUR', 6, DATEADD('DAY', 21, NOW())),
                'Place centrale', 87, NOW()),

            ('evt_005', 'Atelier numérique seniors',
                'Apprenez à utiliser les services en ligne : démarches administratives, messagerie, visioconférence.',
                'ACTIVITE',
                DATEADD('DAY', 7, NOW()), DATEADD('HOUR', 2, DATEADD('DAY', 7, NOW())),
                'Médiathèque — salle informatique', 10, NOW()),

            ('evt_006', 'Assemblée générale association',
                'AG annuelle de l''association Connected Neighbours. Bilan 2025, élection du bureau 2026.',
                'REUNION',
                DATEADD('DAY', 14, NOW()), DATEADD('HOUR', 2, DATEADD('DAY', 14, NOW())),
                'Salle polyvalente', 35, NOW()),

            ('evt_007', 'Troc de plantes',
                'Apportez vos boutures, plants et graines en trop et repartez avec de nouvelles variétés.',
                'ACTIVITE',
                DATEADD('DAY', 5, NOW()), DATEADD('HOUR', 3, DATEADD('DAY', 5, NOW())),
                'Parvis de la médiathèque', 22, NOW()),

            ('evt_008', 'Projection — Documentaire environnement',
                'Projection du film « Demain » suivie d''un débat animé par l''éco-quartier.',
                'ACTIVITE',
                DATEADD('DAY', 18, NOW()), DATEADD('HOUR', 3, DATEADD('DAY', 18, NOW())),
                'Cinéma Le Lumière — salle 2', 40, NOW())
        """);
    }

    public void fermer() {
        try (Connection conn = getConnection(); Statement stmt = conn.createStatement()) {
            stmt.execute("SHUTDOWN");
        } catch (SQLException ignored) {}
    }
}
