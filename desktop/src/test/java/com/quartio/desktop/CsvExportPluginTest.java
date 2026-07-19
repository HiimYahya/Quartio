package com.quartio.desktop;

import com.quartio.desktop.model.Incident;
import com.quartio.desktop.plugin.CsvExportPlugin;
import com.quartio.desktop.plugin.ExportPlugin;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CsvExportPluginTest {

    @TempDir
    Path tempDir;

    @Test
    void testExport_creerFichierCsv() throws Exception {
        CsvExportPlugin plugin = new CsvExportPlugin();
        assertEquals("Export CSV", plugin.getNom());
        assertEquals("csv", plugin.getExtension());

        List<Incident> incidents = List.of(
                new Incident("inc_001", "Lampadaire cassé", "Desc 1", Incident.Type.INFRASTRUCTURE, 2),
                new Incident("inc_002", "Tag sur mur", "Desc 2", Incident.Type.NUISANCE, 1)
        );

        File output = tempDir.resolve("export.csv").toFile();
        plugin.exporter(incidents, output);

        assertTrue(output.exists());
        String contenu = Files.readString(output.toPath());
        assertTrue(contenu.contains("ID,Titre"), "Doit contenir l'en-tête CSV");
        assertTrue(contenu.contains("inc_001"), "Doit contenir le premier incident");
        assertTrue(contenu.contains("Lampadaire cassé"), "Doit contenir le titre");
    }

    @Test
    void testExport_listeVide_creerFichierAvecEnTete() throws Exception {
        CsvExportPlugin plugin = new CsvExportPlugin();
        File output = tempDir.resolve("vide.csv").toFile();
        plugin.exporter(List.of(), output);

        assertTrue(output.exists());
        String contenu = Files.readString(output.toPath());
        assertTrue(contenu.contains("ID,Titre"));
        assertEquals(1, contenu.lines().count()); // Seulement l'en-tête
    }
}
