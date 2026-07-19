package com.quartio.desktop.plugin;

import com.quartio.desktop.model.Incident;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.List;

public class CsvExportPlugin implements ExportPlugin {

    @Override
    public String getNom() {
        return "Export CSV";
    }

    @Override
    public String getExtension() {
        return "csv";
    }

    @Override
    public void exporter(List<Incident> incidents, File destination) throws ExportException {
        try (PrintWriter writer = new PrintWriter(new OutputStreamWriter(
                new FileOutputStream(destination), StandardCharsets.UTF_8))) {
            writer.write('﻿');
            writer.println("ID,Titre,Type,Statut,Priorité,Date signalement,Synchronisé");

            for (Incident inc : incidents) {
                writer.printf("%s,\"%s\",%s,%s,%s,%s,%s%n",
                        inc.getId(),
                        inc.getTitre().replace("\"", "\"\""),
                        inc.getType() != null ? inc.getType() : "",
                        inc.getStatut(),
                        inc.getPrioriteLabel(),
                        inc.getDateSignalement() != null ? inc.getDateSignalement().toString() : "",
                        inc.isEstSynchronise() ? "Oui" : "Non"
                );
            }
        } catch (IOException e) {
            throw new ExportException("Impossible d'écrire le fichier CSV", e);
        }
    }
}
