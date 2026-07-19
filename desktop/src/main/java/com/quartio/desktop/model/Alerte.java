package com.quartio.desktop.model;

import java.time.LocalDateTime;

public class Alerte {

    public enum Niveau {
        INFO, AVERTISSEMENT, DANGER
    }

    public enum Statut {
        ACTIVE, ACQUITTEE, ARCHIVEE
    }

    private String id;
    private String titre;
    private String description;
    private Niveau niveau;
    private Statut statut;
    private String signalePar;
    private LocalDateTime dateCreation;
    private LocalDateTime dateAcquittement;
    private LocalDateTime updatedAt;
    private boolean estSynchronise;

    public Alerte() {
        this.dateCreation = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        this.statut = Statut.ACTIVE;
        this.niveau = Niveau.INFO;
        this.estSynchronise = false;
    }

    public Alerte(String id, String titre, String description, Niveau niveau, String signalePar) {
        this();
        this.id = id;
        this.titre = titre;
        this.description = description;
        this.niveau = niveau;
        this.signalePar = signalePar;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTitre() { return titre; }
    public void setTitre(String titre) { this.titre = titre; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Niveau getNiveau() { return niveau; }
    public void setNiveau(Niveau niveau) { this.niveau = niveau; }

    public Statut getStatut() { return statut; }
    public void setStatut(Statut statut) {
        this.statut = statut;
        this.updatedAt = LocalDateTime.now();
        if (statut == Statut.ACQUITTEE) {
            this.dateAcquittement = LocalDateTime.now();
        }
    }

    public String getSignalePar() { return signalePar; }
    public void setSignalePar(String signalePar) { this.signalePar = signalePar; }

    public LocalDateTime getDateCreation() { return dateCreation; }
    public void setDateCreation(LocalDateTime dateCreation) { this.dateCreation = dateCreation; }

    public LocalDateTime getDateAcquittement() { return dateAcquittement; }
    public void setDateAcquittement(LocalDateTime dateAcquittement) { this.dateAcquittement = dateAcquittement; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public boolean isEstSynchronise() { return estSynchronise; }
    public void setEstSynchronise(boolean estSynchronise) { this.estSynchronise = estSynchronise; }

    public boolean isLocal() {
        return id != null && id.startsWith("local_");
    }

    public String getNiveauLabel() {
        return switch (niveau) {
            case INFO -> "Info";
            case AVERTISSEMENT -> "Avertissement";
            case DANGER -> "Danger";
        };
    }

    @Override
    public String toString() {
        return "Alerte{id='%s', titre='%s', niveau=%s, statut=%s}".formatted(id, titre, niveau, statut);
    }
}
