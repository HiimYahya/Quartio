package com.quartio.desktop.model;

import java.time.LocalDateTime;

public class SyncLog {

    public enum Statut {
        SUCCES, ECHEC, EN_COURS
    }

    private int id;
    private LocalDateTime dateDebut;
    private LocalDateTime dateFin;
    private int nbEnvoyes;
    private int nbRecus;
    private int nbConflits;
    private Statut statut;
    private String messageErreur;

    public SyncLog() {
        this.dateDebut = LocalDateTime.now();
        this.statut = Statut.EN_COURS;
    }

    public void terminer(int nbEnvoyes, int nbRecus, int nbConflits) {
        this.dateFin = LocalDateTime.now();
        this.nbEnvoyes = nbEnvoyes;
        this.nbRecus = nbRecus;
        this.nbConflits = nbConflits;
        this.statut = Statut.SUCCES;
    }

    public void echouer(String messageErreur) {
        this.dateFin = LocalDateTime.now();
        this.messageErreur = messageErreur;
        this.statut = Statut.ECHEC;
    }

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public LocalDateTime getDateDebut() { return dateDebut; }
    public void setDateDebut(LocalDateTime dateDebut) { this.dateDebut = dateDebut; }

    public LocalDateTime getDateFin() { return dateFin; }
    public void setDateFin(LocalDateTime dateFin) { this.dateFin = dateFin; }

    public int getNbEnvoyes() { return nbEnvoyes; }
    public void setNbEnvoyes(int nbEnvoyes) { this.nbEnvoyes = nbEnvoyes; }

    public int getNbRecus() { return nbRecus; }
    public void setNbRecus(int nbRecus) { this.nbRecus = nbRecus; }

    public int getNbConflits() { return nbConflits; }
    public void setNbConflits(int nbConflits) { this.nbConflits = nbConflits; }

    public Statut getStatut() { return statut; }
    public void setStatut(Statut statut) { this.statut = statut; }

    public String getMessageErreur() { return messageErreur; }
    public void setMessageErreur(String messageErreur) { this.messageErreur = messageErreur; }

    public String getResume() {
        if (statut == Statut.ECHEC) return "Echec: " + messageErreur;
        return "Envoyés: %d | Reçus: %d | Conflits: %d".formatted(nbEnvoyes, nbRecus, nbConflits);
    }
}
