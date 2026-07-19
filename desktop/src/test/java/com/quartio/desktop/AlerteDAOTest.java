package com.quartio.desktop;

import com.quartio.desktop.dao.AlerteDAO;
import com.quartio.desktop.dao.DatabaseService;
import com.quartio.desktop.model.Alerte;
import org.junit.jupiter.api.*;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AlerteDAOTest {

    private static AlerteDAO dao;

    @BeforeAll
    static void setUp() {
        dao = new AlerteDAO(DatabaseService.getInstance());
    }

    @Test
    @Order(1)
    void findAll_retourneDesAlertes() {
        List<Alerte> alertes = dao.findAll();
        assertNotNull(alertes);
        assertFalse(alertes.isEmpty(), "Les données de démo doivent contenir des alertes");
    }

    @Test
    @Order(2)
    void save_creerAlerteLocale() {
        Alerte alerte = new Alerte(null, "Alerte test", "Description test",
                Alerte.Niveau.AVERTISSEMENT, "Jean Dupont");

        dao.save(alerte);

        assertNotNull(alerte.getId());
        assertTrue(alerte.getId().startsWith("local_"), "L'ID doit avoir le préfixe local_");
        assertTrue(alerte.isLocal());
        assertFalse(alerte.isEstSynchronise());
    }

    @Test
    @Order(3)
    void updateStatut_acquitter_metDateAcquittement() {
        Alerte alerte = new Alerte(null, "Alerte à acquitter", "Desc",
                Alerte.Niveau.DANGER, "Marie Martin");
        dao.save(alerte);
        String id = alerte.getId();

        dao.updateStatut(id, Alerte.Statut.ACQUITTEE);

        Alerte acquittee = dao.findAll().stream()
                .filter(a -> a.getId().equals(id))
                .findFirst()
                .orElseThrow();

        assertEquals(Alerte.Statut.ACQUITTEE, acquittee.getStatut());
        assertNotNull(acquittee.getDateAcquittement(), "La date d'acquittement doit être définie");
    }

    @Test
    @Order(4)
    void countByStatut_retourneNombreCorrect() {
        long actives = dao.countByStatut(Alerte.Statut.ACTIVE);
        assertTrue(actives >= 0);
    }

    @Test
    @Order(5)
    void countByNiveau_retourneNombreCorrect() {
        long dangers = dao.countByNiveau(Alerte.Niveau.DANGER);
        assertTrue(dangers >= 0);
    }

    @Test
    @Order(6)
    void findActives_retourneSeulementActives() {
        List<Alerte> actives = dao.findActives();
        actives.forEach(a ->
                assertEquals(Alerte.Statut.ACTIVE, a.getStatut(),
                        "findActives() ne doit retourner que les alertes ACTIVE"));
    }

    @Test
    @Order(7)
    void findNonSynchronisees_retourneAlerteLocale() {
        List<Alerte> nonSync = dao.findNonSynchronisees();
        assertNotNull(nonSync);
        nonSync.forEach(a ->
                assertFalse(a.isEstSynchronise(), "findNonSynchronisees() ne doit retourner que les non-sync"));
    }

    @Test
    @Order(8)
    void alerte_niveauLabel_retourneLibelleCorrect() {
        Alerte danger = new Alerte("id1", "Test", "Desc", Alerte.Niveau.DANGER, "Test");
        assertEquals("Danger", danger.getNiveauLabel());

        Alerte info = new Alerte("id2", "Test", "Desc", Alerte.Niveau.INFO, "Test");
        assertEquals("Info", info.getNiveauLabel());
    }
}
