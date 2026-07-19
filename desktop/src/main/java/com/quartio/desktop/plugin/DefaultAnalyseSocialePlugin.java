package com.quartio.desktop.plugin;

import com.quartio.desktop.model.Voisin;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class DefaultAnalyseSocialePlugin implements AnalyseSocialePlugin {

    @Override
    public String getNom() { return "Analyse sociale du quartier"; }

    @Override
    public String getDescription() { return "Statistiques d'engagement et classement des voisins"; }

    @Override
    public AnalyseResultat analyser(List<Voisin> voisins) {
        if (voisins.isEmpty()) {
            return new AnalyseResultat("Analyse sociale", "Aucun voisin enregistré.");
        }

        long total = voisins.size();
        long actifs = voisins.stream()
                .filter(v -> v.getPointsSolde() > 0)
                .count();
        double tauxEngagement = total > 0 ? (actifs * 100.0 / total) : 0;

        Voisin mvp = voisins.stream()
                .max(Comparator.comparingInt(Voisin::getScoreParticipation))
                .orElse(null);

        Map<String, Long> parNiveau = voisins.stream()
                .collect(Collectors.groupingBy(Voisin::getNiveauEngagement, Collectors.counting()));

        int totalPoints = voisins.stream().mapToInt(Voisin::getPointsSolde).sum();
        int maxPoints   = voisins.stream().mapToInt(Voisin::getPointsSolde).max().orElse(0);

        double scoreMoyen = voisins.stream()
                .mapToInt(Voisin::getPointsSolde)
                .average()
                .orElse(0);

        List<Voisin> top3 = voisins.stream()
                .sorted(Comparator.comparingInt(Voisin::getScoreParticipation).reversed())
                .limit(3)
                .toList();

        StringBuilder sb = new StringBuilder();
        sb.append("═══════════════════════════════════════\n");
        sb.append("        ANALYSE SOCIALE DU QUARTIER\n");
        sb.append("═══════════════════════════════════════\n\n");

        sb.append("VUE D'ENSEMBLE\n");
        sb.append("──────────────\n");
        sb.append("  Voisins enregistrés : %d\n".formatted(total));
        sb.append("  Voisins actifs       : %d\n".formatted(actifs));
        sb.append("  Taux d'engagement    : %.1f%%\n".formatted(tauxEngagement));
        sb.append("  Score moyen          : %.1f pts\n\n".formatted(scoreMoyen));

        sb.append("POINTS DU QUARTIER\n");
        sb.append("──────────────────\n");
        sb.append("  Total points cumulés : %d pts\n".formatted(totalPoints));
        sb.append("  Score maximum        : %d pts\n\n".formatted(maxPoints));

        sb.append("RÉPARTITION PAR NIVEAU\n");
        sb.append("──────────────────────\n");
        for (String niveau : List.of("Ambassadeur", "Actif", "Participant", "Nouveau")) {
            long n = parNiveau.getOrDefault(niveau, 0L);
            sb.append("  %-15s : %d voisin%s\n".formatted(niveau, n, n > 1 ? "s" : ""));
        }
        sb.append("\n");

        sb.append("TOP 3 CONTRIBUTEURS\n");
        sb.append("───────────────────\n");
        for (int i = 0; i < top3.size(); i++) {
            Voisin v = top3.get(i);
            sb.append("  %d. %-20s %d pts  [%s]\n".formatted(
                    i + 1, v.getNomComplet(), v.getPointsSolde(), v.getNiveauEngagement()));
        }

        if (mvp != null) {
            sb.append("\n VOISIN LE PLUS ENGAGÉ : %s (%d pts)\n".formatted(
                    mvp.getNomComplet(), mvp.getPointsSolde()));
        }

        return new AnalyseResultat("Analyse sociale du quartier", sb.toString());
    }
}
