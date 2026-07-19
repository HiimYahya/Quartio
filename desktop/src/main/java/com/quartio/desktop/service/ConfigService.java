package com.quartio.desktop.service;

import com.quartio.desktop.dao.DatabaseService;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class ConfigService {

    public static final String DEFAULT_URL = "https://quartio-production-46f3.up.railway.app/api";

    private final DatabaseService db;

    public ConfigService(DatabaseService db) {
        this.db = db;
    }

    public String getBaseUrl() {
        String url = lire("backend_url");
        return (url != null && !url.isBlank()) ? url : DEFAULT_URL;
    }

    public void setBaseUrl(String url) {
        sauvegarder("backend_url", url.trim());
    }

    private String lire(String cle) {
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT valeur FROM config WHERE cle = ?")) {
            ps.setString(1, cle);
            ResultSet rs = ps.executeQuery();
            return rs.next() ? rs.getString("valeur") : null;
        } catch (SQLException e) {
            return null;
        }
    }

    private void sauvegarder(String cle, String valeur) {
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "MERGE INTO config (cle, valeur) KEY(cle) VALUES (?, ?)")) {
            ps.setString(1, cle);
            ps.setString(2, valeur);
            ps.executeUpdate();
        } catch (SQLException ignored) {}
    }
}
