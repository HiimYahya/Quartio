package com.quartio.desktop.dao;

import com.quartio.desktop.model.Voisin;

import java.sql.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class VoisinDAO {

    private final DatabaseService db;

    public VoisinDAO(DatabaseService db) {
        this.db = db;
    }

    public List<Voisin> findAll() {
        List<Voisin> voisins = new ArrayList<>();
        String sql = """
            SELECT *, CASE WHEN points_solde > 0 THEN points_solde
                          ELSE (nb_incidents_signales + nb_alertes_signalees
                              + nb_evenements_participes * 2 + nb_services_rendus * 3)
                     END AS score
            FROM voisins
            ORDER BY score DESC, derniere_activite DESC
        """;
        try (Connection conn = db.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) voisins.add(map(rs));
        } catch (SQLException e) {
            throw new RuntimeException("Erreur lecture voisins", e);
        }
        return voisins;
    }

    public List<Voisin> findTopParticipants(int limit) {
        List<Voisin> voisins = new ArrayList<>();
        String sql = """
            SELECT *, CASE WHEN points_solde > 0 THEN points_solde
                          ELSE (nb_incidents_signales + nb_alertes_signalees
                              + nb_evenements_participes * 2 + nb_services_rendus * 3)
                     END AS score
            FROM voisins
            ORDER BY score DESC
            LIMIT ?
        """;
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, limit);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) voisins.add(map(rs));
        } catch (SQLException e) {
            throw new RuntimeException("Erreur lecture top participants", e);
        }
        return voisins;
    }

    public void save(Voisin voisin) {
        if (voisin.getId() == null) {
            voisin.setId("local_" + UUID.randomUUID().toString().substring(0, 8));
        }
        String sql = """
            MERGE INTO voisins (id, nom, prenom, email, telephone, role, langue, date_inscription,
                nb_incidents_signales, nb_alertes_signalees,
                nb_evenements_participes, nb_services_rendus, points_solde,
                derniere_activite, updated_at, est_synchronise)
            KEY(id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, voisin.getId());
            ps.setString(2, voisin.getNom());
            ps.setString(3, voisin.getPrenom());
            ps.setString(4, voisin.getEmail());
            ps.setString(5, voisin.getTelephone());
            ps.setString(6, voisin.getRole());
            ps.setString(7, voisin.getLangue());
            ps.setTimestamp(8, voisin.getDateInscription() != null
                    ? Timestamp.valueOf(voisin.getDateInscription()) : null);
            ps.setInt(9, voisin.getNbIncidentsSignales());
            ps.setInt(10, voisin.getNbAlertesSignalees());
            ps.setInt(11, voisin.getNbEvenementsParticipes());
            ps.setInt(12, voisin.getNbServicesRendus());
            ps.setInt(13, voisin.getPointsSolde());
            ps.setTimestamp(14, voisin.getDerniereActivite() != null
                    ? Timestamp.valueOf(voisin.getDerniereActivite()) : null);
            ps.setTimestamp(15, Timestamp.valueOf(voisin.getUpdatedAt()));
            ps.setBoolean(16, voisin.isEstSynchronise());
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Erreur sauvegarde voisin", e);
        }
    }

    public void mettreAJourNbIncidents(String idVoisin, int nbIncidents) {
        String sql = "UPDATE voisins SET nb_incidents_signales = ? WHERE id = ?";
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, nbIncidents);
            ps.setString(2, idVoisin);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Erreur mise à jour nb incidents voisin", e);
        }
    }

    public void deleteAllSynchronises() {
        String sql = "DELETE FROM voisins WHERE est_synchronise = TRUE OR id NOT LIKE 'local_%'";
        try (Connection conn = db.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.executeUpdate(sql);
        } catch (SQLException e) {
            throw new RuntimeException("Erreur suppression voisins synchronisés", e);
        }
    }

    public long countTotal() {
        String sql = "SELECT COUNT(*) FROM voisins";
        try (Connection conn = db.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            return rs.next() ? rs.getLong(1) : 0;
        } catch (SQLException e) {
            throw new RuntimeException("Erreur comptage voisins", e);
        }
    }

    public long countActifs() {
        String sql = """
            SELECT COUNT(*) FROM voisins
            WHERE (nb_incidents_signales + nb_alertes_signalees
                + nb_evenements_participes + nb_services_rendus) > 0
        """;
        try (Connection conn = db.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            return rs.next() ? rs.getLong(1) : 0;
        } catch (SQLException e) {
            throw new RuntimeException("Erreur comptage voisins actifs", e);
        }
    }

    public double moyenneScore() {
        String sql = "SELECT AVG(points_solde) FROM voisins";
        try (Connection conn = db.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            return rs.next() ? rs.getDouble(1) : 0.0;
        } catch (SQLException e) {
            throw new RuntimeException("Erreur calcul moyenne score", e);
        }
    }

    private Voisin map(ResultSet rs) throws SQLException {
        Voisin v = new Voisin();
        v.setId(rs.getString("id"));
        v.setNom(rs.getString("nom"));
        v.setPrenom(rs.getString("prenom"));
        v.setEmail(rs.getString("email"));
        v.setTelephone(rs.getString("telephone"));
        v.setRole(rs.getString("role"));
        v.setLangue(rs.getString("langue"));
        Timestamp dateInscription = rs.getTimestamp("date_inscription");
        if (dateInscription != null) v.setDateInscription(dateInscription.toLocalDateTime());
        v.setNbIncidentsSignales(rs.getInt("nb_incidents_signales"));
        v.setNbAlertesSignalees(rs.getInt("nb_alertes_signalees"));
        v.setNbEvenementsParticipes(rs.getInt("nb_evenements_participes"));
        v.setNbServicesRendus(rs.getInt("nb_services_rendus"));
        v.setPointsSolde(rs.getInt("points_solde"));
        Timestamp derniereActivite = rs.getTimestamp("derniere_activite");
        if (derniereActivite != null) v.setDerniereActivite(derniereActivite.toLocalDateTime());
        Timestamp updatedAt = rs.getTimestamp("updated_at");
        if (updatedAt != null) v.setUpdatedAt(updatedAt.toLocalDateTime());
        v.setEstSynchronise(rs.getBoolean("est_synchronise"));
        return v;
    }
}
