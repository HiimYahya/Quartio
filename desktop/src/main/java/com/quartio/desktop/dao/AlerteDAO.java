package com.quartio.desktop.dao;

import com.quartio.desktop.model.Alerte;

import java.sql.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

public class AlerteDAO {

    private final DatabaseService db;

    public AlerteDAO(DatabaseService db) {
        this.db = db;
    }

    public List<Alerte> findAll() {
        List<Alerte> alertes = new ArrayList<>();
        String sql = "SELECT * FROM alertes ORDER BY niveau DESC, date_creation DESC";
        try (Connection conn = db.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                alertes.add(map(rs));
            }
        } catch (SQLException e) {
            throw new RuntimeException("Erreur lecture alertes", e);
        }
        return alertes;
    }

    public List<Alerte> findActives() {
        List<Alerte> alertes = new ArrayList<>();
        String sql = "SELECT * FROM alertes WHERE statut = 'ACTIVE' ORDER BY niveau DESC, date_creation DESC";
        try (Connection conn = db.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                alertes.add(map(rs));
            }
        } catch (SQLException e) {
            throw new RuntimeException("Erreur lecture alertes actives", e);
        }
        return alertes;
    }

    public List<Alerte> findNonSynchronisees() {
        List<Alerte> alertes = new ArrayList<>();
        String sql = "SELECT * FROM alertes WHERE est_synchronise = FALSE";
        try (Connection conn = db.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                alertes.add(map(rs));
            }
        } catch (SQLException e) {
            throw new RuntimeException("Erreur lecture alertes non synchronisées", e);
        }
        return alertes;
    }

    public void save(Alerte alerte) {
        if (alerte.getId() == null) {
            alerte.setId("local_" + UUID.randomUUID().toString().substring(0, 8));
        }
        String sql = """
            MERGE INTO alertes (id, titre, description, niveau, statut, signale_par,
                date_creation, date_acquittement, updated_at, est_synchronise)
            KEY(id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, alerte.getId());
            ps.setString(2, alerte.getTitre());
            ps.setString(3, alerte.getDescription());
            ps.setString(4, alerte.getNiveau().name());
            ps.setString(5, alerte.getStatut().name());
            ps.setString(6, alerte.getSignalePar());
            ps.setTimestamp(7, Timestamp.valueOf(alerte.getDateCreation()));
            ps.setTimestamp(8, alerte.getDateAcquittement() != null ? Timestamp.valueOf(alerte.getDateAcquittement()) : null);
            ps.setTimestamp(9, Timestamp.valueOf(alerte.getUpdatedAt()));
            ps.setBoolean(10, alerte.isEstSynchronise());
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Erreur sauvegarde alerte", e);
        }
    }

    public void updateStatut(String id, Alerte.Statut statut) {
        String sql = """
            UPDATE alertes
            SET statut = ?, updated_at = ?, est_synchronise = FALSE,
                date_acquittement = CASE WHEN ? = 'ACQUITTEE' THEN NOW() ELSE date_acquittement END
            WHERE id = ?
        """;
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, statut.name());
            ps.setTimestamp(2, Timestamp.valueOf(LocalDateTime.now()));
            ps.setString(3, statut.name());
            ps.setString(4, id);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Erreur mise à jour statut alerte", e);
        }
    }

    public void marquerSynchronisees(List<String> ids) {
        if (ids.isEmpty()) return;
        String placeholders = String.join(",", Collections.nCopies(ids.size(), "?"));
        String sql = "UPDATE alertes SET est_synchronise = TRUE WHERE id IN (" + placeholders + ")";
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            for (int i = 0; i < ids.size(); i++) {
                ps.setString(i + 1, ids.get(i));
            }
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Erreur marquage alertes synchronisées", e);
        }
    }

    public long countByStatut(Alerte.Statut statut) {
        String sql = "SELECT COUNT(*) FROM alertes WHERE statut = ?";
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, statut.name());
            ResultSet rs = ps.executeQuery();
            return rs.next() ? rs.getLong(1) : 0;
        } catch (SQLException e) {
            throw new RuntimeException("Erreur comptage alertes", e);
        }
    }

    public long countByNiveau(Alerte.Niveau niveau) {
        String sql = "SELECT COUNT(*) FROM alertes WHERE niveau = ? AND statut = 'ACTIVE'";
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, niveau.name());
            ResultSet rs = ps.executeQuery();
            return rs.next() ? rs.getLong(1) : 0;
        } catch (SQLException e) {
            throw new RuntimeException("Erreur comptage alertes par niveau", e);
        }
    }

    private Alerte map(ResultSet rs) throws SQLException {
        Alerte a = new Alerte();
        a.setId(rs.getString("id"));
        a.setTitre(rs.getString("titre"));
        a.setDescription(rs.getString("description"));
        a.setNiveau(Alerte.Niveau.valueOf(rs.getString("niveau")));
        a.setStatut(Alerte.Statut.valueOf(rs.getString("statut")));
        a.setSignalePar(rs.getString("signale_par"));
        Timestamp dateCreation = rs.getTimestamp("date_creation");
        if (dateCreation != null) a.setDateCreation(dateCreation.toLocalDateTime());
        Timestamp dateAcq = rs.getTimestamp("date_acquittement");
        if (dateAcq != null) a.setDateAcquittement(dateAcq.toLocalDateTime());
        Timestamp updatedAt = rs.getTimestamp("updated_at");
        if (updatedAt != null) a.setUpdatedAt(updatedAt.toLocalDateTime());
        a.setEstSynchronise(rs.getBoolean("est_synchronise"));
        return a;
    }
}
