// No shared FE/BE types for now, so this is a bit messy
interface Programme {
    name: string;
    type: "major" | "secondMajor" | "minor";
}

export async function populateModules(payload: Programme) {
    const res = await fetch("http://localhost:3000/api/populate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Backend error");
    return res.json();
}
