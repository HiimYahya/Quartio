package com.quartio.desktop.dao;

import com.quartio.desktop.model.SyncLog;

import java.sql.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class SyncLogDAO {

    private final DatabaseService db;

    public SyncLogDAO(DatabaseService db) {
        this.db = db;
    }

    public int create(SyncLog log) {
        String sql = "INSERT INTO sync_log (date_debut, statut) VALUES (?, ?)";
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setTimestamp(1, Timestamp.valueOf(log.getDateDebut()));
            ps.setString(2, log.getStatut().name());
            ps.executeUpdate();
            ResultSet keys = ps.getGeneratedKeys();
            if (keys.next()) {
                int id = keys.getInt(1);
                log.setId(id);
                return id;
            }
        } catch (SQLException e) {
            throw new RuntimeException("Erreur création sync_log", e);
        }
        return -1;
    }

    public void update(SyncLog log) {
        String sql = """
            UPDATE sync_log
            SET date_fin = ?, nb_envoyes = ?, nb_recus = ?, nb_conflits = ?, statut = ?, message_erreur = ?
            WHERE id = ?
        """;
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setTimestamp(1, log.getDateFin() != null ? Timestamp.valueOf(log.getDateFin()) : null);
            ps.setInt(2, log.getNbEnvoyes());
            ps.setInt(3, log.getNbRecus());
            ps.setInt(4, log.getNbConflits());
            ps.setString(5, log.getStatut().name());
            ps.setString(6, log.getMessageErreur());
            ps.setInt(7, log.getId());
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Erreur mise à jour sync_log", e);
        }
    }

    public List<SyncLog> findRecents(int limit) {
        List<SyncLog> logs = new ArrayList<>();
        String sql = "SELECT * FROM sync_log ORDER BY date_debut DESC LIMIT ?";
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, limit);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                logs.add(map(rs));
            }
        } catch (SQLException e) {
            throw new RuntimeException("Erreur lecture sync_log", e);
        }
        return logs;
    }

    public LocalDateTime getLastSyncAt() {
        String sql = "SELECT valeur FROM config WHERE cle = 'last_sync_at'";
        try (Connection conn = db.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            if (rs.next()) {
                return LocalDateTime.parse(rs.getString("valeur"));
            }
        } catch (SQLException e) {
            throw new RuntimeException("Erreur lecture last_sync_at", e);
        }
        return LocalDateTime.of(1970, 1, 1, 0, 0);
    }

    public void setLastSyncAt(LocalDateTime dateTime) {
        String sql = "MERGE INTO config (cle, valeur) KEY(cle) VALUES ('last_sync_at', ?)";
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, dateTime.toString());
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Erreur mise à jour last_sync_at", e);
        }
    }

    private SyncLog map(ResultSet rs) throws SQLException {
        SyncLog log = new SyncLog();
        log.setId(rs.getInt("id"));
        Timestamp debut = rs.getTimestamp("date_debut");
        if (debut != null) log.setDateDebut(debut.toLocalDateTime());
        Timestamp fin = rs.getTimestamp("date_fin");
        if (fin != null) log.setDateFin(fin.toLocalDateTime());
        log.setNbEnvoyes(rs.getInt("nb_envoyes"));
        log.setNbRecus(rs.getInt("nb_recus"));
        log.setNbConflits(rs.getInt("nb_conflits"));
        log.setStatut(SyncLog.Statut.valueOf(rs.getString("statut")));
        log.setMessageErreur(rs.getString("message_erreur"));
        return log;
    }
}
