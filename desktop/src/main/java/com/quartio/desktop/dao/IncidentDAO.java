package com.quartio.desktop.dao;

import com.quartio.desktop.model.Incident;

import java.sql.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class IncidentDAO {

    private final DatabaseService db;

    public IncidentDAO(DatabaseService db) {
        this.db = db;
    }

    public List<Incident> findAll() {
        List<Incident> incidents = new ArrayList<>();
        String sql = "SELECT * FROM incidents ORDER BY priorite DESC, date_signalement DESC";
        try (Connection conn = db.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                incidents.add(map(rs));
            }
        } catch (SQLException e) {
            throw new RuntimeException("Erreur lecture incidents", e);
        }
        return incidents;
    }

    public List<Incident> findNonSynchronises() {
        List<Incident> incidents = new ArrayList<>();
        String sql = "SELECT * FROM incidents WHERE est_synchronise = FALSE";
        try (Connection conn = db.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                incidents.add(map(rs));
            }
        } catch (SQLException e) {
            throw new RuntimeException("Erreur lecture incidents non synchronisés", e);
        }
        return incidents;
    }

    public List<Incident> findModifiesDepuis(LocalDateTime depuis) {
        List<Incident> incidents = new ArrayList<>();
        String sql = "SELECT * FROM incidents WHERE updated_at > ?";
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setTimestamp(1, Timestamp.valueOf(depuis));
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                incidents.add(map(rs));
            }
        } catch (SQLException e) {
            throw new RuntimeException("Erreur lecture incidents modifiés", e);
        }
        return incidents;
    }

    public void save(Incident incident) {
        if (incident.getId() == null) {
            incident.setId("local_" + UUID.randomUUID().toString().substring(0, 8));
        }
        String sql = """
            MERGE INTO incidents (id, titre, description, type, statut, priorite,
                commentaire_admin, id_utilisateur_pg, date_signalement, date_resolution, updated_at, est_synchronise)
            KEY(id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, incident.getId());
            ps.setString(2, incident.getTitre());
            ps.setString(3, incident.getDescription());
            ps.setString(4, incident.getType() != null ? incident.getType().name() : null);
            ps.setString(5, incident.getStatut().name());
            ps.setInt(6, incident.getPriorite());
            ps.setString(7, incident.getCommentaireAdmin());
            ps.setInt(8, incident.getIdUtilisateurPg());
            ps.setTimestamp(9, Timestamp.valueOf(incident.getDateSignalement()));
            ps.setTimestamp(10, incident.getDateResolution() != null ? Timestamp.valueOf(incident.getDateResolution()) : null);
            ps.setTimestamp(11, Timestamp.valueOf(incident.getUpdatedAt()));
            ps.setBoolean(12, incident.isEstSynchronise());
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Erreur sauvegarde incident", e);
        }
    }

    public void updateStatut(String id, Incident.Statut statut, String commentaire) {
        String sql = """
            UPDATE incidents
            SET statut = ?, commentaire_admin = ?, updated_at = ?, est_synchronise = FALSE,
                date_resolution = CASE WHEN ? IN ('RESOLU', 'REJETE') THEN NOW() ELSE date_resolution END
            WHERE id = ?
        """;
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, statut.name());
            ps.setString(2, commentaire);
            ps.setTimestamp(3, Timestamp.valueOf(LocalDateTime.now()));
            ps.setString(4, statut.name());
            ps.setString(5, id);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Erreur mise à jour statut", e);
        }
    }

    public void updateComplet(String id, String titre, String description,
                              Incident.Statut statut, String commentaire) {
        String sql = """
            UPDATE incidents
            SET titre = ?, description = ?, statut = ?, commentaire_admin = ?,
                updated_at = ?, est_synchronise = FALSE,
                date_resolution = CASE WHEN ? IN ('RESOLU', 'REJETE') THEN NOW() ELSE date_resolution END
            WHERE id = ?
        """;
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, titre);
            ps.setString(2, description);
            ps.setString(3, statut.name());
            ps.setString(4, commentaire);
            ps.setTimestamp(5, Timestamp.valueOf(LocalDateTime.now()));
            ps.setString(6, statut.name());
            ps.setString(7, id);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Erreur mise à jour incident", e);
        }
    }

    public void updateIdEtSynchronise(String ancienId, String nouvelId) {
        String sql = "UPDATE incidents SET id = ?, est_synchronise = TRUE WHERE id = ?";
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, nouvelId);
            ps.setString(2, ancienId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Erreur mise à jour id incident", e);
        }
    }

    public void marquerSynchronises(List<String> ids) {
        if (ids.isEmpty()) return;
        String placeholders = String.join(",", java.util.Collections.nCopies(ids.size(), "?"));
        String sql = "UPDATE incidents SET est_synchronise = TRUE WHERE id IN (" + placeholders + ")";
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            for (int i = 0; i < ids.size(); i++) {
                ps.setString(i + 1, ids.get(i));
            }
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Erreur marquage synchronisés", e);
        }
    }

    public int countByUtilisateur(int idUtilisateurPg) {
        String sql = "SELECT COUNT(*) FROM incidents WHERE id_utilisateur_pg = ?";
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, idUtilisateurPg);
            ResultSet rs = ps.executeQuery();
            return rs.next() ? rs.getInt(1) : 0;
        } catch (SQLException e) {
            throw new RuntimeException("Erreur comptage incidents par utilisateur", e);
        }
    }

    public long countByStatut(Incident.Statut statut) {
        String sql = "SELECT COUNT(*) FROM incidents WHERE statut = ?";
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, statut.name());
            ResultSet rs = ps.executeQuery();
            return rs.next() ? rs.getLong(1) : 0;
        } catch (SQLException e) {
            throw new RuntimeException("Erreur comptage incidents", e);
        }
    }

    private Incident map(ResultSet rs) throws SQLException {
        Incident i = new Incident();
        i.setId(rs.getString("id"));
        i.setTitre(rs.getString("titre"));
        i.setDescription(rs.getString("description"));
        String type = rs.getString("type");
        if (type != null) i.setType(Incident.Type.valueOf(type));
        i.setStatut(Incident.Statut.valueOf(rs.getString("statut")));
        i.setPriorite(rs.getInt("priorite"));
        i.setCommentaireAdmin(rs.getString("commentaire_admin"));
        i.setIdUtilisateurPg(rs.getInt("id_utilisateur_pg"));
        Timestamp dateSignal = rs.getTimestamp("date_signalement");
        if (dateSignal != null) i.setDateSignalement(dateSignal.toLocalDateTime());
        Timestamp dateResol = rs.getTimestamp("date_resolution");
        if (dateResol != null) i.setDateResolution(dateResol.toLocalDateTime());
        Timestamp updatedAt = rs.getTimestamp("updated_at");
        if (updatedAt != null) i.setUpdatedAt(updatedAt.toLocalDateTime());
        i.setEstSynchronise(rs.getBoolean("est_synchronise"));
        return i;
    }
}
