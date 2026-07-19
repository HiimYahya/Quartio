package com.quartio.desktop.plugin;

import com.quartio.desktop.model.Incident;

import java.io.File;
import java.util.List;

public interface ExportPlugin {

    String getNom();

    String getExtension();

    void exporter(List<Incident> incidents, File destination) throws ExportException;

    class ExportException extends Exception {
        public ExportException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
