package com.quartio.desktop.plugin;

import com.quartio.desktop.dao.DatabaseService;
import com.quartio.desktop.dao.EvenementDAO;
import com.quartio.desktop.model.Evenement;

import java.util.List;

public class CalendrierLocalPlugin implements CalendrierPlugin {

    private final EvenementDAO dao;

    public CalendrierLocalPlugin() {
        this.dao = new EvenementDAO(DatabaseService.getInstance());
    }

    @Override
    public String getNom() { return "Calendrier local"; }

    @Override
    public String getDescription() { return "Gestion des événements du quartier stockés localement"; }

    @Override
    public List<Evenement> getEvenements() {
        return dao.findAll();
    }

    @Override
    public void ajouterEvenement(Evenement evenement) {
        dao.save(evenement);
    }
}
