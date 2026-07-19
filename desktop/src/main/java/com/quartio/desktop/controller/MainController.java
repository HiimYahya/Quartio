package com.quartio.desktop.controller;

import java.io.File;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.ServiceLoader;

import com.quartio.desktop.App;
import com.quartio.desktop.dao.DatabaseService;
import com.quartio.desktop.dao.EvenementDAO;
import com.quartio.desktop.dao.IncidentDAO;
import com.quartio.desktop.dao.SyncLogDAO;
import com.quartio.desktop.dao.VoisinDAO;
import com.quartio.desktop.model.Evenement;
import com.quartio.desktop.model.Incident;
import com.quartio.desktop.model.SyncLog;
import com.quartio.desktop.model.Voisin;
import com.quartio.desktop.plugin.AnalyseSocialePlugin;
import com.quartio.desktop.plugin.CalendrierPlugin;
import com.quartio.desktop.plugin.ExportPlugin;
import com.quartio.desktop.service.AuthService;
import com.quartio.desktop.service.ConfigService;
import com.quartio.desktop.service.NetworkMonitor;
import com.quartio.desktop.service.SyncService;
import com.quartio.desktop.service.ThemeService;

import javafx.application.Platform;
import javafx.beans.property.SimpleStringProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.fxml.FXML;
import javafx.scene.control.Alert;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonBar;
import javafx.scene.control.ButtonType;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Dialog;
import javafx.scene.control.Label;
import javafx.scene.control.ProgressBar;
import javafx.scene.control.RadioButton;
import javafx.scene.control.Spinner;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableRow;
import javafx.scene.control.TableView;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleGroup;
import javafx.scene.control.cell.PropertyValueFactory;
import javafx.scene.layout.HBox;
import javafx.scene.paint.Color;
import javafx.scene.shape.Circle;
import javafx.stage.FileChooser;

public class MainController {

    @FXML private TableView<Incident> tableIncidents;
    @FXML private TableColumn<Incident, String> colId;
    @FXML private TableColumn<Incident, String> colTitre;
    @FXML private TableColumn<Incident, String> colType;
    @FXML private TableColumn<Incident, String> colStatut;
    @FXML private TableColumn<Incident, String> colPriorite;
    @FXML private TableColumn<Incident, String> colSync;
    @FXML private TextField tfTitreDetail;
    @FXML private TextArea areaDescription;
    @FXML private TextArea areaCommentaire;
    @FXML private ComboBox<Incident.Statut> comboStatut;
    @FXML private Button btnMettreAJour;
    @FXML private Label labelDetail;


    @FXML private TableView<Evenement> tableEvenements;
    @FXML private TableColumn<Evenement, String> colEvtTitre;
    @FXML private TableColumn<Evenement, String> colEvtType;
    @FXML private TableColumn<Evenement, String> colEvtDate;
    @FXML private TableColumn<Evenement, String> colEvtLieu;
    @FXML private TableColumn<Evenement, String> colEvtParticipants;

    @FXML private ToggleGroup toggleTheme;
    @FXML private RadioButton radioThemeVert;
    @FXML private RadioButton radioThemeSombre;
    @FXML private RadioButton radioThemeBleu;
    @FXML private ComboBox<String> comboPolice;
    @FXML private ComboBox<Integer> comboTaille;
    @FXML private TextField fieldBackendUrl;
    @FXML private Label labelTestConnexion;

    @FXML private TableView<Voisin> tableVoisins;
    @FXML private TableColumn<Voisin, String> colVoisinNom;
    @FXML private TableColumn<Voisin, String> colVoisinEmail;
    @FXML private TableColumn<Voisin, String> colVoisinIncidents;
    @FXML private TableColumn<Voisin, String> colVoisinPoints;
    @FXML private TableColumn<Voisin, String> colVoisinNiveau;
    @FXML private Label labelVoisinsTotal;
    @FXML private Label labelVoisinsActifs;
    @FXML private Label labelVoisinsScoreMoyen;

    @FXML private Label labelNbTotal;
    @FXML private Label labelNbNouveau;
    @FXML private Label labelNbEnCours;
    @FXML private Label labelNbResolu;
    @FXML private Label labelNbRejete;
    @FXML private Label labelNonSync;

    @FXML private TableView<SyncLog> tableSyncLog;
    @FXML private TableColumn<SyncLog, String> colSyncDate;
    @FXML private TableColumn<SyncLog, String> colSyncStatut;
    @FXML private TableColumn<SyncLog, String> colSyncResume;
    @FXML private TextArea areaSyncLog;
    @FXML private Button btnSync;
    @FXML private ProgressBar progressSync;

    @FXML private Label labelStatus;
    @FXML private Circle circleConnexion;
    @FXML private Label labelConnexion;
    @FXML private Label labelUtilisateur;
    @FXML private Button btnConnexionAction;

    private IncidentDAO incidentDAO;
    private VoisinDAO voisinDAO;
    private EvenementDAO evenementDAO;
    private ThemeService themeService;
    private ConfigService configService;
    private AuthService authService;
    private boolean modeConnecte = false;
    private SyncLogDAO syncLogDAO;
    private SyncService syncService;
    private NetworkMonitor networkMonitor;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    @FXML
    public void initialize() {
        DatabaseService db = DatabaseService.getInstance();
        incidentDAO = new IncidentDAO(db);
        voisinDAO = new VoisinDAO(db);
        evenementDAO = new EvenementDAO(db);
        syncLogDAO = new SyncLogDAO(db);
        themeService = new ThemeService(db);
        configService = new ConfigService(db);
        syncService = new SyncService(incidentDAO, voisinDAO, evenementDAO, syncLogDAO, configService.getBaseUrl());

        configurerTableIncidents();
        configurerTableSync();
        configurerComboStatut();
        configurerTableVoisins();
        configurerTableEvenements();
        configurerParametres();
        chargerIncidents();
        chargerVoisins();
        chargerEvenements();
        chargerSyncLogs();
        mettreAJourStatistiques();
    }

    private void configurerTableIncidents() {
        colId.setCellValueFactory(new PropertyValueFactory<>("id"));
        colTitre.setCellValueFactory(new PropertyValueFactory<>("titre"));
        colType.setCellValueFactory(c ->
                new SimpleStringProperty(c.getValue().getType() != null ? c.getValue().getType().name() : ""));
        colStatut.setCellValueFactory(c ->
                new SimpleStringProperty(c.getValue().getStatut().name()));
        colPriorite.setCellValueFactory(c ->
                new SimpleStringProperty(c.getValue().getPrioriteLabel()));
        colSync.setCellValueFactory(c ->
                new SimpleStringProperty(c.getValue().isEstSynchronise() ? "✓" : "⏳"));

        tableIncidents.setRowFactory(tv -> new TableRow<>() {
            @Override
            protected void updateItem(Incident item, boolean empty) {
                super.updateItem(item, empty);
                if (item == null || empty) {
                    setStyle("");
                } else {
                    setStyle(switch (item.getStatut()) {
                        case RESOLU  -> "-fx-background-color: #e8f5e9;";
                        case REJETE  -> "-fx-background-color: #fce4ec;";
                        case EN_COURS -> "-fx-background-color: #fff8e1;";
                        default      -> "";
                    });
                }
            }
        });

        tableIncidents.getSelectionModel().selectedItemProperty().addListener(
                (obs, ancien, incident) -> afficherDetailIncident(incident));
    }

    private void afficherDetailIncident(Incident incident) {
        if (incident == null) {
            tfTitreDetail.clear();
            tfTitreDetail.setEditable(false);
            areaDescription.clear();
            areaDescription.setEditable(false);
            areaCommentaire.clear();
            labelDetail.setText("Sélectionnez un incident");
            btnMettreAJour.setDisable(true);
            return;
        }
        labelDetail.setText(incident.isLocal() ? "Incident local (non synchronisé)" : "Détail de l'incident");
        tfTitreDetail.setText(incident.getTitre() != null ? incident.getTitre() : "");
        tfTitreDetail.setEditable(true);
        areaDescription.setText(incident.getDescription() != null ? incident.getDescription() : "");
        areaDescription.setEditable(true);
        areaCommentaire.setText(incident.getCommentaireAdmin() != null ? incident.getCommentaireAdmin() : "");
        comboStatut.setValue(incident.getStatut());
        btnMettreAJour.setDisable(false);
    }

    private void chargerIncidents() {
        List<Incident> incidents = incidentDAO.findAll();
        ObservableList<Incident> obs = FXCollections.observableArrayList(incidents);
        tableIncidents.setItems(obs);
        labelStatus.setText("Incidents chargés : " + incidents.size());
    }

    @FXML
    private void onMettreAJour() {
        Incident selected = tableIncidents.getSelectionModel().getSelectedItem();
        if (selected == null) return;

        String titre = tfTitreDetail.getText().trim();
        String description = areaDescription.getText();
        Incident.Statut nouveauStatut = comboStatut.getValue();
        String commentaire = areaCommentaire.getText();

        if (titre.isBlank()) {
            labelStatus.setText("Le titre ne peut pas être vide.");
            return;
        }

        incidentDAO.updateComplet(selected.getId(), titre, description, nouveauStatut, commentaire);
        chargerIncidents();
        mettreAJourStatistiques();
        labelStatus.setText("Incident mis à jour → " + nouveauStatut);
    }

    @FXML
    private void onNouvelIncident() {
        Dialog<Incident> dialog = new Dialog<>();
        dialog.setTitle("Nouvel incident (hors ligne)");
        dialog.setHeaderText("Créer un incident — sera synchronisé au prochain démarrage");

        ButtonType btnCreer = new ButtonType("Créer", ButtonBar.ButtonData.OK_DONE);
        dialog.getDialogPane().getButtonTypes().addAll(btnCreer, ButtonType.CANCEL);

        TextField tfTitre = new TextField();
        tfTitre.setPromptText("Titre de l'incident");
        TextArea taDescription = new TextArea();
        taDescription.setPromptText("Description");
        taDescription.setPrefRowCount(3);
        ComboBox<Incident.Type> cbType = new ComboBox<>(
                FXCollections.observableArrayList(Incident.Type.values()));
        cbType.setValue(Incident.Type.AUTRE);
        ComboBox<Integer> cbPriorite = new ComboBox<>(
                FXCollections.observableArrayList(1, 2, 3));
        cbPriorite.setValue(1);

        javafx.scene.layout.GridPane grid = new javafx.scene.layout.GridPane();
        grid.setHgap(10); grid.setVgap(10);
        grid.addRow(0, new Label("Titre :"), tfTitre);
        grid.addRow(1, new Label("Type :"), cbType);
        grid.addRow(2, new Label("Priorité :"), cbPriorite);
        grid.addRow(3, new Label("Description :"), taDescription);
        dialog.getDialogPane().setContent(grid);

        dialog.setResultConverter(btn -> {
            if (btn == btnCreer) {
                Incident inc = new Incident(null, tfTitre.getText(), taDescription.getText(),
                        cbType.getValue(), cbPriorite.getValue());
                return inc;
            }
            return null;
        });

        dialog.showAndWait().ifPresent(inc -> {
            incidentDAO.save(inc);
            chargerIncidents();
            mettreAJourStatistiques();
            labelStatus.setText("Incident créé localement : " + inc.getId());
        });
    }

    private void configurerTableVoisins() {
        colVoisinNom.setCellValueFactory(c ->
                new SimpleStringProperty(c.getValue().getNomComplet()));
        colVoisinEmail.setCellValueFactory(c ->
                new SimpleStringProperty(c.getValue().getEmail() != null ? c.getValue().getEmail() : ""));
        colVoisinIncidents.setCellValueFactory(c ->
                new SimpleStringProperty(String.valueOf(c.getValue().getNbIncidentsSignales())));
        colVoisinPoints.setCellValueFactory(c ->
                new SimpleStringProperty(String.valueOf(c.getValue().getPointsSolde())));
        colVoisinNiveau.setCellValueFactory(c ->
                new SimpleStringProperty(c.getValue().getNiveauEngagement()));

        tableVoisins.setRowFactory(tv -> new TableRow<>() {
            @Override
            protected void updateItem(Voisin item, boolean empty) {
                super.updateItem(item, empty);
                if (item == null || empty) {
                    setStyle("");
                } else {
                    setStyle(switch (item.getNiveauEngagement()) {
                        case "Ambassadeur" -> "-fx-background-color: #e8f5e9;";
                        case "Actif"       -> "-fx-background-color: #fff8e1;";
                        default            -> "";
                    });
                }
            }
        });
    }

    private void chargerVoisins() {
        List<Voisin> voisins = voisinDAO.findAll();
        tableVoisins.setItems(FXCollections.observableArrayList(voisins));
        labelVoisinsTotal.setText(String.valueOf(voisinDAO.countTotal()));
        labelVoisinsActifs.setText(String.valueOf(voisinDAO.countActifs()));
        labelVoisinsScoreMoyen.setText(String.format("%.1f", voisinDAO.moyenneScore()));
    }

    private void mettreAJourStatistiques() {
        List<Incident> tous = incidentDAO.findAll();
        long nonSync = tous.stream().filter(i -> !i.isEstSynchronise()).count();

        labelNbTotal.setText(String.valueOf(tous.size()));
        labelNbNouveau.setText(String.valueOf(incidentDAO.countByStatut(Incident.Statut.NOUVEAU)));
        labelNbEnCours.setText(String.valueOf(incidentDAO.countByStatut(Incident.Statut.EN_COURS)));
        labelNbResolu.setText(String.valueOf(incidentDAO.countByStatut(Incident.Statut.RESOLU)));
        labelNbRejete.setText(String.valueOf(incidentDAO.countByStatut(Incident.Statut.REJETE)));
        labelNonSync.setText(String.valueOf(nonSync));

    }

    private void configurerTableSync() {
        colSyncDate.setCellValueFactory(c ->
                new SimpleStringProperty(c.getValue().getDateDebut() != null
                        ? c.getValue().getDateDebut().format(DATE_FMT) : ""));
        colSyncStatut.setCellValueFactory(c ->
                new SimpleStringProperty(c.getValue().getStatut().name()));
        colSyncResume.setCellValueFactory(c ->
                new SimpleStringProperty(c.getValue().getResume()));
    }

    private void chargerSyncLogs() {
        List<SyncLog> logs = syncLogDAO.findRecents(20);
        tableSyncLog.setItems(FXCollections.observableArrayList(logs));
        String lastSync = "Jamais";
        if (!logs.isEmpty() && logs.get(0).getDateDebut() != null) {
            lastSync = logs.get(0).getDateDebut().format(DATE_FMT);
        }
        areaSyncLog.setText("Dernière synchronisation : " + lastSync +
                "\nLast sync at : " + syncLogDAO.getLastSyncAt().format(DATE_FMT));
    }

    @FXML
    private void onSynchroniser() {
        btnSync.setDisable(true);
        progressSync.setVisible(true);
        progressSync.setProgress(ProgressBar.INDETERMINATE_PROGRESS);
        areaSyncLog.clear();

        syncService.synchroniserAsync(msg -> Platform.runLater(() ->
                areaSyncLog.appendText(msg + "\n")
        )).whenComplete((log, erreur) -> Platform.runLater(() -> {
            btnSync.setDisable(false);
            progressSync.setVisible(false);
            if (erreur != null) {
                areaSyncLog.appendText("✗ Erreur inattendue : " + erreur.getMessage() + "\n");
            }
            chargerIncidents();
            chargerVoisins();
            chargerEvenements();
            chargerSyncLogs();
            mettreAJourStatistiques();
        }));
    }

    @FXML
    private void onExporter() {
        List<ExportPlugin> plugins = ServiceLoader.load(ExportPlugin.class)
                .stream()
                .map(ServiceLoader.Provider::get)
                .toList();

        if (plugins.isEmpty()) {
            new Alert(Alert.AlertType.INFORMATION, "Aucun plugin d'export installé.").showAndWait();
            return;
        }

        ExportPlugin plugin = plugins.get(0);

        FileChooser chooser = new FileChooser();
        chooser.setTitle("Exporter les incidents");
        chooser.getExtensionFilters().add(
                new FileChooser.ExtensionFilter(plugin.getNom(), "*." + plugin.getExtension()));
        chooser.setInitialFileName("incidents_export." + plugin.getExtension());

        File file = chooser.showSaveDialog(tableIncidents.getScene().getWindow());
        if (file == null) return;

        try {
            plugin.exporter(incidentDAO.findAll(), file);
            labelStatus.setText("Export réussi : " + file.getAbsolutePath());
            new Alert(Alert.AlertType.INFORMATION, "Fichier exporté avec succès.").showAndWait();
        } catch (ExportPlugin.ExportException e) {
            new Alert(Alert.AlertType.ERROR, "Erreur export : " + e.getMessage()).showAndWait();
        }
    }

    private void demarrerNetworkMonitor() {
        networkMonitor = new NetworkMonitor(
                syncService,
                connecte -> Platform.runLater(() -> mettreAJourIndicateurConnexion(connecte)),
                () -> Platform.runLater(() -> {
                    if (modeConnecte) {
                        areaSyncLog.appendText("Reconnexion détectée → synchronisation automatique...\n");
                        onSynchroniser();
                    }
                })
        );
        networkMonitor.demarrer();
        mettreAJourIndicateurConnexion(false);
    }

    private void mettreAJourIndicateurConnexion(boolean connecte) {
        if (!modeConnecte) {
            circleConnexion.setFill(Color.ORANGE);
            labelConnexion.setText("Non authentifié");
            return;
        }
        circleConnexion.setFill(connecte ? Color.LIMEGREEN : Color.TOMATO);
        labelConnexion.setText(connecte ? "Connecté" : "Hors ligne");
    }

    private void configurerComboStatut() {
        comboStatut.setItems(FXCollections.observableArrayList(Incident.Statut.values()));
        btnMettreAJour.setDisable(true);
    }

    private void configurerTableEvenements() {
        colEvtTitre.setCellValueFactory(new PropertyValueFactory<>("titre"));
        colEvtType.setCellValueFactory(c ->
                new SimpleStringProperty(c.getValue().getType().name()));
        colEvtDate.setCellValueFactory(c ->
                new SimpleStringProperty(c.getValue().getDateDebut() != null
                        ? c.getValue().getDateDebut().format(DATE_FMT) : ""));
        colEvtLieu.setCellValueFactory(c ->
                new SimpleStringProperty(c.getValue().getLieu() != null ? c.getValue().getLieu() : ""));
        colEvtParticipants.setCellValueFactory(c ->
                new SimpleStringProperty(String.valueOf(c.getValue().getNbParticipants())));
    }

    private void chargerEvenements() {
        CalendrierPlugin plugin = ServiceLoader.load(CalendrierPlugin.class)
                .findFirst().orElse(null);
        if (plugin == null) return;
        tableEvenements.setItems(FXCollections.observableArrayList(plugin.getEvenements()));
    }

    @FXML
    private void onNouvelEvenement() {
        CalendrierPlugin plugin = ServiceLoader.load(CalendrierPlugin.class)
                .findFirst().orElse(null);
        if (plugin == null) {
            new Alert(Alert.AlertType.WARNING, "Plugin calendrier non disponible.").showAndWait();
            return;
        }

        Dialog<Evenement> dialog = new Dialog<>();
        dialog.setTitle("Nouvel événement");
        dialog.setHeaderText("Ajouter un événement au calendrier du quartier");

        ButtonType btnCreer = new ButtonType("Créer", ButtonBar.ButtonData.OK_DONE);
        dialog.getDialogPane().getButtonTypes().addAll(btnCreer, ButtonType.CANCEL);

        TextField tfTitre = new TextField();
        tfTitre.setPromptText("Titre de l'événement");
        TextField tfLieu = new TextField();
        tfLieu.setPromptText("Lieu");
        TextArea taDesc = new TextArea();
        taDesc.setPromptText("Description");
        taDesc.setPrefRowCount(4);
        ComboBox<Evenement.Type> cbType = new ComboBox<>(
                FXCollections.observableArrayList(Evenement.Type.values()));
        cbType.setValue(Evenement.Type.AUTRE);

        javafx.scene.control.DatePicker datePicker = new javafx.scene.control.DatePicker(
                java.time.LocalDate.now().plusDays(1));
        datePicker.setDayCellFactory(picker -> new javafx.scene.control.DateCell() {
            @Override
            public void updateItem(java.time.LocalDate date, boolean empty) {
                super.updateItem(date, empty);
                if (date.isBefore(java.time.LocalDate.now().plusDays(1))) {
                    setDisable(true);
                    setStyle("-fx-background-color: #eeeeee; -fx-text-fill: #aaaaaa;");
                }
            }
        });

        Spinner<Integer> spinHeure = new Spinner<>(0, 23, 9);
        spinHeure.setEditable(true);
        spinHeure.setPrefWidth(70);
        bloquerNonNumerique(spinHeure, 0, 23);

        Spinner<Integer> spinMinute = new Spinner<>(0, 59, 0, 15);
        spinMinute.setEditable(true);
        spinMinute.setPrefWidth(70);
        bloquerNonNumerique(spinMinute, 0, 59);

        Label labelErreurEvt = new Label();
        labelErreurEvt.setStyle("-fx-text-fill: #c62828; -fx-font-size: 11px;");

        javafx.scene.Node btnCreerNode = dialog.getDialogPane().lookupButton(btnCreer);
        btnCreerNode.setDisable(true);

        tfTitre.textProperty().addListener((obs, o, n) ->
                btnCreerNode.setDisable(n.trim().isEmpty()));

        javafx.scene.layout.GridPane grid = new javafx.scene.layout.GridPane();
        grid.setHgap(10); grid.setVgap(12);
        grid.setPrefWidth(560);
        javafx.scene.layout.GridPane.setHgrow(tfTitre,  javafx.scene.layout.Priority.ALWAYS);
        javafx.scene.layout.GridPane.setHgrow(tfLieu,   javafx.scene.layout.Priority.ALWAYS);
        javafx.scene.layout.GridPane.setHgrow(taDesc,   javafx.scene.layout.Priority.ALWAYS);
        javafx.scene.layout.GridPane.setVgrow(taDesc,   javafx.scene.layout.Priority.ALWAYS);
        grid.addRow(0, new Label("Titre :"), tfTitre);
        grid.addRow(1, new Label("Type :"), cbType);
        grid.addRow(2, new Label("Date :"), datePicker);
        HBox heureBox = new HBox(6, new Label("h"), spinHeure, new Label("min"), spinMinute);
        heureBox.setAlignment(javafx.geometry.Pos.CENTER_LEFT);
        grid.addRow(3, new Label("Heure :"), heureBox);
        grid.addRow(4, new Label("Lieu :"), tfLieu);
        grid.addRow(5, new Label("Description :"), taDesc);
        grid.addRow(6, new Label(), labelErreurEvt);

        javafx.scene.layout.ColumnConstraints cc = new javafx.scene.layout.ColumnConstraints();
        cc.setHgrow(javafx.scene.layout.Priority.ALWAYS);
        grid.getColumnConstraints().addAll(new javafx.scene.layout.ColumnConstraints(), cc);

        dialog.setResizable(true);
        dialog.getDialogPane().setContent(grid);
        dialog.getDialogPane().setPrefWidth(600);
        dialog.getDialogPane().setPrefHeight(420);

        dialog.setResultConverter(btn -> {
            if (btn != btnCreer) return null;

            java.time.LocalDate date = datePicker.getValue();
            int heure  = spinHeure.getValue();
            int minute = spinMinute.getValue();
            java.time.LocalDateTime dateDebut = date.atTime(heure, minute);

            if (!dateDebut.isAfter(java.time.LocalDateTime.now())) {
                labelErreurEvt.setText("La date doit être dans le futur.");
                return null;
            }

            Evenement evt = new Evenement();
            evt.setTitre(tfTitre.getText().trim());
            evt.setType(cbType.getValue());
            evt.setLieu(tfLieu.getText().trim());
            evt.setDescription(taDesc.getText().trim());
            evt.setDateDebut(dateDebut);
            return evt;
        });

        dialog.showAndWait().ifPresent(evt -> {
            plugin.ajouterEvenement(evt);
            chargerEvenements();
            labelStatus.setText("Événement ajouté : " + evt.getTitre());
        });
    }

    private void bloquerNonNumerique(Spinner<Integer> spinner, int min, int max) {
        spinner.getEditor().textProperty().addListener((obs, ancien, nouveau) -> {
            if (nouveau.isEmpty()) return;
            String filtre = nouveau.replaceAll("[^0-9]", "");
            if (!filtre.equals(nouveau)) {
                spinner.getEditor().setText(filtre);
                return;
            }
            try {
                int val = Integer.parseInt(filtre);
                if (val > max) spinner.getEditor().setText(String.valueOf(max));
                else if (val < min) spinner.getEditor().setText(String.valueOf(min));
            } catch (NumberFormatException ignored) {}
        });
    }

    @FXML
    private void onAnalyseSociale() {
        AnalyseSocialePlugin plugin = ServiceLoader.load(AnalyseSocialePlugin.class)
                .findFirst().orElse(null);
        if (plugin == null) {
            new Alert(Alert.AlertType.WARNING, "Plugin d'analyse sociale non disponible.").showAndWait();
            return;
        }

        AnalyseSocialePlugin.AnalyseResultat resultat = plugin.analyser(voisinDAO.findAll());

        Dialog<Void> dialog = new Dialog<>();
        dialog.setTitle(resultat.titre());
        dialog.setHeaderText(plugin.getNom());
        dialog.getDialogPane().getButtonTypes().add(ButtonType.CLOSE);

        TextArea area = new TextArea(resultat.contenu());
        area.setEditable(false);
        area.setWrapText(false);
        area.setPrefSize(520, 420);
        area.setStyle("-fx-font-family: 'Courier New', monospace; -fx-font-size: 12px;");

        dialog.getDialogPane().setContent(area);
        dialog.showAndWait();
    }

    private void configurerParametres() {
        comboPolice.setItems(FXCollections.observableArrayList(themeService.getPolices()));
        comboPolice.setValue(themeService.getPoliceActuelle());

        var tailles = FXCollections.<Integer>observableArrayList();
        for (int t : themeService.getTailles()) tailles.add(t);
        comboTaille.setItems(tailles);
        comboTaille.setValue(themeService.getTailleActuelle());

        String themeActuel = themeService.getThemeActuel();
        if (ThemeService.THEME_SOMBRE.equals(themeActuel)) radioThemeSombre.setSelected(true);
        else if (ThemeService.THEME_BLEU.equals(themeActuel)) radioThemeBleu.setSelected(true);
        else radioThemeVert.setSelected(true);

        fieldBackendUrl.setText(configService.getBaseUrl());

        radioThemeVert.sceneProperty().addListener((obs, oldScene, newScene) -> {
            if (newScene != null) {
                themeService.setScene(newScene);
                themeService.restaurerPreferences();
            }
        });
    }

    @FXML
    private void onSauvegarderUrl() {
        String url = fieldBackendUrl.getText().trim();
        if (url.isBlank()) {
            labelTestConnexion.setText("⚠ URL vide.");
            return;
        }
        configService.setBaseUrl(url);
        syncService.setBaseUrl(url);
        if (authService != null) authService.setBaseUrl(url);
        labelTestConnexion.setStyle("-fx-text-fill: #2e7d32;");
        labelTestConnexion.setText("✓ URL sauvegardée. Sera utilisée dès la prochaine synchronisation.");
        labelStatus.setText("URL backend mise à jour : " + url);
    }

    @FXML
    private void onTesterConnexion() {
        String url = fieldBackendUrl.getText().trim();
        if (url.isBlank()) {
            labelTestConnexion.setText("⚠ Entrez une URL avant de tester.");
            return;
        }
        labelTestConnexion.setStyle("-fx-text-fill: #757575;");
        labelTestConnexion.setText("Connexion en cours...");

        String testUrl = url;
        Thread.ofVirtual().start(() -> {
            boolean ok = false;
            String message;
            try {
                okhttp3.OkHttpClient client = new okhttp3.OkHttpClient.Builder()
                        .connectTimeout(5, java.util.concurrent.TimeUnit.SECONDS)
                        .readTimeout(5, java.util.concurrent.TimeUnit.SECONDS)
                        .build();
                okhttp3.Request req = new okhttp3.Request.Builder()
                        .url(testUrl + "/health")
                        .get().build();
                try (okhttp3.Response resp = client.newCall(req).execute()) {
                    ok = resp.isSuccessful();
                    message = ok
                            ? "✓ Serveur joignable (HTTP " + resp.code() + ")"
                            : "✗ Serveur répond mais erreur HTTP " + resp.code();
                }
            } catch (Exception e) {
                message = "✗ Impossible de joindre le serveur : " + e.getMessage();
            }
            boolean succes = ok;
            String msg = message;
            Platform.runLater(() -> {
                labelTestConnexion.setStyle(succes
                        ? "-fx-text-fill: #2e7d32;"
                        : "-fx-text-fill: #c62828;");
                labelTestConnexion.setText(msg);
            });
        });
    }

    @FXML
    private void onDesinstaller() {
        Alert confirm = new Alert(Alert.AlertType.WARNING);
        confirm.setTitle("Désinstallation");
        confirm.setHeaderText("Désinstaller Quartio Desktop ?");
        confirm.setContentText(
                "Cette action va :\n" +
                "  • Supprimer la base de données locale (H2)\n" +
                "  • Effacer toutes les données non synchronisées\n" +
                "  • Fermer l'application\n\n" +
                "Cette opération est IRRÉVERSIBLE. Continuer ?"
        );

        ButtonType btnOui = new ButtonType("Oui, désinstaller", ButtonBar.ButtonData.OK_DONE);
        confirm.getButtonTypes().setAll(btnOui, ButtonType.CANCEL);

        confirm.showAndWait().ifPresent(btn -> {
            if (btn != btnOui) return;

            if (networkMonitor != null) networkMonitor.arreter();

            try {
                DatabaseService.getInstance().fermer();
            } catch (Exception ignored) {}

            String[] fichiers = {
                "quartio_local.mv.db",
                "quartio_local.trace.db"
            };
            StringBuilder supprimés = new StringBuilder();
            for (String nom : fichiers) {
                java.io.File f = new java.io.File(nom);
                if (f.exists() && f.delete()) {
                    supprimés.append("  ✓ ").append(nom).append("\n");
                }
            }

            Alert ok = new Alert(Alert.AlertType.INFORMATION);
            ok.setTitle("Désinstallation terminée");
            ok.setHeaderText("Quartio Desktop a été désinstallé.");
            ok.setContentText("Fichiers supprimés :\n" + supprimés +
                    "\nVous pouvez supprimer manuellement le fichier .jar.");
            ok.showAndWait();

            Platform.exit();
            System.exit(0);
        });
    }

    @FXML
    private void onChangerTheme() {
        RadioButton selected = (RadioButton) toggleTheme.getSelectedToggle();
        if (selected == null) return;
        themeService.appliquerTheme(selected.getText());
        labelStatus.setText("Thème appliqué : " + selected.getText());
    }

    @FXML
    private void onChangerPolice() {
        String police = comboPolice.getValue();
        if (police != null) themeService.appliquerPolice(police);
    }

    @FXML
    private void onChangerTaille() {
        Integer taille = comboTaille.getValue();
        if (taille != null) themeService.appliquerTaille(taille);
    }

    public void setAuthService(AuthService authService, boolean connecte) {
        this.authService = authService;
        this.modeConnecte = connecte;
        if (authService != null && connecte) {
            labelUtilisateur.setText(authService.getUtilisateurCourant());
            syncService.setToken(authService.getToken());
            syncService.setIdUtilisateurPg(authService.getIdUtilisateurPg());
            btnConnexionAction.setText("Déconnexion");
        } else {
            labelUtilisateur.setText("");
            btnConnexionAction.setText("Se connecter");
        }
        demarrerNetworkMonitor();
    }

    @FXML
    private void onConnexionAction() {
        if (modeConnecte) {
            Alert confirm = new Alert(Alert.AlertType.CONFIRMATION);
            confirm.setTitle("Déconnexion");
            confirm.setHeaderText("Se déconnecter ?");
            confirm.setContentText("Vous serez redirigé vers l'écran de connexion.");
            confirm.showAndWait().ifPresent(btn -> {
                if (btn == ButtonType.OK) {
                    if (networkMonitor != null) networkMonitor.arreter();
                    if (authService != null) authService.deconnecter();
                    try {
                        javafx.stage.Stage stage = (javafx.stage.Stage)
                                labelStatus.getScene().getWindow();
                        App app = new App();
                        app.start(stage);
                    } catch (Exception e) {
                        throw new RuntimeException("Erreur retour login", e);
                    }
                }
            });
        } else {
            if (networkMonitor != null) networkMonitor.arreter();
            try {
                javafx.stage.Stage stage = (javafx.stage.Stage)
                        labelStatus.getScene().getWindow();
                App app = new App();
                app.start(stage);
            } catch (Exception e) {
                throw new RuntimeException("Erreur retour login", e);
            }
        }
    }

    public void onFermer() {
        if (networkMonitor != null) networkMonitor.arreter();
    }
}
