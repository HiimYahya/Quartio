package com.quartio.desktop.plugin;

import com.quartio.desktop.model.Voisin;

import java.util.List;

public interface AnalyseSocialePlugin {

    String getNom();

    String getDescription();

    AnalyseResultat analyser(List<Voisin> voisins);

    record AnalyseResultat(String titre, String contenu) {}
}
