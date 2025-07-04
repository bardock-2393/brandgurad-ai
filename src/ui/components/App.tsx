// To support: system="express" scale="medium" color="light"
// import these spectrum web components modules:
import "@spectrum-web-components/theme/express/scale-medium.js";
import "@spectrum-web-components/theme/express/theme-light.js";

// To learn more about using "swc-react" visit:
// https://opensource.adobe.com/spectrum-web-components/using-swc-react/
import { Button } from "@swc-react/button";
import { Theme } from "@swc-react/theme";
import React, { useEffect, useState, useRef } from "react";
import { DocumentSandboxApi } from "../../models/DocumentSandboxApi";
import "./App.css";

import { AddOnSDKAPI } from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";

// TODO: Replace with your actual Gemini API key or load from env/config
const GEMINI_API_KEY = "AIzaSyC6Ng6rn4n2XjIvPl9dvl_NjPn0QGsRidg";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const App = ({ addOnUISdk, sandboxProxy }: { addOnUISdk: AddOnSDKAPI; sandboxProxy: DocumentSandboxApi }) => {
    const [pageMeta, setPageMeta] = useState<any>(null);
    const [elementsMeta, setElementsMeta] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [pngUrl, setPngUrl] = useState<string | null>(null);
    const [pngBlob, setPngBlob] = useState<Blob | null>(null);
    // const [videoUrl, setVideoUrl] = useState<string | null>(null);
    // const [noVideoOrGif, setNoVideoOrGif] = useState<boolean>(false);
    const [description, setDescription] = useState("");
    const [rules, setRules] = useState<string[]>([]);
    const [geminiOutput, setGeminiOutput] = useState<any[]>([]);
    const [isCreatingRules, setIsCreatingRules] = useState(false);
    const [isSendingToGemini, setIsSendingToGemini] = useState(false);
    // const [imageFile, setImageFile] = useState<File | null>(null);
    // const [imageBase64, setImageBase64] = useState<string | null>(null);
    // const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        async function fetchMetaAndRenditions() {
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
                    const url = URL.createObjectURL(renditionsPng[0].blob);
                    setPngUrl(url);
                    setPngBlob(renditionsPng[0].blob);
                } else {
                    setError("No PNG rendition returned");
                }
                // MP4 rendition (commented out)
                /*
                let foundVideo = false;
                const renditionOptionsMp4 = {
                    range: addOnUISdk.constants.Range.currentPage,
                    format: addOnUISdk.constants.RenditionFormat.mp4,
                };
                try {
                    const renditionsMp4 = await addOnUISdk.app.document.createRenditions(
                        renditionOptionsMp4,
                        addOnUISdk.constants.RenditionIntent.preview
                    );
                    if (renditionsMp4 && renditionsMp4.length > 0) {
                        const vurl = URL.createObjectURL(renditionsMp4[0].blob);
                        setVideoUrl(vurl);
                        foundVideo = true;
                    } else {
                        setVideoUrl(null);
                    }
                } catch (err) {
                    setVideoUrl(null);
                }
                setNoVideoOrGif(!foundVideo);
                */
            } catch (err: any) {
                setError(err?.message || "Failed to fetch metadata or renditions");
            }
        }
        fetchMetaAndRenditions();
    }, [addOnUISdk, sandboxProxy]);

    // Helper to convert Blob to base64
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

    const handleCreateRules = async () => {
        setIsCreatingRules(true);
        setRules([]);
        try {
            const prompt = `Convert the following description into a list of clear, unique, and non-redundant rules. Do not repeat the same rule in different words.\nDescription: ${description}\nRules:`;
            const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: prompt }
                            ]
                        }
                    ]
                })
            });
            if (!response.ok) throw new Error("Failed to get rules from Gemini");
            const data = await response.json();
            // Try to extract rules from the response
            let rulesText = "";
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0].text) {
                rulesText = data.candidates[0].content.parts[0].text;
            }
            // Split rules by line (expecting numbered list)
            const rulesArr = rulesText
                .split(/\n|\r/)
                .map(line => line.trim())
                .filter(line => line.match(/^\d+\./))
                .map(line => line.replace(/^\d+\.\s*/, ""));
            setRules(rulesArr.length > 0 ? rulesArr : [rulesText]);
        } catch (err: any) {
            setRules(["Error: " + (err.message || "Unknown error")]);
        }
        setIsCreatingRules(false);
    };

    const handleSendToGemini = async () => {
        setIsSendingToGemini(true);
        try {
            // Compose Gemini prompt
            const prompt = `Given the following design data and rules, check each element for rule violations. For every violation, output a Markdown table with the following columns: Rule, Element (type, name, and ID), and Explanation (why it violates the rule).\n- In the Element column, include the element's type, its original name (if any, otherwise use the element's type as the name), and its ID.\n- In the Explanation, use human-friendly color names (e.g., 'purple', 'blue', 'black') instead of raw RGB values or JSON.\n- Keep explanations short and clear, e.g., 'Element uses a purple fill color.'\n- Output only the table, no extra text.\n\nRules:\n${rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}\n\nPage Metadata:\n${JSON.stringify(pageMeta, null, 2)}\n\nElements Metadata:\n${JSON.stringify(elementsMeta, null, 2)}`;

            // Build parts array for Gemini API
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
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts
                        }
                    ]
                })
            });
            if (!response.ok) throw new Error("Failed to get response from Gemini");
            const data = await response.json();
            let outputText = "";
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0].text) {
                outputText = data.candidates[0].content.parts[0].text;
            }
            setGeminiOutput([{ rule: outputText, followed: null, explanation: "" }]);
        } catch (err: any) {
            setGeminiOutput([{ rule: "Error: " + (err.message || "Unknown error"), followed: null, explanation: "" }]);
        }
        setIsSendingToGemini(false);
    };

    return (
        // Please note that the below "<Theme>" component does not react to theme changes in Express.
        // You may use "addOnUISdk.app.ui.theme" to get the current theme and react accordingly.
        <Theme system="express" scale="medium" color="light">
            <div className="container">
                {/* Remove or comment out the following block that displays Current Page Metadata */}
                {/*
                <div style={{ marginBottom: 24 }}>
                    <h2>Current Page Metadata</h2>
                    <pre style={{ background: '#f6f8fa', padding: 12, borderRadius: 6, fontSize: 13 }}>
                        {JSON.stringify(pageMeta, null, 2)}
                    </pre>
                </div>
                */}
                {error && <div style={{ color: 'red' }}>{error}</div>}
                {/* Show the PNG if available */}
                {/*
                {pngUrl && (
                    <div style={{ marginBottom: 24 }}>
                        <h2>Page PNG Preview</h2>
                        <img
                            src={pngUrl}
                            alt="Page PNG"
                            style={{
                                maxWidth: "100%",
                                borderRadius: 8,
                                border: "1px solid #eee",
                                marginTop: 8
                            }}
                        />
                    </div>
                )}
                */}
                {/* Show the video/animation if available, directly below PNG */}
                {/*
                {videoUrl && (
                    <div style={{ marginTop: 24 }}>
                        <h3>Page Video/Animation Preview (MP4)</h3>
                        <video src={videoUrl} controls style={{ maxWidth: '100%', border: '1px solid #ccc', borderRadius: 8 }} />
                    </div>
                )}
                */}
                {/* GIF not supported */}
                {/*
                {noVideoOrGif && (
                    <div style={{ marginTop: 24, color: '#888' }}>
                        <em>No video or animation output available for this page.</em>
                    </div>
                )}
                */}
                <div style={{ marginBottom: 24 }}>
                    <h2>Step 1: Enter Description</h2>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Describe your requirements..."
                        rows={4}
                        style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
                    />
                    <Button
                        variant="primary"
                        style={{ marginTop: 12 }}
                        onClick={handleCreateRules}
                        disabled={!description || isCreatingRules}
                    >
                        {isCreatingRules ? "Creating Rules..." : "Create Rules"}
                    </Button>
                </div>
                {rules.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                        <h2>Step 2: Generated Rules</h2>
                        <ol>
                            {rules.map((rule, idx) => (
                                <li key={idx}>{rule}</li>
                            ))}
                        </ol>
                        <Button
                            variant="secondary"
                            style={{ marginTop: 12 }}
                            onClick={handleSendToGemini}
                            disabled={isSendingToGemini}
                        >
                            {isSendingToGemini ? "Sending to Gemini..." : "Send All Data to Gemini"}
                        </Button>
                    </div>
                )}
                {geminiOutput.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                        <h2>Step 3: Gemini Output</h2>
                        {/* Render Markdown output from Gemini, or parse for summary/table if desired */}
                        <div style={{ whiteSpace: 'pre-wrap', textAlign: 'left', background: '#f8f8fa', padding: 16, borderRadius: 8, overflowX: 'auto' }}>
                            {geminiOutput[0].rule}
                        </div>
                    </div>
                )}
            </div>
        </Theme>
    );
};

export default App;
