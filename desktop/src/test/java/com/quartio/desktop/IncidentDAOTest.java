package com.quartio.desktop;

import com.quartio.desktop.dao.DatabaseService;
import com.quartio.desktop.dao.IncidentDAO;
import com.quartio.desktop.model.Incident;
import org.junit.jupiter.api.*;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class IncidentDAOTest {

    private static IncidentDAO dao;

    @BeforeAll
    static void setUp() {
        dao = new IncidentDAO(DatabaseService.getInstance());
    }

    @Test
    @Order(1)
    void testFindAll_retourneDesIncidents() {
        List<Incident> incidents = dao.findAll();
        assertNotNull(incidents);
        assertFalse(incidents.isEmpty(), "Des incidents de démo doivent être présents");
    }

    @Test
    @Order(2)
    void testSave_creerIncidentLocal() {
        Incident inc = new Incident(null, "Test incident", "Description test",
                Incident.Type.AUTRE, 1);
        dao.save(inc);

        assertNotNull(inc.getId());
        assertTrue(inc.getId().startsWith("local_"), "L'ID doit avoir le préfixe local_");
        assertTrue(inc.isLocal());
    }

    @Test
    @Order(3)
    void testUpdateStatut_changeLEStatut() {
        // Récupère le premier incident
        Incident inc = dao.findAll().get(0);
        String id = inc.getId();

        dao.updateStatut(id, Incident.Statut.EN_COURS, "Pris en charge");

        Incident mis_a_jour = dao.findAll().stream()
                .filter(i -> i.getId().equals(id))
                .findFirst()
                .orElseThrow();

        assertEquals(Incident.Statut.EN_COURS, mis_a_jour.getStatut());
        assertEquals("Pris en charge", mis_a_jour.getCommentaireAdmin());
    }

    @Test
    @Order(4)
    void testCountByStatut_retourneNombreCorrect() {
        long count = dao.countByStatut(Incident.Statut.EN_COURS);
        assertTrue(count >= 1, "Au moins un incident EN_COURS après la mise à jour");
    }

    @Test
    @Order(5)
    void testFindNonSynchronises_retourneIncidentsLocaux() {
        List<Incident> nonSync = dao.findNonSynchronises();
        assertNotNull(nonSync);
        // Les incidents local_ ne sont pas synchronisés
        nonSync.forEach(i -> assertFalse(i.isEstSynchronise()));
    }

    @Test
    @Order(6)
    void testIncident_prioriteLabel() {
        Incident inc = new Incident("id1", "Test", "Desc", Incident.Type.SECURITE, 3);
        assertEquals("Haute", inc.getPrioriteLabel());

        inc.setPriorite(1);
        assertEquals("Faible", inc.getPrioriteLabel());
    }

    @Test
    @Order(7)
    void testIncident_setStatutResoluMetsDateResolution() {
        Incident inc = new Incident("id2", "Test", "Desc", Incident.Type.AUTRE, 1);
        assertNull(inc.getDateResolution());

        inc.setStatut(Incident.Statut.RESOLU);
        assertNotNull(inc.getDateResolution(), "dateResolution doit être définie quand RESOLU");
    }
}
