package com.quartio.desktop.model;

import java.time.LocalDateTime;

public class Voisin {

    private String id;
    private String nom;
    private String prenom;
    private String email;
    private String telephone;
    private String role;
    private String langue;
    private LocalDateTime dateInscription;
    private int nbIncidentsSignales;
    private int nbAlertesSignalees;
    private int nbEvenementsParticipes;
    private int nbServicesRendus;
    private int pointsSolde;
    private LocalDateTime derniereActivite;
    private LocalDateTime updatedAt;
    private boolean estSynchronise;

    public Voisin() {
        this.updatedAt = LocalDateTime.now();
        this.estSynchronise = false;
    }

    public Voisin(String id, String nom, String prenom, String email) {
        this();
        this.id = id;
        this.nom = nom;
        this.prenom = prenom;
        this.email = email;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getNom() { return nom; }
    public void setNom(String nom) { this.nom = nom; }

    public String getPrenom() { return prenom; }
    public void setPrenom(String prenom) { this.prenom = prenom; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getTelephone() { return telephone; }
    public void setTelephone(String telephone) { this.telephone = telephone; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getLangue() { return langue; }
    public void setLangue(String langue) { this.langue = langue; }

    public LocalDateTime getDateInscription() { return dateInscription; }
    public void setDateInscription(LocalDateTime dateInscription) { this.dateInscription = dateInscription; }

    public int getNbIncidentsSignales() { return nbIncidentsSignales; }
    public void setNbIncidentsSignales(int n) { this.nbIncidentsSignales = n; }

    public int getNbAlertesSignalees() { return nbAlertesSignalees; }
    public void setNbAlertesSignalees(int n) { this.nbAlertesSignalees = n; }

    public int getNbEvenementsParticipes() { return nbEvenementsParticipes; }
    public void setNbEvenementsParticipes(int n) { this.nbEvenementsParticipes = n; }

    public int getNbServicesRendus() { return nbServicesRendus; }
    public void setNbServicesRendus(int n) { this.nbServicesRendus = n; }

    public int getPointsSolde() { return pointsSolde; }
    public void setPointsSolde(int pointsSolde) { this.pointsSolde = pointsSolde; }

    public LocalDateTime getDerniereActivite() { return derniereActivite; }
    public void setDerniereActivite(LocalDateTime d) { this.derniereActivite = d; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public boolean isEstSynchronise() { return estSynchronise; }
    public void setEstSynchronise(boolean estSynchronise) { this.estSynchronise = estSynchronise; }

    public String getNomComplet() { return prenom + " " + nom; }

    public int getScoreParticipation() {
        return pointsSolde > 0 ? pointsSolde
                : nbIncidentsSignales + nbAlertesSignalees
                  + (nbEvenementsParticipes * 2) + (nbServicesRendus * 3);
    }

    public String getNiveauEngagement() {
        int score = getScoreParticipation();
        if (score >= 500) return "Ambassadeur";
        if (score >= 200) return "Actif";
        if (score >= 50)  return "Participant";
        return "Nouveau";
    }
}
