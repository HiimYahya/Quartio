package com.quartio.desktop.controller;

import com.quartio.desktop.dao.DatabaseService;
import com.quartio.desktop.service.AuthService;
import javafx.application.Platform;
import javafx.fxml.FXML;
import javafx.scene.control.*;
import javafx.scene.layout.VBox;

import java.util.function.Consumer;

public class LoginController {

    @FXML private VBox panelLogin;
    @FXML private VBox panelMfa;

    @FXML private TextField fieldEmail;
    @FXML private PasswordField fieldPassword;
    @FXML private TextField fieldOtp;

    @FXML private Label labelErreur;
    @FXML private Label labelErreurMfa;
    @FXML private Button btnOffline;

    private AuthService authService;
    private Consumer<Boolean> onAuthComplete;

    @FXML
    public void initialize() {
        authService = new AuthService(DatabaseService.getInstance());
    }

    public void setOnAuthComplete(Consumer<Boolean> callback) {
        this.onAuthComplete = callback;
    }

    public AuthService getAuthService() {
        return authService;
    }

    @FXML
    private void onLogin() {
        String email = fieldEmail.getText().trim();
        String mdp   = fieldPassword.getText();

        if (email.isBlank() || mdp.isBlank()) {
            labelErreur.setText("Veuillez remplir tous les champs.");
            return;
        }

        labelErreur.setText("Connexion en cours...");
        setFormDisable(true);

        Thread.ofVirtual().start(() -> {
            AuthService.LoginResultat resultat = authService.login(email, mdp);
            Platform.runLater(() -> {
                setFormDisable(false);
                switch (resultat) {
                    case OK -> {
                        if (onAuthComplete != null) onAuthComplete.accept(true);
                    }
                    case MFA_REQUIS -> {
                        labelErreur.setText("");
                        afficherPanelMfa();
                    }
                    case IDENTIFIANTS_INVALIDES ->
                        labelErreur.setText("Email ou mot de passe incorrect.");
                    case ACCES_REFUSE ->
                        labelErreur.setText("Accès refusé. Seuls les admins et modérateurs peuvent se connecter.");
                    case ERREUR_RESEAU ->
                        labelErreur.setText("Impossible de joindre le serveur. Utilisez le mode hors ligne.");
                }
            });
        });
    }

    @FXML
    private void onValiderMfa() {
        String otp = fieldOtp.getText().trim();
        if (otp.isBlank()) {
            labelErreurMfa.setText("Veuillez saisir le code OTP.");
            return;
        }

        labelErreurMfa.setText("Vérification...");
        String email = fieldEmail.getText().trim();

        Thread.ofVirtual().start(() -> {
            AuthService.LoginResultat resultat = authService.validerMfa(email, otp);
            Platform.runLater(() -> {
                switch (resultat) {
                    case OK -> {
                        if (onAuthComplete != null) onAuthComplete.accept(true);
                    }
                    case IDENTIFIANTS_INVALIDES ->
                        labelErreurMfa.setText("Code OTP incorrect ou expiré.");
                    default ->
                        labelErreurMfa.setText("Erreur lors de la vérification.");
                }
            });
        });
    }

    @FXML
    private void onRetourLogin() {
        panelMfa.setVisible(false);
        panelMfa.setManaged(false);
        panelLogin.setVisible(true);
        panelLogin.setManaged(true);
        labelErreur.setText("");
        fieldOtp.clear();
    }

    @FXML
    private void onModeHorsLigne() {
        Alert confirm = new Alert(Alert.AlertType.CONFIRMATION);
        confirm.setTitle("Mode hors ligne");
        confirm.setHeaderText("Continuer sans authentification ?");
        confirm.setContentText("Les données affichées seront celles de la dernière synchronisation.\n" +
                "La synchronisation avec le serveur ne sera pas possible.");
        confirm.showAndWait().ifPresent(btn -> {
            if (btn == ButtonType.OK && onAuthComplete != null) {
                onAuthComplete.accept(false);
            }
        });
    }

    private void afficherPanelMfa() {
        panelLogin.setVisible(false);
        panelLogin.setManaged(false);
        panelMfa.setVisible(true);
        panelMfa.setManaged(true);
        fieldOtp.requestFocus();
    }

    private void setFormDisable(boolean disabled) {
        fieldEmail.setDisable(disabled);
        fieldPassword.setDisable(disabled);
        btnOffline.setDisable(disabled);
    }
}
