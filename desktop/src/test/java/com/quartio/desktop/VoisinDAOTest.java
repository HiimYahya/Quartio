package com.quartio.desktop;

import com.quartio.desktop.dao.DatabaseService;
import com.quartio.desktop.dao.VoisinDAO;
import com.quartio.desktop.model.Voisin;
import org.junit.jupiter.api.*;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class VoisinDAOTest {

    private static VoisinDAO dao;

    @BeforeAll
    static void setUp() {
        dao = new VoisinDAO(DatabaseService.getInstance());
    }

    @Test
    @Order(1)
    void findAll_retourneDesVoisins() {
        List<Voisin> voisins = dao.findAll();
        assertNotNull(voisins);
        assertFalse(voisins.isEmpty(), "Les données de démo doivent contenir des voisins");
    }

    @Test
    @Order(2)
    void findAll_triParScoreDecroissant() {
        List<Voisin> voisins = dao.findAll();
        for (int i = 0; i < voisins.size() - 1; i++) {
            assertTrue(
                voisins.get(i).getScoreParticipation() >= voisins.get(i + 1).getScoreParticipation(),
                "Les voisins doivent être triés par score décroissant"
            );
        }
    }

    @Test
    @Order(3)
    void save_creerVoisinLocal() {
        Voisin voisin = new Voisin();
        voisin.setNom("Martin");
        voisin.setPrenom("Sophie");
        voisin.setEmail("sophie.martin@test.com");
        voisin.setNbIncidentsSignales(2);
        voisin.setNbServicesRendus(1);

        dao.save(voisin);

        assertNotNull(voisin.getId());
        assertTrue(voisin.getId().startsWith("local_"));
    }

    @Test
    @Order(4)
    void countTotal_superieurAZero() {
        long total = dao.countTotal();
        assertTrue(total > 0, "Il doit y avoir au moins un voisin en base");
    }

    @Test
    @Order(5)
    void countActifs_inferieurOuEgalTotal() {
        long total = dao.countTotal();
        long actifs = dao.countActifs();
        assertTrue(actifs <= total, "Les voisins actifs ne peuvent pas dépasser le total");
    }

    @Test
    @Order(6)
    void moyenneScore_superieurOuEgalZero() {
        double moyenne = dao.moyenneScore();
        assertTrue(moyenne >= 0.0, "La moyenne de score ne peut pas être négative");
    }

    @Test
    @Order(7)
    void findTopParticipants_respecteLaLimite() {
        int limite = 3;
        List<Voisin> top = dao.findTopParticipants(limite);
        assertTrue(top.size() <= limite, "findTopParticipants doit respecter la limite");
    }

    @Test
    @Order(8)
    void voisin_scoreParticipation_calculeCorrectement() {
        Voisin v = new Voisin();
        v.setNbIncidentsSignales(2);   // +2
        v.setNbAlertesSignalees(1);    // +1
        v.setNbEvenementsParticipes(3); // +6 (×2)
        v.setNbServicesRendus(1);      // +3 (×3)
        // Total attendu = 2 + 1 + 6 + 3 = 12

        assertEquals(12, v.getScoreParticipation());
    }

    @Test
    @Order(9)
    void voisin_niveauEngagement_correspondAuScore() {
        Voisin ambassadeur = new Voisin();
        ambassadeur.setPointsSolde(600); // >= 500 → Ambassadeur
        assertEquals("Ambassadeur", ambassadeur.getNiveauEngagement());

        Voisin actif = new Voisin();
        actif.setPointsSolde(250); // >= 200 → Actif
        assertEquals("Actif", actif.getNiveauEngagement());

        Voisin participant = new Voisin();
        participant.setPointsSolde(75); // >= 50 → Participant
        assertEquals("Participant", participant.getNiveauEngagement());

        Voisin debutant = new Voisin();
        // score = 0 → Nouveau
        assertEquals("Nouveau", debutant.getNiveauEngagement());
    }
}
