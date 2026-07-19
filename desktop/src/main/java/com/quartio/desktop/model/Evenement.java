package com.quartio.desktop.model;

import java.time.LocalDateTime;

public class Evenement {

    public enum Type {
        REUNION, ACTIVITE, COLLECTE, FETE, AUTRE
    }

    private String id;
    private String titre;
    private String description;
    private Type type;
    private LocalDateTime dateDebut;
    private LocalDateTime dateFin;
    private String lieu;
    private int nbParticipants;
    private int idUtilisateurPg;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private boolean estSynchronise;

    public Evenement() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        this.type = Type.AUTRE;
        this.estSynchronise = false;
    }

    public Evenement(String id, String titre, Type type, LocalDateTime dateDebut, String lieu) {
        this();
        this.id = id;
        this.titre = titre;
        this.type = type;
        this.dateDebut = dateDebut;
        this.lieu = lieu;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTitre() { return titre; }
    public void setTitre(String titre) { this.titre = titre; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Type getType() { return type; }
    public void setType(Type type) { this.type = type; }

    public LocalDateTime getDateDebut() { return dateDebut; }
    public void setDateDebut(LocalDateTime dateDebut) { this.dateDebut = dateDebut; }

    public LocalDateTime getDateFin() { return dateFin; }
    public void setDateFin(LocalDateTime dateFin) { this.dateFin = dateFin; }

    public String getLieu() { return lieu; }
    public void setLieu(String lieu) { this.lieu = lieu; }

    public int getNbParticipants() { return nbParticipants; }
    public void setNbParticipants(int nbParticipants) { this.nbParticipants = nbParticipants; }

    public int getIdUtilisateurPg() { return idUtilisateurPg; }
    public void setIdUtilisateurPg(int idUtilisateurPg) { this.idUtilisateurPg = idUtilisateurPg; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public boolean isEstSynchronise() { return estSynchronise; }
    public void setEstSynchronise(boolean estSynchronise) { this.estSynchronise = estSynchronise; }

    public boolean isLocal() {
        return id != null && id.startsWith("evt_");
    }
}
