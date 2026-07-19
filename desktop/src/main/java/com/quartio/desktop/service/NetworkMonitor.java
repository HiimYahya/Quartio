package com.quartio.desktop.service;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

public class NetworkMonitor {

    private static final int INTERVAL_SECONDES = 30;

    private final SyncService syncService;
    private final Consumer<Boolean> onStatusChange;
    private final Runnable onReconnexion;

    private ScheduledExecutorService scheduler;
    private boolean dernierStatut = false;

    public NetworkMonitor(SyncService syncService,
                          Consumer<Boolean> onStatusChange,
                          Runnable onReconnexion) {
        this.syncService = syncService;
        this.onStatusChange = onStatusChange;
        this.onReconnexion = onReconnexion;
    }

    public void demarrer() {
        scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = Thread.ofVirtual().unstarted(r);
            t.setDaemon(true);
            return t;
        });

        scheduler.scheduleAtFixedRate(this::verifier, 0, INTERVAL_SECONDES, TimeUnit.SECONDS);
    }

    public void arreter() {
        if (scheduler != null && !scheduler.isShutdown()) {
            scheduler.shutdown();
        }
    }

    private void verifier() {
        boolean connecte = syncService.isBackendJoignable();

        if (connecte != dernierStatut) {
            dernierStatut = connecte;
            onStatusChange.accept(connecte);

            if (connecte) {
                onReconnexion.run();
            }
        }
    }

    public boolean isConnecte() {
        return dernierStatut;
    }
}
