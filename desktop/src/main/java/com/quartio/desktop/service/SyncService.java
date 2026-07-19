package com.quartio.desktop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.quartio.desktop.dao.EvenementDAO;
import com.quartio.desktop.dao.IncidentDAO;
import com.quartio.desktop.dao.SyncLogDAO;
import com.quartio.desktop.dao.VoisinDAO;
import com.quartio.desktop.model.Evenement;
import com.quartio.desktop.model.Incident;
import com.quartio.desktop.model.SyncLog;
import com.quartio.desktop.model.Voisin;
import okhttp3.*;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

public class SyncService {

    private String baseUrl;
    private final IncidentDAO incidentDAO;
    private final VoisinDAO voisinDAO;
    private final EvenementDAO evenementDAO;
    private final SyncLogDAO syncLogDAO;
    private final OkHttpClient httpClient;
    private final ObjectMapper mapper;
    private String token;
    private int idUtilisateurPg = 0;

    public SyncService(IncidentDAO incidentDAO, VoisinDAO voisinDAO,
                       EvenementDAO evenementDAO, SyncLogDAO syncLogDAO, String baseUrl) {
        this.incidentDAO  = incidentDAO;
        this.voisinDAO    = voisinDAO;
        this.evenementDAO = evenementDAO;
        this.syncLogDAO   = syncLogDAO;
        this.baseUrl      = baseUrl;
        this.httpClient  = new OkHttpClient();
        this.mapper      = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    public void setBaseUrl(String url) { this.baseUrl = url; }
    public void setToken(String token) { this.token = token; }
    public void setIdUtilisateurPg(int id) { this.idUtilisateurPg = id; }

    public CompletableFuture<SyncLog> synchroniserAsync(Consumer<String> onProgress) {
        return CompletableFuture.supplyAsync(() -> {
            SyncLog log = new SyncLog();
            syncLogDAO.create(log);
            try {
                onProgress.accept("Phase 1/5 : Envoi des incidents locaux...");
                List<Incident> aEnvoyer = incidentDAO.findNonSynchronises();
                int nbEnvoyes = push(aEnvoyer, onProgress);

                onProgress.accept("Phase 2/5 : Envoi des événements locaux...");
                int nbEvtsEnvoyes = pushEvenements(onProgress);

                onProgress.accept("Phase 3/5 : Récupération des incidents serveur...");
                List<Incident> recus = pullIncidents(onProgress);
                int nbRecus = recus.size();

                int nbVoisinsRecus  = pullVoisins(onProgress);
                int nbEvtsRecus     = pullEvenements(onProgress);

                onProgress.accept("Phase 4/5 : Résolution des conflits...");
                int nbConflits = resoudreConflits(aEnvoyer, recus);

                onProgress.accept("Phase 5/5 : Mise à jour du point de synchronisation...");
                syncLogDAO.setLastSyncAt(LocalDateTime.now());

                log.terminer(nbEnvoyes + nbEvtsEnvoyes, nbRecus, nbConflits);
                syncLogDAO.update(log);
                onProgress.accept("✓ Synchronisation terminée — " + nbEnvoyes + " incidents / "
                        + nbEvtsEnvoyes + " événements envoyés, "
                        + nbRecus + " incidents / " + nbVoisinsRecus + " voisins / "
                        + nbEvtsRecus + " événements reçus.");
                return log;

            } catch (Exception e) {
                log.echouer(e.getMessage());
                syncLogDAO.update(log);
                onProgress.accept("✗ Erreur : " + e.getMessage());
                return log;
            }
        }, task -> Thread.ofVirtual().start(task));
    }

    private int push(List<Incident> incidents, Consumer<String> onProgress) {
        int envoyes = 0;
        for (Incident inc : incidents) {
            try {
                ObjectNode body = incidentVersApi(inc);
                String bodyStr  = mapper.writeValueAsString(body);

                boolean estLocal = inc.isLocal();
                Request req;

                if (estLocal) {
                    req = requeteAvecAuth(baseUrl + "/incidents")
                            .post(RequestBody.create(bodyStr, MediaType.parse("application/json")))
                            .build();
                } else {
                    req = requeteAvecAuth(baseUrl + "/incidents/" + inc.getId())
                            .put(RequestBody.create(bodyStr, MediaType.parse("application/json")))
                            .build();
                }

                try (Response resp = httpClient.newCall(req).execute()) {
                    if (resp.isSuccessful()) {
                        if (resp.body() != null) {
                            JsonNode created = mapper.readTree(resp.body().string());
                            String newId = created.path("_id").asText(null);
                            if (newId != null) {
                                incidentDAO.updateIdEtSynchronise(inc.getId(), newId);
                            } else {
                                incidentDAO.marquerSynchronises(List.of(inc.getId()));
                            }
                        } else {
                            incidentDAO.marquerSynchronises(List.of(inc.getId()));
                        }
                        envoyes++;
                        onProgress.accept("  → Envoyé : " + inc.getTitre());
                    } else if (!estLocal && resp.code() == 404) {
                        Request postReq = requeteAvecAuth(baseUrl + "/incidents")
                                .post(RequestBody.create(bodyStr, MediaType.parse("application/json")))
                                .build();
                        try (Response postResp = httpClient.newCall(postReq).execute()) {
                            if (postResp.isSuccessful() && postResp.body() != null) {
                                JsonNode created = mapper.readTree(postResp.body().string());
                                String newId = created.path("_id").asText(null);
                                if (newId != null) {
                                    incidentDAO.updateIdEtSynchronise(inc.getId(), newId);
                                } else {
                                    incidentDAO.marquerSynchronises(List.of(inc.getId()));
                                }
                                envoyes++;
                                onProgress.accept("  → Recréé : " + inc.getTitre());
                            } else {
                                String errBody = postResp.body() != null ? postResp.body().string() : "(vide)";
                                onProgress.accept("  ⚠ Échec recréation '" + inc.getTitre() + "' : HTTP " + postResp.code() + " → " + errBody);
                            }
                        }
                    } else {
                        String errBody = resp.body() != null ? resp.body().string() : "(vide)";
                        onProgress.accept("  ⚠ Échec envoi '" + inc.getTitre() + "' : HTTP " + resp.code() + " → " + errBody);
                    }
                }
            } catch (IOException e) {
                onProgress.accept("  ⚠ Erreur réseau pour '" + inc.getTitre() + "' : " + e.getMessage());
            }
        }
        return envoyes;
    }

    private List<Incident> pullIncidents(Consumer<String> onProgress) throws IOException {
        Request req = requeteAvecAuth(baseUrl + "/incidents?limit=200").get().build();
        try (Response resp = httpClient.newCall(req).execute()) {
            if (!resp.isSuccessful()) throw new IOException("Pull incidents échoué : HTTP " + resp.code());
            JsonNode node = mapper.readTree(resp.body().string());
            JsonNode data = node.has("data") ? node.get("data") : node;
            List<Incident> recus = new ArrayList<>();
            if (data.isArray()) {
                for (JsonNode item : data) recus.add(apiVersIncident(item));
            }
            onProgress.accept("  → " + recus.size() + " incident(s) récupéré(s)");
            return recus;
        }
    }

    private int pullVoisins(Consumer<String> onProgress) throws IOException {
        Request req = requeteAvecAuth(baseUrl + "/utilisateurs?limit=200").get().build();
        try (Response resp = httpClient.newCall(req).execute()) {
            if (!resp.isSuccessful()) {
                onProgress.accept("  ⚠ Pull voisins ignoré : HTTP " + resp.code());
                return 0;
            }
            JsonNode node = mapper.readTree(resp.body().string());
            JsonNode data = node.has("data") ? node.get("data") : node;
            int count = 0;
            if (data.isArray() && data.size() > 0) {
                voisinDAO.deleteAllSynchronises();
                for (JsonNode item : data) {
                    Voisin v = apiVersVoisin(item);
                    voisinDAO.save(v);
                    int nbInc = incidentDAO.countByUtilisateur(Integer.parseInt(v.getId()));
                    if (nbInc > 0) voisinDAO.mettreAJourNbIncidents(v.getId(), nbInc);
                    count++;
                }
            }
            onProgress.accept("  → " + count + " voisin(s) récupéré(s)");
            return count;
        }
    }

    private int pushEvenements(Consumer<String> onProgress) {
        int envoyes = 0;
        for (Evenement evt : evenementDAO.findNonSynchronises()) {
            try {
                ObjectNode body = evenementVersApi(evt);
                String bodyStr  = mapper.writeValueAsString(body);

                Request req;
                if (evt.isLocal()) {
                    req = requeteAvecAuth(baseUrl + "/evenements")
                            .post(RequestBody.create(bodyStr, MediaType.parse("application/json")))
                            .build();
                } else {
                    req = requeteAvecAuth(baseUrl + "/evenements/" + evt.getId())
                            .put(RequestBody.create(bodyStr, MediaType.parse("application/json")))
                            .build();
                }

                try (Response resp = httpClient.newCall(req).execute()) {
                    if (resp.isSuccessful()) {
                        if (resp.body() != null) {
                            JsonNode created = mapper.readTree(resp.body().string());
                            String newId = created.path("_id").asText(null);
                            if (newId != null && !newId.isBlank()) {
                                evenementDAO.updateIdEtSynchronise(evt.getId(), newId);
                            } else {
                                evenementDAO.marquerSynchronises(List.of(evt.getId()));
                            }
                        } else {
                            evenementDAO.marquerSynchronises(List.of(evt.getId()));
                        }
                        envoyes++;
                        onProgress.accept("  → Événement envoyé : " + evt.getTitre());
                    } else if (!evt.isLocal() && resp.code() == 404) {
                        Request postReq = requeteAvecAuth(baseUrl + "/evenements")
                                .post(RequestBody.create(bodyStr, MediaType.parse("application/json")))
                                .build();
                        try (Response postResp = httpClient.newCall(postReq).execute()) {
                            if (postResp.isSuccessful() && postResp.body() != null) {
                                JsonNode created = mapper.readTree(postResp.body().string());
                                String newId = created.path("_id").asText(null);
                                if (newId != null) evenementDAO.updateIdEtSynchronise(evt.getId(), newId);
                                else evenementDAO.marquerSynchronises(List.of(evt.getId()));
                                envoyes++;
                            } else {
                                onProgress.accept("  ⚠ Échec recréation événement '" + evt.getTitre() + "' : HTTP " + postResp.code());
                            }
                        }
                    } else {
                        String errBody = resp.body() != null ? resp.body().string() : "(vide)";
                        onProgress.accept("  ⚠ Échec envoi événement '" + evt.getTitre() + "' : HTTP " + resp.code() + " → " + errBody);
                    }
                }
            } catch (IOException e) {
                onProgress.accept("  ⚠ Erreur réseau événement '" + evt.getTitre() + "' : " + e.getMessage());
            }
        }
        return envoyes;
    }

    private int pullEvenements(Consumer<String> onProgress) throws IOException {
        Request req = requeteAvecAuth(baseUrl + "/evenements?limit=200").get().build();
        try (Response resp = httpClient.newCall(req).execute()) {
            if (!resp.isSuccessful()) {
                onProgress.accept("  ⚠ Pull événements ignoré : HTTP " + resp.code());
                return 0;
            }
            JsonNode node = mapper.readTree(resp.body().string());
            JsonNode data = node.has("data") ? node.get("data") : node;
            int count = 0;
            if (data.isArray() && data.size() > 0) {
                evenementDAO.deleteAllSynchronises();
                for (JsonNode item : data) {
                    evenementDAO.save(apiVersEvenement(item));
                    count++;
                }
            }
            onProgress.accept("  → " + count + " événement(s) récupéré(s)");
            return count;
        }
    }

    private ObjectNode evenementVersApi(Evenement evt) {
        ObjectNode n = mapper.createObjectNode();
        if (evt.getTitre()       != null) n.put("titre",       evt.getTitre());
        if (evt.getDescription() != null) n.put("description", evt.getDescription());
        if (evt.getType()        != null) n.put("type",        evt.getType().name().toLowerCase());
        if (evt.getLieu()        != null) n.put("lieu",        evt.getLieu());
        if (evt.getDateDebut()   != null) n.put("date_debut",  evt.getDateDebut().toString());
        if (evt.getDateFin()     != null) n.put("date_fin",    evt.getDateFin().toString());
        return n;
    }

    private Evenement apiVersEvenement(JsonNode n) {
        Evenement evt = new Evenement();
        String id = n.path("_id").asText(null);
        if (id == null || id.isBlank()) id = n.path("id").asText(null);
        evt.setId(id);
        evt.setTitre(n.path("titre").asText(""));
        evt.setDescription(n.path("description").asText(null));
        String type = n.path("type").asText(null);
        if (type != null) {
            try { evt.setType(Evenement.Type.valueOf(type.toUpperCase())); }
            catch (IllegalArgumentException ignored) { evt.setType(Evenement.Type.AUTRE); }
        }
        evt.setLieu(n.path("lieu").asText(null));
        evt.setNbParticipants(n.path("capacite_max").asInt(0));
        evt.setIdUtilisateurPg(n.path("id_utilisateur_pg").asInt(0));
        evt.setEstSynchronise(true);
        parseDateTime(n, "date_debut").ifPresent(evt::setDateDebut);
        parseDateTime(n, "date_fin").ifPresent(evt::setDateFin);
        parseDateTime(n, "createdAt").ifPresent(evt::setCreatedAt);
        parseDateTime(n, "updatedAt").ifPresent(evt::setUpdatedAt);
        return evt;
    }

    private int resoudreConflits(List<Incident> locaux, List<Incident> serveur) {
        int conflits = 0;
        for (Incident distant : serveur) {
            var local = locaux.stream()
                    .filter(l -> l.getId().equals(distant.getId()))
                    .findFirst();

            if (local.isPresent()) {
                conflits++;
                Incident gagnant = (distant.getUpdatedAt() != null
                        && local.get().getUpdatedAt() != null
                        && distant.getUpdatedAt().isAfter(local.get().getUpdatedAt()))
                        ? distant : local.get();
                gagnant.setEstSynchronise(true);
                incidentDAO.save(gagnant);
            } else {
                distant.setEstSynchronise(true);
                incidentDAO.save(distant);
            }
        }
        return conflits;
    }

    public boolean isBackendJoignable() {
        try {
            Request req = requeteAvecAuth(baseUrl + "/incidents?limit=1")
                    .get().build();
            try (Response resp = httpClient.newCall(req).execute()) {
                return resp.code() != 0;
            }
        } catch (IOException e) {
            return false;
        }
    }

    private ObjectNode incidentVersApi(Incident inc) {
        ObjectNode n = mapper.createObjectNode();
        if (inc.getTitre()      != null) n.put("titre",       inc.getTitre());
        if (inc.getDescription()!= null) n.put("description", inc.getDescription());
        if (inc.getType()       != null) n.put("type",        inc.getType().name().toLowerCase());
        n.put("priorite", prioriteLocalVersApi(inc.getPriorite()));
        return n;
    }

    private Incident apiVersIncident(JsonNode n) {
        Incident inc = new Incident();
        String incId = n.path("_id").asText(null);
        if (incId == null || incId.isBlank()) incId = n.path("id").asText(null);
        inc.setId(incId);
        inc.setTitre(n.path("titre").asText(""));
        inc.setDescription(n.path("description").asText(null));

        String type = n.path("type").asText(null);
        if (type != null) {
            try { inc.setType(Incident.Type.valueOf(type.toUpperCase())); }
            catch (IllegalArgumentException ignored) { inc.setType(Incident.Type.AUTRE); }
        }

        inc.setStatut(statutApiVersLocal(n.path("statut").asText("ouvert")));
        inc.setPriorite(prioriteApiVersLocal(n.path("priorite").asText("normale")));
        inc.setIdUtilisateurPg(n.path("id_utilisateur_pg").asInt(0));
        inc.setEstSynchronise(true);
        parseDateTime(n, "updatedAt").ifPresent(inc::setUpdatedAt);
        return inc;
    }

    private Voisin apiVersVoisin(JsonNode n) {
        Voisin v = new Voisin();
        v.setId(String.valueOf(n.path("id_utilisateur").asInt()));
        v.setNom(n.path("nom").asText(""));
        v.setPrenom(n.path("prenom").asText(""));
        v.setEmail(n.path("email").asText(null));
        v.setTelephone(n.path("telephone").asText(null));
        v.setRole(n.path("role").asText(null));
        v.setLangue(n.path("langue").asText(null));
        v.setPointsSolde(n.path("points_solde").asInt(0));
        v.setEstSynchronise(true);
        parseDateTime(n, "date_inscription").ifPresent(v::setDateInscription);
        parseDateTime(n, "updatedAt").ifPresent(v::setUpdatedAt);
        return v;
    }

    private java.util.Optional<java.time.LocalDateTime> parseDateTime(JsonNode n, String field) {
        String val = n.path(field).asText(null);
        if (val == null || val.isBlank()) return java.util.Optional.empty();
        try {
            return java.util.Optional.of(
                java.time.Instant.parse(val)
                    .atZone(java.time.ZoneId.systemDefault()).toLocalDateTime());
        } catch (Exception e) {
            return java.util.Optional.empty();
        }
    }

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
            case "basse"     -> 1;
            case "haute",
                 "critique"  -> 3;
            default          -> 2;
        };
    }

    private Request.Builder requeteAvecAuth(String url) {
        Request.Builder b = new Request.Builder().url(url);
        if (token != null && !token.isBlank()) {
            b.header("Authorization", "Bearer " + token);
        }
        return b;
    }
}
