package com.quartio.desktop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.quartio.desktop.dao.DatabaseService;
import okhttp3.*;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class AuthService {

    private String baseUrl;
    private static final DateTimeFormatter FMT = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    public enum LoginResultat { OK, MFA_REQUIS, IDENTIFIANTS_INVALIDES, ERREUR_RESEAU, ACCES_REFUSE }

    private final DatabaseService db;
    private final OkHttpClient httpClient;
    private final ObjectMapper mapper;

    private String tokenCourant;
    private String utilisateurCourant;
    private int idUtilisateurPg = 0;

    public AuthService(DatabaseService db) {
        this.db = db;
        this.httpClient = new OkHttpClient();
        this.mapper = new ObjectMapper();
        this.baseUrl = new ConfigService(db).getBaseUrl();
        chargerTokenStocke();
    }

    public void setBaseUrl(String url) {
        this.baseUrl = url;
    }

    public LoginResultat login(String email, String motDePasse) {
        ObjectNode body = mapper.createObjectNode();
        body.put("email", email);
        body.put("mot_de_passe", motDePasse);

        try {
            Request request = new Request.Builder()
                    .url(baseUrl + "/auth/login")
                    .post(RequestBody.create(body.toString(),
                            MediaType.parse("application/json")))
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                String json = response.body() != null ? response.body().string() : "";
                JsonNode node = mapper.readTree(json);

                if (response.code() == 200) {
                    String token = node.path("access_token").asText(null);
                    String role  = node.path("utilisateur").path("role").asText("habitant");
                    String nom   = node.path("utilisateur").path("prenom").asText("")
                                 + " " + node.path("utilisateur").path("nom").asText("");
                    String email2 = node.path("utilisateur").path("email").asText(email);
                    this.idUtilisateurPg = node.path("utilisateur").path("id_utilisateur").asInt(0);
                    if (nom.isBlank()) nom = email2;

                    if (!"admin".equalsIgnoreCase(role) && !"moderateur".equalsIgnoreCase(role)) {
                        return LoginResultat.ACCES_REFUSE;
                    }
                    if (token != null && !token.isBlank()) {
                        stockerToken(token, nom.trim());
                        return LoginResultat.OK;
                    }
                }
                if (response.code() == 401 || response.code() == 403) {
                    return response.code() == 403
                            ? LoginResultat.ACCES_REFUSE
                            : LoginResultat.IDENTIFIANTS_INVALIDES;
                }
                return LoginResultat.ERREUR_RESEAU;
            }
        } catch (IOException e) {
            return LoginResultat.ERREUR_RESEAU;
        }
    }

    public LoginResultat validerMfa(String email, String codeOtp) {
        ObjectNode body = mapper.createObjectNode();
        body.put("email", email);
        body.put("otp", codeOtp);

        try {
            Request request = new Request.Builder()
                    .url(baseUrl + "/auth/mfa/verify")
                    .post(RequestBody.create(body.toString(),
                            MediaType.parse("application/json")))
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                String json = response.body() != null ? response.body().string() : "";
                JsonNode node = mapper.readTree(json);

                if (response.code() == 200) {
                    String token = node.path("token").asText(null);
                    if (token != null && !token.isBlank()) {
                        stockerToken(token, email);
                        return LoginResultat.OK;
                    }
                }
                return LoginResultat.IDENTIFIANTS_INVALIDES;
            }
        } catch (IOException e) {
            return LoginResultat.ERREUR_RESEAU;
        }
    }

    public boolean estAuthentifie() {
        return tokenCourant != null && !tokenCourant.isBlank();
    }

    public String getToken() {
        return tokenCourant;
    }

    public String getUtilisateurCourant() {
        return utilisateurCourant;
    }

    public int getIdUtilisateurPg() {
        return idUtilisateurPg;
    }

    public void deconnecter() {
        tokenCourant = null;
        utilisateurCourant = null;
        supprimerConfig("jwt_token");
        supprimerConfig("jwt_user");
        supprimerConfig("jwt_expiry");
    }

    private void stockerToken(String token, String user) {
        this.tokenCourant = token;
        this.utilisateurCourant = user;
        sauvegarderConfig("jwt_token", token);
        sauvegarderConfig("jwt_user", user);
        sauvegarderConfig("jwt_expiry",
                LocalDateTime.now().plusHours(12).format(FMT));
    }

    private void chargerTokenStocke() {
        String token  = lireConfig("jwt_token");
        String user   = lireConfig("jwt_user");
        String expiry = lireConfig("jwt_expiry");

        if (token == null || token.isBlank()) return;

        if (expiry != null) {
            try {
                LocalDateTime exp = LocalDateTime.parse(expiry, FMT);
                if (LocalDateTime.now().isAfter(exp)) {
                    deconnecter();
                    return;
                }
            } catch (Exception ignored) {}
        }

        this.tokenCourant     = token;
        this.utilisateurCourant = user;
    }

    private String lireConfig(String cle) {
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

    private void sauvegarderConfig(String cle, String valeur) {
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "MERGE INTO config (cle, valeur) KEY(cle) VALUES (?, ?)")) {
            ps.setString(1, cle);
            ps.setString(2, valeur);
            ps.executeUpdate();
        } catch (SQLException ignored) {}
    }

    private void supprimerConfig(String cle) {
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "DELETE FROM config WHERE cle = ?")) {
            ps.setString(1, cle);
            ps.executeUpdate();
        } catch (SQLException ignored) {}
    }
}
