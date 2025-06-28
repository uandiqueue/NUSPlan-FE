// Download payload as JSON file
export function exportJson(data: unknown, filename = "payload.json") {
    try {
        const json = JSON.stringify(data, null, 2); // pretty-print
        const blob = new Blob([json], { type: "application/json" });
        const url  = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click(); // Triggers the download
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error("exportJson failed", err);
    }
}