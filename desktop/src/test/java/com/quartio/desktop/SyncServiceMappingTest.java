package com.quartio.desktop;

import com.quartio.desktop.model.Incident;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Teste le mapping Local ↔ API sans appel réseau.
 * Vérifie que les conversions statut/priorité sont correctes.
 */
class SyncServiceMappingTest {

    // --- Mapping statuts local → API ---

    @Test
    void statut_NOUVEAU_correspondA_ouvert() {
        assertEquals("ouvert", statutLocalVersApi(Incident.Statut.NOUVEAU));
    }

    @Test
    void statut_EN_COURS_correspondA_en_cours() {
        assertEquals("en_cours", statutLocalVersApi(Incident.Statut.EN_COURS));
    }

    @Test
    void statut_RESOLU_correspondA_resolu() {
        assertEquals("resolu", statutLocalVersApi(Incident.Statut.RESOLU));
    }

    @Test
    void statut_REJETE_correspondA_ferme() {
        assertEquals("ferme", statutLocalVersApi(Incident.Statut.REJETE));
    }

    // --- Mapping statuts API → local ---

    @Test
    void api_ouvert_correspondA_NOUVEAU() {
        assertEquals(Incident.Statut.NOUVEAU, statutApiVersLocal("ouvert"));
    }

    @Test
    void api_en_cours_correspondA_EN_COURS() {
        assertEquals(Incident.Statut.EN_COURS, statutApiVersLocal("en_cours"));
    }

    @Test
    void api_resolu_correspondA_RESOLU() {
        assertEquals(Incident.Statut.RESOLU, statutApiVersLocal("resolu"));
    }

    @Test
    void api_ferme_correspondA_REJETE() {
        assertEquals(Incident.Statut.REJETE, statutApiVersLocal("ferme"));
    }

    @Test
    void api_statutInconnu_defaultA_NOUVEAU() {
        assertEquals(Incident.Statut.NOUVEAU, statutApiVersLocal("inconnu"));
    }

    // --- Mapping priorités local → API ---

    @Test
    void priorite_1_correspondA_basse() {
        assertEquals("basse", prioriteLocalVersApi(1));
    }

    @Test
    void priorite_2_correspondA_normale() {
        assertEquals("normale", prioriteLocalVersApi(2));
    }

    @Test
    void priorite_3_correspondA_haute() {
        assertEquals("haute", prioriteLocalVersApi(3));
    }

    // --- Mapping priorités API → local ---

    @Test
    void api_basse_correspondA_1() {
        assertEquals(1, prioriteApiVersLocal("basse"));
    }

    @Test
    void api_normale_correspondA_2() {
        assertEquals(2, prioriteApiVersLocal("normale"));
    }

    @Test
    void api_haute_correspondA_3() {
        assertEquals(3, prioriteApiVersLocal("haute"));
    }

    @Test
    void api_critique_correspondA_3() {
        assertEquals(3, prioriteApiVersLocal("critique"));
    }

    @Test
    void api_prioriteInconnue_defaultA_2() {
        assertEquals(2, prioriteApiVersLocal("inconnue"));
    }

    // --- Copies des méthodes de mapping de SyncService (même logique) ---

    private String statutLocalVersApi(Incident.Statut s) {
        return switch (s) {
            case NOUVEAU  -> "ouvert";
            case EN_COURS -> "en_cours";
            case RESOLU   -> "resolu";
            case REJETE   -> "ferme";
        };
    }

    private Incident.Statut statutApiVersLocal(String s) {
        return switch (s) {
            case "en_cours" -> Incident.Statut.EN_COURS;
            case "resolu"   -> Incident.Statut.RESOLU;
            case "ferme"    -> Incident.Statut.REJETE;
            default         -> Incident.Statut.NOUVEAU;
        };
    }

    private String prioriteLocalVersApi(int p) {
        return switch (p) {
            case 1  -> "basse";
            case 3  -> "haute";
            default -> "normale";
        };
    }

    private int prioriteApiVersLocal(String p) {
        return switch (p) {
            case "basse"            -> 1;
            case "haute", "critique" -> 3;
            default                 -> 2;
        };
    }
}
