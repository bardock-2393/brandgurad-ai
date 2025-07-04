// To support: system="express" scale="medium" color="light"
// import these spectrum web components modules:
import "@spectrum-web-components/theme/express/scale-medium.js";
import "@spectrum-web-components/theme/express/theme-light.js";

// To learn more about using "swc-react" visit:
// https://opensource.adobe.com/spectrum-web-components/using-swc-react/
import { Button } from "@swc-react/button";
import { Theme } from "@swc-react/theme";
import React, { useEffect, useState } from "react";
import { DocumentSandboxApi } from "../../models/DocumentSandboxApi";
import "./App.css";

import { AddOnSDKAPI } from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";
import logo from "./brandguard-ai-logo.png";
import { FiCheckSquare, FiSquare, FiEdit, FiTrash2, FiSave, FiX } from "react-icons/fi";

// --- Gemini API Config ---
const GEMINI_API_KEY = "AIzaSyC6Ng6rn4n2XjIvPl9dvl_NjPn0QGsRidg";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// --- Guideline Management Hook ---
function useGuidelines(addOnUISdk) {
    const [guidelines, setGuidelines] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        async function load() {
            try {
                const data = await addOnUISdk.instance.clientStorage.getItem('guidelines');
                setGuidelines(Array.isArray(data) ? data : []);
            } catch {
                setGuidelines([]);
            }
            setLoading(false);
        }
        load();
    }, [addOnUISdk]);
    const save = async (next) => {
        setGuidelines(next);
        await addOnUISdk.instance.clientStorage.setItem('guidelines', next);
    };
    return { guidelines, save, loading };
}

// --- Main App Component ---
const App = ({ addOnUISdk, sandboxProxy }: { addOnUISdk: AddOnSDKAPI; sandboxProxy: DocumentSandboxApi }) => {
    // --- State ---
    const [pageMeta, setPageMeta] = useState<any>(null);
    const [elementsMeta, setElementsMeta] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [pngBlob, setPngBlob] = useState<Blob | null>(null);
    const [geminiOutput, setGeminiOutput] = useState<any[]>([]);
    const [isSendingToGemini, setIsSendingToGemini] = useState(false);
    const { guidelines, save, loading: guidelinesLoading } = useGuidelines(addOnUISdk);
    const [selected, setSelected] = useState<number[]>([]);
    const [editIdx, setEditIdx] = useState<number|null>(null);
    const [editText, setEditText] = useState("");
    const [newText, setNewText] = useState("");
    const [showGuidelines, setShowGuidelines] = useState(false);
    const [infoMessage, setInfoMessage] = useState("");

    // Restore selected guidelines from storage on load
    useEffect(() => {
        async function loadSelected() {
            try {
                const data = await addOnUISdk.instance.clientStorage.getItem('selectedGuidelines');
                setSelected(Array.isArray(data) ? data : []);
            } catch {
                setSelected([]);
            }
        }
        loadSelected();
    }, [addOnUISdk]);

    // Save selected guidelines to storage
    const saveSelected = async (sel: number[]) => {
        setSelected(sel);
        await addOnUISdk.instance.clientStorage.setItem('selectedGuidelines', sel);
    };

    // --- Fetch Metadata and PNG Rendition ---
    const fetchMetaAndRenditions = async () => {
        try {
            const metaArr = await addOnUISdk.app.document.getPagesMetadata({
                range: addOnUISdk.constants.Range.currentPage
            });
            setPageMeta(metaArr && metaArr.length > 0 ? metaArr[0] : null);
            const elements = await sandboxProxy.getCurrentPageElementsMeta();
            setElementsMeta(elements);
            // PNG rendition
            const renditionOptionsPng = {
                range: addOnUISdk.constants.Range.currentPage,
                format: addOnUISdk.constants.RenditionFormat.png,
            };
            const renditionsPng = await addOnUISdk.app.document.createRenditions(
                renditionOptionsPng,
                addOnUISdk.constants.RenditionIntent.preview
            );
            if (renditionsPng && renditionsPng.length > 0) {
                setPngBlob(renditionsPng[0].blob);
            } else {
                setError("No PNG rendition returned");
            }
        } catch (err: any) {
            setError(err?.message || "Failed to fetch metadata or renditions");
        }
    };

    // Call on initial load and poll every 2 seconds
    useEffect(() => {
        fetchMetaAndRenditions();
        const interval = setInterval(fetchMetaAndRenditions, 2000);
        return () => clearInterval(interval);
    }, [addOnUISdk, sandboxProxy]);

    // --- Helpers ---
    function blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // --- Add this helper to split guidelines using Gemini ---
    async function splitGuidelineToRules(guideline) {
        const prompt = `Split the following guideline into a list of clear, unique, and non-redundant rules. Each rule should be atomic and testable.\nGuideline: ${guideline}\nRules:`;
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [ { parts: [ { text: prompt } ] } ]
            })
        });
        if (!response.ok) throw new Error("Failed to split guideline");
        const data = await response.json();
        let rulesText = "";
        if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
            rulesText = data.candidates[0].content.parts[0].text;
        }
        // Split rules by line (expecting numbered list)
        return rulesText
            .split(/\n|\r/)
            .map(line => line.trim())
            .filter(line => line.match(/^\d+\./))
            .map(line => line.replace(/^\d+\.\s*/, ""));
    }

    // --- Helper to strip Markdown formatting from rules ---
    function stripMarkdown(text) {
        return text
            .replace(/[#*_`~\[\]()\-]/g, '') // Remove markdown symbols
            .replace(/\s{2,}/g, ' ') // Collapse multiple spaces
            .trim();
    }

    // --- Helper to parse Markdown table to HTML ---
    function markdownTableToHtml(md) {
        const lines = md.split('\n').filter(line => line.trim().startsWith('|'));
        if (lines.length < 2) return null;
        const headers = lines[0].split('|').map(h => h.trim()).filter(Boolean);
        const rows = lines.slice(2).map(line => line.split('|').map(cell => cell.trim()).filter(Boolean));
        return (
            <table className="gemini-table">
                <thead>
                    <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                    ))}
                </tbody>
            </table>
        );
    }

    // --- Gemini Send ---
    const handleSendToGemini = async () => {
        setIsSendingToGemini(true);
        try {
            const selectedGuidelines = selected.map(idx => guidelines[idx]);
            const prompt = `Given the following design data and guidelines, check each element for guideline violations. For every violation, output a Markdown table with the following columns:
- Guideline
- Problematic Element or Text (quote the text or describe the element)
- Explanation (why it violates the guideline).

In the Explanation, use human-friendly color names (e.g., 'purple', 'blue', 'black') instead of raw RGB values or JSON.
Keep explanations short and clear, e.g., 'The text "14 Nov" is in the wrong date format.'
Output only the table, no extra text.
If there are no violations, respond with exactly: "No violations found".

Guidelines:
${selectedGuidelines.map((g, i) => `${i + 1}. ${g}`).join("\n")}

Page Metadata:
${JSON.stringify(pageMeta, null, 2)}

Elements Metadata:
${JSON.stringify(elementsMeta, null, 2)}`;
            const parts: any[] = [];
            if (pngBlob) {
                const imageBase64 = await blobToBase64(pngBlob);
                parts.push({
                    inline_data: {
                        mime_type: "image/png",
                        data: imageBase64
                    }
                });
            }
            parts.push({ text: prompt });
            const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [ { parts } ] })
            });
            if (!response.ok) throw new Error("Failed to get response from Gemini");
            const data = await response.json();
            let outputText = "";
            if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                outputText = data.candidates[0].content.parts[0].text;
            }
            setGeminiOutput([{ rule: outputText, followed: null, explanation: "" }]);
        } catch (err: any) {
            setGeminiOutput([{ rule: "Error: " + (err.message || "Unknown error"), followed: null, explanation: "" }]);
        }
        setIsSendingToGemini(false);
    };

    // --- UI Handlers ---
    const handleAdd = async () => {
        if (newText.trim()) {
            const isSimple = newText.trim().split(/\s+/).length <= 10 && !/[,.]|\band\b|\bor\b/i.test(newText);
            let next;
            if (isSimple) {
                next = [...guidelines, newText.trim()];
            } else {
                const splitRules = await splitGuidelineToRules(newText.trim());
                next = [...guidelines, ...splitRules];
            }
            await save(next);
            setNewText("");
        }
    };
    const handleEdit = async (idx) => {
        if (editText.trim()) {
            const next = guidelines.map((g, i) => i === idx ? editText.trim() : g);
            await save(next);
            setEditIdx(null);
            setEditText("");
        }
    };
    const handleDelete = async (idx) => {
        const next = guidelines.filter((_, i) => i !== idx);
        await save(next);
        setSelected(selected.filter(i => i !== idx));
    };
    const handleSelect = (idx) => {
        const newSel = selected.includes(idx) ? selected.filter(i => i !== idx) : [...selected, idx];
        saveSelected(newSel);
    };

    // Select all/deselect all handler
    const handleSelectAll = () => {
        if (selected.length === guidelines.length) {
            saveSelected([]);
        } else {
            saveSelected(guidelines.map((_, idx) => idx));
        }
    };

    // Delete all handler
    const handleDeleteAll = async () => {
        await save([]);
        await saveSelected([]);
    };

    // --- Render ---
    useEffect(() => {
        if (selected.length > 0) setInfoMessage("");
    }, [selected]);
    useEffect(() => {
        if (guidelines.length > 0) setInfoMessage("");
    }, [guidelines]);

    return (
        <Theme system="express" scale="medium" color="light">
            <div className="container modern-guidelines">
                <img src={logo} alt="BrandGuard AI Logo" style={{ height: 80, marginBottom: 24 }} />
                {!showGuidelines && (
                    <>
                        <Button variant="primary" onClick={() => setShowGuidelines(true)} style={{ marginBottom: 24 }}>
                            Add Guideline
                        </Button>
                        <Button
                            style={{ width: '100%', marginBottom: 0, background: '#b10dc9', color: '#fff' }}
                            variant="cta"
                            onClick={() => {
                                if (selected.length === 0 || isSendingToGemini) {
                                    setInfoMessage("Please add a guideline, check the box, and save.");
                                } else {
                                    setInfoMessage("Preparing data, please wait...");
                                    setTimeout(() => {
                                        setInfoMessage("");
                                        handleSendToGemini();
                                    }, 5000);
                                }
                            }}
                        >
                            {isSendingToGemini ? "Sending to Ai..." : "Check Guidelines with Ai"}
                        </Button>
                        {infoMessage && (
                            <div style={{ color: '#b10dc9', textAlign: 'center', marginTop: 8, fontWeight: 500 }}>
                                {infoMessage}
                            </div>
                        )}
                        {geminiOutput.length > 0 && (
                            <div className="gemini-output-panel">
                                <h3>AI Output</h3>
                                <div className="gemini-output-content">
                                    {markdownTableToHtml(geminiOutput[0].rule) || <pre>{geminiOutput[0].rule}</pre>}
                                </div>
                            </div>
                        )}
                        {error && <div className="error-message">{error}</div>}
                    </>
                )}
                {showGuidelines && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2> Add Your Guideline</h2>
                            <Button size="s" variant="secondary" onClick={() => setShowGuidelines(false)} style={{ marginLeft: 12 }}>Close</Button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                            <Button size="s" variant="primary" onClick={handleSelectAll} style={{ marginRight: 8 }}>
                                {selected.length === guidelines.length && guidelines.length > 0 ? 'Deselect All' : 'Select All'}
                            </Button>
                            <Button size="s" variant="negative" onClick={handleDeleteAll} style={{ marginRight: 8 }}>
                                Delete All
                            </Button>
                        </div>
                        <div className="guideline-list">
                            {guidelinesLoading ? (
                                <div>Loading guidelines...</div>
                            ) : (
                                guidelines.length === 0 ? (
                                    <div className="empty">No guidelines yet. Add your first guideline below.</div>
                                ) : (
                                    guidelines.map((g, idx) => (
                                        <div className={`guideline-row${selected.includes(idx) ? ' selected' : ''}`} key={idx}>
                                            <input type="checkbox" checked={selected.includes(idx)} onChange={() => handleSelect(idx)} style={{ display: 'none' }} />
                                            <span onClick={() => handleSelect(idx)} style={{ cursor: 'pointer', marginRight: 8 }}>
                                                {selected.includes(idx) ? <FiCheckSquare size={18} color="#000" /> : <FiSquare size={18} color="#000" />}
                                            </span>
                                            {editIdx === idx ? (
                                                <>
                                                    <input className="edit-input small" value={editText} onChange={e => setEditText(e.target.value)} />
                                                    <Button size="s" onClick={() => handleEdit(idx)} style={{ minWidth: 28, padding: 0 }}>
                                                        <FiSave size={18} color="#000" />
                                                    </Button>
                                                    <Button size="s" variant="secondary" onClick={() => { setEditIdx(null); setEditText(""); }} style={{ minWidth: 28, padding: 0 }}>
                                                        <FiX size={18} color="#b10dc9" />
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="guideline-text small" title={stripMarkdown(g)}>{stripMarkdown(g)}</span>
                                                    <Button size="s" variant="secondary" onClick={() => { setEditIdx(idx); setEditText(g); }} style={{ minWidth: 28, padding: 0 }}>
                                                        <FiEdit size={18} color="#b10dc9" />
                                                    </Button>
                                                    <Button size="s" variant="negative" onClick={() => handleDelete(idx)} style={{ minWidth: 28, padding: 0, background: '#b10dc9' }}>
                                                        <FiTrash2 size={18} color="#fff" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    ))
                                )
                            )}
                        </div>
                        <div className="add-guideline-row">
                            <input className="add-input" value={newText} onChange={e => setNewText(e.target.value)} placeholder="Add or paste  guidelines..." />
                            <Button size="m" variant="primary" onClick={handleAdd}>Add</Button>
                        </div>
                        <Button style={{ width: '100%', marginTop: 24, background: '#b10dc9', color: '#fff' }} variant="cta" onClick={() => setShowGuidelines(false)}>
                            Save
                        </Button>
                    </>
                )}
            </div>
            <footer style={{ textAlign: 'center', padding: '16px 0', fontSize: 14, color: '#888' }}>
                Developed by <a href="https://www.deepsantoshwar.xyz" target="_blank" rel="noopener noreferrer"><b>Deep</b></a> and <a href="https://renukawadetwar.vercel.app/" target="_blank" rel="noopener noreferrer"><b>Renuka</b></a>
            </footer>
        </Theme>
    );
};

export default App;
