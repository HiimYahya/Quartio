package com.quartio.desktop;

import com.quartio.desktop.controller.LoginController;
import com.quartio.desktop.controller.MainController;
import com.quartio.desktop.dao.DatabaseService;
import com.quartio.desktop.service.AuthService;
import com.quartio.desktop.service.ThemeService;
import javafx.application.Application;
import javafx.fxml.FXMLLoader;
import javafx.scene.Scene;
import javafx.stage.Stage;

public class App extends Application {

    @Override
    public void start(Stage stage) throws Exception {
        afficherLogin(stage);
    }

    private void afficherLogin(Stage stage) throws Exception {
        FXMLLoader loader = new FXMLLoader(
                getClass().getResource("/com/quartio/desktop/login.fxml"));
        Scene scene = new Scene(loader.load(), 480, 560);

        ThemeService themeService = new ThemeService(DatabaseService.getInstance());
        themeService.setScene(scene);
        themeService.restaurerPreferences();

        LoginController loginController = loader.getController();
        loginController.setOnAuthComplete(authentifie ->
                afficherPrincipal(stage, loginController.getAuthService(), authentifie));

        stage.setTitle("Quartio — Connexion");
        stage.setScene(scene);
        stage.setResizable(false);
        stage.show();
    }

    private void afficherPrincipal(Stage stage, AuthService authService, boolean authentifie) {
        try {
            FXMLLoader loader = new FXMLLoader(
                    getClass().getResource("/com/quartio/desktop/main.fxml"));
            Scene scene = new Scene(loader.load(), 1100, 700);

            MainController controller = loader.getController();
            controller.setAuthService(authService, authentifie);

            stage.setTitle("Quartio — Administration Desktop"
                    + (authentifie ? " (" + authService.getUtilisateurCourant() + ")" : " [Hors ligne]"));
            stage.setScene(scene);
            stage.setResizable(true);
            stage.setMinWidth(900);
            stage.setMinHeight(600);
            stage.setOnCloseRequest(e -> controller.onFermer());
            stage.show();

        } catch (Exception e) {
            throw new RuntimeException("Erreur chargement interface principale", e);
        }
    }

    public static void main(String[] args) {
        launch(args);
    }
}
