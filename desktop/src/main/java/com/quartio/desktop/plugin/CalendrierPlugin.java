package com.quartio.desktop.plugin;

import com.quartio.desktop.model.Evenement;

import java.util.List;

public interface CalendrierPlugin {

    String getNom();

    String getDescription();

    List<Evenement> getEvenements();

    void ajouterEvenement(Evenement evenement);
}
