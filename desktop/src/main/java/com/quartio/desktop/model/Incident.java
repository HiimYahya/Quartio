package com.quartio.desktop.model;

import java.time.LocalDateTime;

public class Incident {

    public enum Statut {
        NOUVEAU, EN_COURS, RESOLU, REJETE
    }

    public enum Type {
        SECURITE, INFRASTRUCTURE, NUISANCE, AUTRE
    }

    private String id;
    private String titre;
    private String description;
    private Type type;
    private Statut statut;
    private int priorite;
    private int idUtilisateurPg;
    private LocalDateTime dateSignalement;
    private LocalDateTime dateResolution;
    private String commentaireAdmin;
    private LocalDateTime updatedAt;
    private boolean estSynchronise;

    public Incident() {
        this.dateSignalement = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        this.statut = Statut.NOUVEAU;
        this.estSynchronise = false;
    }

    public Incident(String id, String titre, String description, Type type, int priorite) {
        this();
        this.id = id;
        this.titre = titre;
        this.description = description;
        this.type = type;
        this.priorite = priorite;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTitre() { return titre; }
    public void setTitre(String titre) { this.titre = titre; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Type getType() { return type; }
    public void setType(Type type) { this.type = type; }

    public Statut getStatut() { return statut; }
    public void setStatut(Statut statut) {
        this.statut = statut;
        this.updatedAt = LocalDateTime.now();
        if (statut == Statut.RESOLU || statut == Statut.REJETE) {
            this.dateResolution = LocalDateTime.now();
        }
    }

    public int getPriorite() { return priorite; }
    public void setPriorite(int priorite) { this.priorite = priorite; }

    public int getIdUtilisateurPg() { return idUtilisateurPg; }
    public void setIdUtilisateurPg(int idUtilisateurPg) { this.idUtilisateurPg = idUtilisateurPg; }

    public LocalDateTime getDateSignalement() { return dateSignalement; }
    public void setDateSignalement(LocalDateTime dateSignalement) { this.dateSignalement = dateSignalement; }

    public LocalDateTime getDateResolution() { return dateResolution; }
    public void setDateResolution(LocalDateTime dateResolution) { this.dateResolution = dateResolution; }

    public String getCommentaireAdmin() { return commentaireAdmin; }
    public void setCommentaireAdmin(String commentaireAdmin) { this.commentaireAdmin = commentaireAdmin; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public boolean isEstSynchronise() { return estSynchronise; }
    public void setEstSynchronise(boolean estSynchronise) { this.estSynchronise = estSynchronise; }

    public boolean isLocal() {
        return id != null && id.startsWith("local_");
    }

    public String getPrioriteLabel() {
        return switch (priorite) {
            case 1 -> "Faible";
            case 2 -> "Moyenne";
            case 3 -> "Haute";
            default -> "Inconnue";
        };
    }

    @Override
    public String toString() {
        return "Incident{id='%s', titre='%s', statut=%s}".formatted(id, titre, statut);
    }
}
