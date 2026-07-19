package com.quartio.desktop.service;

import com.quartio.desktop.dao.DatabaseService;
import javafx.scene.Scene;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Map;

public class ThemeService {

    public static final String THEME_VERT  = "Vert (défaut)";
    public static final String THEME_SOMBRE = "Sombre";
    public static final String THEME_BLEU  = "Bleu";

    private static final Map<String, String> THEMES = new LinkedHashMap<>();

    static {
        THEMES.put(THEME_VERT,   "/com/quartio/desktop/theme-default.css");
        THEMES.put(THEME_SOMBRE, "/com/quartio/desktop/theme-dark.css");
        THEMES.put(THEME_BLEU,   "/com/quartio/desktop/theme-blue.css");
    }

    private static final String[] POLICES = {"Segoe UI", "Arial", "Verdana", "Tahoma", "Courier New"};
    private static final int[] TAILLES = {11, 12, 13, 14, 16};

    private final DatabaseService db;
    private Scene scene;

    public ThemeService(DatabaseService db) {
        this.db = db;
    }

    public void setScene(Scene scene) {
        this.scene = scene;
    }

    public Map<String, String> getThemes() {
        return THEMES;
    }

    public String[] getPolices() {
        return POLICES;
    }

    public int[] getTailles() {
        return TAILLES;
    }

    public String getThemeActuel() {
        return lireConfig("theme", THEME_VERT);
    }

    public String getPoliceActuelle() {
        return lireConfig("police", "Segoe UI");
    }

    public int getTailleActuelle() {
        return Integer.parseInt(lireConfig("taille_police", "13"));
    }

    public void appliquerTheme(String nomTheme) {
        if (scene == null) return;
        sauvegarderConfig("theme", nomTheme);

        scene.getStylesheets().clear();

        String cssPath = THEMES.getOrDefault(nomTheme, THEMES.get(THEME_VERT));
        String url = getClass().getResource(cssPath).toExternalForm();
        scene.getStylesheets().add(url);
    }

    public void appliquerPolice(String police) {
        if (scene == null) return;
        sauvegarderConfig("police", police);
        appliquerStyleInline(scene, police, getTailleActuelle());
    }

    public void appliquerTaille(int taille) {
        if (scene == null) return;
        sauvegarderConfig("taille_police", String.valueOf(taille));
        appliquerStyleInline(scene, getPoliceActuelle(), taille);
    }

    public void restaurerPreferences() {
        if (scene == null) return;
        appliquerTheme(getThemeActuel());
        appliquerStyleInline(scene, getPoliceActuelle(), getTailleActuelle());
    }

    private void appliquerStyleInline(Scene scene, String police, int taille) {
        scene.getRoot().setStyle(
                "-fx-font-family: \"%s\"; -fx-font-size: %dpx;".formatted(police, taille));
    }

    private String lireConfig(String cle, String defaut) {
        String sql = "SELECT valeur FROM config WHERE cle = ?";
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, cle);
            ResultSet rs = ps.executeQuery();
            return rs.next() ? rs.getString("valeur") : defaut;
        } catch (SQLException e) {
            return defaut;
        }
    }

    private void sauvegarderConfig(String cle, String valeur) {
        String sql = "MERGE INTO config (cle, valeur) KEY(cle) VALUES (?, ?)";
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, cle);
            ps.setString(2, valeur);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Erreur sauvegarde config " + cle, e);
        }
    }
}
