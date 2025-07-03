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

const App = ({ addOnUISdk, sandboxProxy }: { addOnUISdk: AddOnSDKAPI; sandboxProxy: DocumentSandboxApi }) => {
    const [pageMeta, setPageMeta] = useState<any>(null);
    const [elementsMeta, setElementsMeta] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [pngUrl, setPngUrl] = useState<string | null>(null);

    useEffect(() => {
        async function fetchMetaAndPng() {
            try {
                const metaArr = await addOnUISdk.app.document.getPagesMetadata({
                    range: addOnUISdk.constants.Range.currentPage
                });
                setPageMeta(metaArr && metaArr.length > 0 ? metaArr[0] : null);
                const elements = await sandboxProxy.getCurrentPageElementsMeta();
                setElementsMeta(elements);
                // Automatically export PNG after metadata loads
                const renditionOptions = {
                    range: addOnUISdk.constants.Range.currentPage,
                    format: addOnUISdk.constants.RenditionFormat.png,
                };
                const renditions = await addOnUISdk.app.document.createRenditions(
                    renditionOptions,
                    addOnUISdk.constants.RenditionIntent.preview
                );
                if (renditions && renditions.length > 0) {
                    const url = URL.createObjectURL(renditions[0].blob);
                    setPngUrl(url);
                } else {
                    setError("No PNG rendition returned");
                }
            } catch (err: any) {
                setError(err?.message || "Failed to fetch metadata or PNG");
            }
        }
        fetchMetaAndPng();
    }, [addOnUISdk, sandboxProxy]);

    return (
        // Please note that the below "<Theme>" component does not react to theme changes in Express.
        // You may use "addOnUISdk.app.ui.theme" to get the current theme and react accordingly.
        <Theme system="express" scale="medium" color="light">
            <div className="container">
                <h2>Current Page Metadata</h2>
                {error && <div style={{ color: 'red' }}>{error}</div>}
                {pageMeta ? (
                    <pre style={{ textAlign: 'left', background: '#f4f4f4', padding: '12px', borderRadius: '8px', overflowX: 'auto' }}>
                        {JSON.stringify(pageMeta, null, 2)}
                    </pre>
                ) : (
                    !error && <div>Loading...</div>
                )}
                <h2 style={{ marginTop: 24 }}>Elements on Current Page</h2>
                {elementsMeta.length > 0 ? (
                    elementsMeta
                        .filter(el => {
                            // Only show visual elements
                            if (el.type && (el.type.toLowerCase().includes('text') || el.type.toLowerCase().includes('image') || el.type.toLowerCase().includes('media'))) {
                                return true;
                            }
                            // Show rectangles only if not used as a mask
                            if (el.type && el.type.toLowerCase().includes('rectangle')) {
                                if (elementsMeta.find(e => e.maskShapeId === el.id)) return false;
                                return true;
                            }
                            return false;
                        })
                        .map((el, idx) => {
                            let label = '';
                            if (el.type && el.type.toLowerCase().includes('text')) {
                                label = `Text: "${el.text ?? ''}"`;
                            } else if (el.type && (el.type.toLowerCase().includes('image') || el.type.toLowerCase().includes('media'))) {
                                label = 'Image';
                            } else if (el.type && el.type.toLowerCase().includes('rectangle')) {
                                label = 'Rectangle';
                            } else {
                                label = el.type || 'Element';
                            }
                            return (
                                <div key={el.id || idx} style={{ marginBottom: 16 }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{label}</div>
                                    <pre style={{ textAlign: 'left', background: '#f9f9f9', padding: '8px', borderRadius: '6px', marginBottom: 0, overflowX: 'auto' }}>
                                        {JSON.stringify(el, null, 2)}
                                    </pre>
                                </div>
                            );
                        })
                ) : (
                    !error && <div>No elements found or loading...</div>
                )}
                {pngUrl && (
                    <div style={{ marginTop: 24 }}>
                        <h3>Page PNG Preview</h3>
                        <img src={pngUrl} alt="Page PNG" style={{ maxWidth: '100%', border: '1px solid #ccc', borderRadius: 8 }} />
                    </div>
                )}
            </div>
        </Theme>
    );
};

export default App;
