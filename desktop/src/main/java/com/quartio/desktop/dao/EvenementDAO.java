package com.quartio.desktop.dao;

import com.quartio.desktop.model.Evenement;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class EvenementDAO {

    private final DatabaseService db;

    public EvenementDAO(DatabaseService db) {
        this.db = db;
    }

    public List<Evenement> findAll() {
        List<Evenement> evenements = new ArrayList<>();
        String sql = "SELECT * FROM evenements ORDER BY date_debut ASC";
        try (Connection conn = db.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) evenements.add(map(rs));
        } catch (SQLException e) {
            throw new RuntimeException("Erreur lecture événements", e);
        }
        return evenements;
    }

    public List<Evenement> findAVenir() {
        List<Evenement> evenements = new ArrayList<>();
        String sql = "SELECT * FROM evenements WHERE date_debut >= NOW() ORDER BY date_debut ASC";
        try (Connection conn = db.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) evenements.add(map(rs));
        } catch (SQLException e) {
            throw new RuntimeException("Erreur lecture événements à venir", e);
        }
        return evenements;
    }

    public void save(Evenement e) {
        if (e.getId() == null) {
            e.setId("evt_" + UUID.randomUUID().toString().substring(0, 8));
        }
        if (e.getUpdatedAt() == null) e.setUpdatedAt(java.time.LocalDateTime.now());
        String sql = """
            MERGE INTO evenements (id, titre, description, type, date_debut, date_fin, lieu,
                nb_participants, id_utilisateur_pg, created_at, updated_at, est_synchronise)
            KEY(id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, e.getId());
            ps.setString(2, e.getTitre());
            ps.setString(3, e.getDescription());
            ps.setString(4, e.getType() != null ? e.getType().name() : "AUTRE");
            ps.setTimestamp(5, e.getDateDebut() != null ? Timestamp.valueOf(e.getDateDebut()) : null);
            ps.setTimestamp(6, e.getDateFin() != null ? Timestamp.valueOf(e.getDateFin()) : null);
            ps.setString(7, e.getLieu());
            ps.setInt(8, e.getNbParticipants());
            ps.setInt(9, e.getIdUtilisateurPg());
            ps.setTimestamp(10, Timestamp.valueOf(e.getCreatedAt()));
            ps.setTimestamp(11, Timestamp.valueOf(e.getUpdatedAt()));
            ps.setBoolean(12, e.isEstSynchronise());
            ps.executeUpdate();
        } catch (SQLException ex) {
            throw new RuntimeException("Erreur sauvegarde événement", ex);
        }
    }

    public List<Evenement> findNonSynchronises() {
        List<Evenement> list = new ArrayList<>();
        String sql = "SELECT * FROM evenements WHERE est_synchronise = FALSE";
        try (Connection conn = db.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) list.add(map(rs));
        } catch (SQLException e) {
            throw new RuntimeException("Erreur lecture événements non sync", e);
        }
        return list;
    }

    public void deleteAllSynchronises() {
        String sql = "DELETE FROM evenements WHERE est_synchronise = TRUE OR id NOT LIKE 'evt_%'";
        try (Connection conn = db.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.executeUpdate(sql);
        } catch (SQLException e) {
            throw new RuntimeException("Erreur suppression événements synchronisés", e);
        }
    }

    public void updateIdEtSynchronise(String ancienId, String nouvelId) {
        String sql = "UPDATE evenements SET id = ?, est_synchronise = TRUE WHERE id = ?";
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, nouvelId);
            ps.setString(2, ancienId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Erreur mise à jour id événement", e);
        }
    }

    public void marquerSynchronises(List<String> ids) {
        if (ids.isEmpty()) return;
        String placeholders = String.join(",", java.util.Collections.nCopies(ids.size(), "?"));
        String sql = "UPDATE evenements SET est_synchronise = TRUE WHERE id IN (" + placeholders + ")";
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            for (int i = 0; i < ids.size(); i++) ps.setString(i + 1, ids.get(i));
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Erreur marquage événements synchronisés", e);
        }
    }

    private Evenement map(ResultSet rs) throws SQLException {
        Evenement e = new Evenement();
        e.setId(rs.getString("id"));
        e.setTitre(rs.getString("titre"));
        e.setDescription(rs.getString("description"));
        String type = rs.getString("type");
        if (type != null) {
            try { e.setType(Evenement.Type.valueOf(type.toUpperCase())); }
            catch (IllegalArgumentException ignored) { e.setType(Evenement.Type.AUTRE); }
        }
        Timestamp debut = rs.getTimestamp("date_debut");
        if (debut != null) e.setDateDebut(debut.toLocalDateTime());
        Timestamp fin = rs.getTimestamp("date_fin");
        if (fin != null) e.setDateFin(fin.toLocalDateTime());
        e.setLieu(rs.getString("lieu"));
        e.setNbParticipants(rs.getInt("nb_participants"));
        e.setIdUtilisateurPg(rs.getInt("id_utilisateur_pg"));
        Timestamp created = rs.getTimestamp("created_at");
        if (created != null) e.setCreatedAt(created.toLocalDateTime());
        Timestamp updated = rs.getTimestamp("updated_at");
        if (updated != null) e.setUpdatedAt(updated.toLocalDateTime());
        e.setEstSynchronise(rs.getBoolean("est_synchronise"));
        return e;
    }
}
